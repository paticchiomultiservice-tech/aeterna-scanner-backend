"""AETERNA same-origin portal and authenticated, content-stateless scanner.

Run exactly one worker/instance. Raw scan text lives only in the HTTP request
and analysis stack; neither the operation registry nor Google receives it.
"""
import asyncio
from collections import deque
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
import hashlib
import hmac
import json
import logging
from pathlib import Path
import re
import secrets
import time
from typing import Literal
from uuid import UUID, uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.exceptions import HTTPException as StarletteHTTPException

from engine import ScanCancelled, ScanTimedOut, analyze
from gateway import Gateway, GatewayError
from settings import Settings


COOKIE = "__Host-aeterna_session"
SESSION_RE = re.compile(r"^[A-Za-z0-9_-]{43}$")
UUID4_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


class APIError(Exception):
    def __init__(self, code, status=400):
        self.code, self.status = code, status


def error(code, status):
    return JSONResponse({"ok": False, "error": {"code": code, "message": "Request could not be completed."}}, status_code=status)


def public_gateway_error(exc):
    unauthorized = {"UNAUTHORIZED", "SESSION_EXPIRED", "INVALID_SESSION", "SESSION_INVALID"}
    forbidden = {"ACCOUNT_INVALID", "ACCOUNT_INACTIVE", "ACCOUNT_EXPIRED", "SUBSCRIPTION_EXPIRED", "NO_CREDITS", "ACCESS_DENIED"}
    invalid_otp = {"INVALID_CODE", "OTP_INVALID", "OTP_EXPIRED", "CHALLENGE_EXPIRED", "CHALLENGE_INVALID", "INVALID_CHALLENGE", "TOO_MANY_ATTEMPTS"}
    if exc.code in unauthorized:
        return APIError("UNAUTHORIZED", 401)
    if exc.code in forbidden:
        return APIError(exc.code, 403)
    if exc.code in invalid_otp:
        return APIError("INVALID_CODE", 400)
    if exc.code in {"OPERATION_REPLAY", "OPERATION_CANCELLED", "OPERATION_EXPIRED", "OPERATION_FINALIZED"}:
        return APIError(exc.code, 409)
    if exc.code in {"RATE_LIMITED", "TOO_MANY_REQUESTS"}:
        return APIError("RATE_LIMITED", 429)
    return APIError("SERVICE_UNAVAILABLE", 503)


class ClosedModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, hide_input_in_errors=True)


class StartInput(ClosedModel):
    email: str = Field(min_length=3, max_length=254)
    locale: Literal["it", "en", "fr", "es", "pt"] = "it"

    @field_validator("email")
    @classmethod
    def email_format(cls, value):
        value = value.strip().lower()
        if (not re.fullmatch(r"[a-z0-9][a-z0-9.!#$%&'*+/=?^_`{|}~-]{0,63}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}", value)
            or ".." in value or value.split("@")[0].endswith(".")):
            raise ValueError("Invalid email format")
        return value


class VerifyInput(ClosedModel):
    challenge_id: str = Field(pattern=UUID4_RE.pattern)
    code: str = Field(pattern=r"^[0-9]{8}$")


class ScanInput(ClosedModel):
    operation_id: str = Field(pattern=UUID4_RE.pattern)
    message: str = Field(min_length=1, max_length=20000)
    locale: Literal["it", "en", "fr", "es", "pt"] = "it"

    @field_validator("message")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("Empty input")
        return value


class EmptyInput(ClosedModel):
    pass


def sanitize_account(data):
    """Explicit allowlist: account email/IDs/token never reach the browser."""
    if not isinstance(data, dict):
        raise GatewayError()
    plan, level, expiry = data.get("plan"), data.get("level"), data.get("expires_at")
    unlimited, remaining = data.get("unlimited"), data.get("scans_remaining")
    if (not isinstance(plan, str) or not 1 <= len(plan) <= 80 or
        not isinstance(level, str) or not 1 <= len(level) <= 80 or
        not isinstance(expiry, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", expiry) or
        type(unlimited) is not bool or
        (remaining is not None and (type(remaining) is not int or remaining < 0)) or
        (not unlimited and remaining is None)):
        raise GatewayError()
    return {"plan": plan, "level": level, "expires_at": expiry,
            "unlimited": unlimited, "scans_remaining": None if unlimited else remaining}


class RateLimits:
    """Bounded process-local supplement to durable gateway limits."""
    def __init__(self):
        self.buckets = {}

    def clean(self):
        now = time.monotonic()
        self.buckets = {k: v for k, v in self.buckets.items() if v and now - v[-1] < 3600}

    def check(self, key, limit, period):
        now = time.monotonic()
        if len(self.buckets) >= 10000:
            self.clean()
            if key not in self.buckets and len(self.buckets) >= 10000:
                raise APIError("RATE_LIMITED", 429)
        bucket = self.buckets.setdefault(key, deque())
        while bucket and bucket[0] <= now - period:
            bucket.popleft()
        if len(bucket) >= limit:
            raise APIError("RATE_LIMITED", 429)
        bucket.append(now)


@dataclass
class Operation:
    owner: str
    created: float
    event: asyncio.Event = field(default_factory=asyncio.Event)
    done: asyncio.Event = field(default_factory=asyncio.Event)
    state: str = "running"


class Operations:
    def __init__(self, settings):
        self.settings, self.items = settings, {}

    def clean(self):
        now = time.monotonic()
        for key, operation in list(self.items.items()):
            if now - operation.created > self.settings.operation_ttl:
                if not operation.done.is_set():
                    operation.event.set()
                else:
                    del self.items[key]

    def add(self, key, owner):
        self.clean()
        if key in self.items:
            # Never disclose whether somebody else's operation exists.
            raise APIError("OPERATION_REPLAY", 409)
        if len(self.items) >= self.settings.max_operations:
            raise APIError("BUSY", 503)
        operation = Operation(owner=owner, created=time.monotonic())
        self.items[key] = operation
        return operation

    def own(self, key, owner):
        self.clean()
        operation = self.items.get(key)
        if operation is not None and not hmac.compare_digest(operation.owner, owner):
            raise APIError("OPERATION_NOT_FOUND", 404)
        return operation


class PrivacyMiddleware:
    """ASGI size bounds and response headers, no request-body buffering/logging."""
    def __init__(self, app, settings):
        self.app, self.settings = app, settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = {k.lower(): v for k, v in scope.get("headers", [])}
        length = headers.get(b"content-length")
        if length is not None:
            try:
                if int(length) < 0 or int(length) > self.settings.max_body_bytes:
                    return await error("BODY_TOO_LARGE", 413)(scope, receive, self.secure_send(send))
            except ValueError:
                return await error("INVALID_REQUEST", 400)(scope, receive, self.secure_send(send))
        if headers.get(b"content-encoding", b"identity").lower() != b"identity":
            return await error("UNSUPPORTED_ENCODING", 415)(scope, receive, self.secure_send(send))
        if scope["method"] in ("POST", "PUT", "PATCH", "DELETE"):
            origin = headers.get(b"origin", b"").decode("latin-1")
            if not self.settings.app_origin or origin != self.settings.app_origin:
                return await error("ORIGIN_REJECTED", 403)(scope, receive, self.secure_send(send))
            if headers.get(b"content-type", b"").split(b";", 1)[0].strip().lower() != b"application/json":
                return await error("JSON_REQUIRED", 415)(scope, receive, self.secure_send(send))
        received = 0
        response_started = False
        response_finished = False
        secured_send = self.secure_send(send)

        async def tracked_send(event):
            nonlocal response_started, response_finished
            if event["type"] == "http.response.start":
                response_started = True
            elif event["type"] == "http.response.body" and not event.get("more_body", False):
                response_finished = True
            await secured_send(event)

        async def bounded_receive():
            nonlocal received
            event = await receive()
            if event["type"] == "http.request":
                received += len(event.get("body", b""))
                if received > self.settings.max_body_bytes:
                    raise APIError("BODY_TOO_LARGE", 413)
            return event

        try:
            await self.app(scope, bounded_receive, tracked_send)
        except APIError as exc:
            if not response_started:
                await error(exc.code, exc.status)(scope, receive, tracked_send)
            elif not response_finished:
                await tracked_send({"type": "http.response.body", "body": b"", "more_body": False})
        except Exception:
            # Handle before Starlette's outer ServerErrorMiddleware: its normal
            # behavior re-raises after responding, which lets Uvicorn log the
            # exception message. Such messages can contain customer content.
            # Never include repr/str/traceback or re-raise this exception.
            if not response_started:
                await error("INTERNAL_ERROR", 500)(scope, receive, tracked_send)
            elif not response_finished:
                await tracked_send({"type": "http.response.body", "body": b"", "more_body": False})

    @staticmethod
    def secure_send(send):
        async def wrapped(event):
            if event["type"] == "http.response.start":
                response_headers = [(k, v) for k, v in event.get("headers", []) if k.lower() not in
                    {b"cache-control", b"content-security-policy", b"referrer-policy", b"x-content-type-options"}]
                response_headers.extend([
                    (b"cache-control", b"no-store"), (b"pragma", b"no-cache"),
                    (b"referrer-policy", b"no-referrer"), (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"strict-transport-security", b"max-age=31536000"),
                    (b"permissions-policy", b"camera=(), microphone=(), geolocation=(), payment=()"),
                    (b"content-security-policy", b"default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; script-src-attr 'none'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' blob:; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"),
                ])
                event = {**event, "headers": response_headers}
            await send(event)
        return wrapped


def create_app(settings=None, gateway=None, analyzer=analyze):
    settings = settings or Settings.from_env()
    config_errors = settings.errors()
    gateway = gateway or (Gateway(settings) if not config_errors else None)
    operations, rates = Operations(settings), RateLimits()

    @asynccontextmanager
    async def lifespan(_app):
        async def maintenance():
            while True:
                await asyncio.sleep(30)
                operations.clean()
                rates.clean()

        sweeper = asyncio.create_task(maintenance())
        try:
            yield
        finally:
            sweeper.cancel()
            try:
                await sweeper
            except asyncio.CancelledError:
                pass
            for operation in operations.items.values():
                operation.event.set()
            if gateway is not None and hasattr(gateway, "close"):
                await gateway.close()

    app = FastAPI(title="AETERNA Core", docs_url=None, redoc_url=None, openapi_url=None,
                  debug=False, lifespan=lifespan)
    app.add_middleware(PrivacyMiddleware, settings=settings)
    app.state.operations = operations

    def configured():
        if config_errors or gateway is None:
            raise APIError("SERVICE_NOT_CONFIGURED", 503)

    def secret_hmac(value):
        return hmac.new(settings.auth_secret.encode(), value.encode(), hashlib.sha256).hexdigest()

    def session_secret(request):
        value = request.cookies.get(COOKIE, "")
        if not SESSION_RE.fullmatch(value):
            raise APIError("UNAUTHORIZED", 401)
        return value

    def session_hash(request):
        return hashlib.sha256(session_secret(request).encode()).hexdigest()

    def csrf(request):
        expected = secret_hmac("csrf:" + session_secret(request))
        actual = request.headers.get("x-csrf-token", "")
        if not actual.isascii() or not hmac.compare_digest(expected, actual):
            raise APIError("CSRF_REJECTED", 403)

    def client_key(request, context=""):
        # Never trust arbitrary X-Forwarded-For headers here. Only Uvicorn's
        # explicitly trusted proxy configuration may establish client.host.
        # Include account/challenge context: a shared Render router/NAT address
        # must not give all customers one tiny login quota. This is a keyed
        # connection+account pseudonym, NOT proof of a verified client IP.
        host = request.client.host if request.client else "unknown"
        return secret_hmac("client:" + host + ":" + context)

    async def call(action, payload):
        configured()
        try:
            return await gateway.call(action, payload)
        except GatewayError as exc:
            raise public_gateway_error(exc) from None

    async def current_account(request):
        data = await call("session", {"session_hash": session_hash(request)})
        try:
            return sanitize_account(data.get("account"))
        except GatewayError:
            raise APIError("SERVICE_UNAVAILABLE", 503) from None

    def authenticated_response(account, secret):
        return {"ok": True, "authenticated": True,
                "csrf_token": secret_hmac("csrf:" + secret), "account": account}

    @app.exception_handler(APIError)
    async def api_error_handler(_request, exc):
        return error(exc.code, exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request, _exc):
        # Never serialize exc.errors(): it can include customer input.
        return error("INVALID_REQUEST", 422)

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(_request, exc):
        return error("NOT_FOUND" if exc.status_code == 404 else "INVALID_REQUEST", exc.status_code)

    @app.exception_handler(Exception)
    async def unexpected_handler(_request, _exc):
        return error("INTERNAL_ERROR", 500)

    @app.get("/health")
    async def health():
        return {"ok": True, "service": "AETERNA Core"}

    @app.get("/ready")
    async def ready():
        configured()
        rates.check(("ready", "global"), 60, 60)
        data = await call("health", {})
        if data.get("mail_ready") is not True:
            raise APIError("MAIL_NOT_READY", 503)
        return {"ok": True, "ready": True, "version": "2026-10-17"}

    @app.get("/api/session")
    async def session(request: Request):
        configured()
        if not request.cookies.get(COOKIE):
            return {"ok": True, "authenticated": False}
        try:
            account = await current_account(request)
        except APIError as exc:
            if exc.status != 401:
                raise
            response = JSONResponse({"ok": True, "authenticated": False})
            response.delete_cookie(COOKIE, path="/", secure=True, httponly=True, samesite="lax")
            return response
        return authenticated_response(account, session_secret(request))

    @app.post("/api/auth/start")
    async def auth_start(body: StartInput, request: Request):
        configured()
        key = client_key(request, body.email)
        rates.check(("start", key), 6, 600)
        rates.check(("start_global", "all"), 120, 600)
        challenge, code = str(uuid4()), f"{secrets.randbelow(100000000):08d}"
        try:
            await call("auth_start", {"email": body.email, "challenge_id": challenge,
                "code_hash": secret_hmac(f"otp:{challenge}:{code}"), "code": code,
                "locale": body.locale, "client_key": key})
        finally:
            code = ""
            body.email = ""
        return {"ok": True, "challenge_id": challenge,
                "message": "If access is available, a one-time code will be sent."}

    @app.post("/api/auth/verify")
    async def auth_verify(body: VerifyInput, request: Request):
        configured()
        rates.check(("verify", client_key(request, body.challenge_id)), 30, 600)
        rates.check(("verify_global", "all"), 240, 600)
        secret = secrets.token_urlsafe(32)
        try:
            data = await call("auth_verify", {"challenge_id": body.challenge_id,
                "code_hash": secret_hmac(f"otp:{body.challenge_id}:{body.code}"),
                "session_hash": hashlib.sha256(secret.encode()).hexdigest()})
            account = sanitize_account(data.get("account"))
        except APIError as exc:
            if exc.status == 401:
                raise APIError("INVALID_CODE", 400) from None
            raise
        except GatewayError:
            raise APIError("SERVICE_UNAVAILABLE", 503) from None
        finally:
            body.code = ""
        response = JSONResponse(authenticated_response(account, secret))
        response.set_cookie(COOKIE, secret, max_age=settings.session_max_age,
                            secure=True, httponly=True, samesite="lax", path="/")
        return response

    @app.post("/api/auth/logout")
    async def logout(_body: EmptyInput, request: Request):
        configured()
        csrf(request)
        owner = session_hash(request)
        # Signal only this session's live work, never another customer's.
        for operation in operations.items.values():
            if hmac.compare_digest(operation.owner, owner) and not operation.done.is_set():
                operation.event.set()
        await call("logout", {"session_hash": owner})
        response = JSONResponse({"ok": True})
        response.delete_cookie(COOKIE, path="/", secure=True, httponly=True, samesite="lax")
        return response

    @app.post("/api/scans")
    async def scan(body: ScanInput, request: Request):
        configured()
        csrf(request)
        owner = session_hash(request)
        rates.check(("scan", owner), 30, 60)
        rates.check(("scan_global", "all"), 300, 60)
        await current_account(request)
        operation = operations.add(body.operation_id, owner)
        reserve_attempted, finalized = False, False
        outcome = "failed"
        result = None
        try:
            reserve_attempted = True
            await call("scan_reserve", {"session_hash": owner, "operation_id": body.operation_id})
            if operation.event.is_set():
                raise ScanCancelled()
            deadline = time.monotonic() + settings.scan_timeout
            result = await asyncio.wait_for(analyzer(body.message, operation.event, deadline,
                request.is_disconnected), timeout=settings.scan_timeout)
            if operation.event.is_set():
                raise ScanCancelled()
            # A result is shown only after the durable credit transaction has
            # been finalized. Never cache a result for replay.
            data = await call("scan_finalize", {"session_hash": owner,
                "operation_id": body.operation_id, "outcome": "completed"})
            finalized = True
            if data.get("state") != "completed":
                outcome = "cancelled"
                raise APIError("SCAN_CANCELLED", 409)
            outcome = "completed"
            account = sanitize_account(data.get("account"))
            return {"ok": True, "operation_id": body.operation_id,
                    "result": result, "account": account}
        except ScanCancelled:
            outcome = "cancelled"
            raise APIError("SCAN_CANCELLED", 409) from None
        except (ScanTimedOut, asyncio.TimeoutError):
            outcome = "failed"
            raise APIError("SCAN_TIMEOUT", 408) from None
        except asyncio.CancelledError:
            outcome = "cancelled"
            operation.event.set()
            raise
        except GatewayError:
            raise APIError("SERVICE_UNAVAILABLE", 503) from None
        finally:
            # Release raw input references; this is not a physical RAM wipe.
            body.message = ""
            result = None
            if reserve_attempted and not finalized:
                try:
                    async def finish():
                        return await gateway.call("scan_finalize", {"session_hash": owner,
                            "operation_id": body.operation_id, "outcome": outcome})
                    cleanup_data = await asyncio.wait_for(asyncio.shield(finish()), timeout=settings.gateway_timeout)
                    # A completion may have committed even if its response was
                    # lost. Preserve the durable truth rather than claiming a
                    # cancellation/refund which did not happen.
                    if cleanup_data.get("state") in {"completed", "cancelled", "failed"}:
                        outcome = cleanup_data["state"]
                except (Exception, asyncio.CancelledError):
                    # Durable reservations expire after 120 seconds even if the
                    # caller/browser/server disappears. No retry with content.
                    pass
            operation.state = outcome
            operation.done.set()

    @app.post("/api/scans/{operation_id}/clear")
    async def clear(operation_id: str, _body: EmptyInput, request: Request):
        configured()
        csrf(request)
        if not UUID4_RE.fullmatch(operation_id):
            raise APIError("INVALID_REQUEST", 422)
        owner = session_hash(request)
        rates.check(("clear", owner), 60, 60)
        operation = operations.own(operation_id, owner)
        verified = False
        reservation_status = "unknown"
        if operation is not None:
            if operation.done.is_set():
                verified = True
                status = "completed" if operation.state == "completed" else "cancelled"
                reservation_status = "completed" if operation.state == "completed" else "cancelled"
            else:
                operation.event.set()
                # Cooperative worker must actually finish before saying it did.
                status = "cancellation_requested"
        else:
            # Recover a reservation after process restart without keeping text.
            # Ownership is rechecked by the durable gateway, never by ID alone.
            try:
                data = await gateway.call("scan_finalize", {"session_hash": owner,
                    "operation_id": operation_id, "outcome": "cancelled"})
                if data.get("state") in {"completed", "cancelled", "failed"}:
                    reservation_status = "completed" if data["state"] == "completed" else "cancelled"
                # A previous worker may still be winding down during a rolling
                # deploy. Durable cancellation is not proof of its termination.
                status = "not_running"
            except GatewayError as exc:
                if exc.code in {"NOT_FOUND", "OPERATION_NOT_FOUND", "UNAUTHORIZED", "SESSION_EXPIRED"}:
                    status = "not_running"
                    reservation_status = "not_found"
                else:
                    raise public_gateway_error(exc) from None
        return {"ok": True, "operation_id": operation_id, "status": status,
                "scope": "application", "platform_logs_deleted": False,
                "worker_termination_verified": verified,
                "reservation_status": reservation_status}

    @app.api_route("/scan", methods=["GET", "POST"])
    async def legacy_scan():
        raise APIError("LEGACY_ENDPOINT_DISABLED", 410)

    web = Path(__file__).resolve().parent / "web"
    if web.is_dir():
        app.mount("/assets", StaticFiles(directory=web), name="assets")

    @app.get("/")
    async def index():
        page = web / "index.html"
        if not page.is_file():
            raise APIError("PORTAL_NOT_INSTALLED", 503)
        return FileResponse(page, media_type="text/html")

    return app


app = create_app()
