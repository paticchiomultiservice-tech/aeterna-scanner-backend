"""Authenticated Render -> Apps Script transport. Never log envelopes/responses."""
import asyncio
import hashlib
import hmac
import json
import secrets
import time
from urllib.parse import urlsplit

import httpx


class GatewayError(Exception):
    def __init__(self, code="GATEWAY_UNAVAILABLE"):
        self.code = code
        # No provider error messages, request payloads, URLs or exception text.
        super().__init__(code)


class Gateway:
    def __init__(self, settings, transport=None):
        self.settings = settings
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(settings.gateway_timeout, connect=5.0),
            follow_redirects=False, transport=transport, trust_env=False,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=5),
        )

    async def close(self):
        await self.client.aclose()

    async def _request(self, method, url, **kwargs):
        # Bound the decoded response before buffering.
        async with self.client.stream(method, url, **kwargs) as response:
            body = bytearray()
            async for chunk in response.aiter_bytes():
                if len(body) + len(chunk) > 262144:
                    raise GatewayError()
                body.extend(chunk)

            # HTTPX has already decoded the response content.
            headers = response.headers.copy()
            for name in ("Content-Encoding", "Content-Length", "Transfer-Encoding"):
                headers.pop(name, None)

            return httpx.Response(
                response.status_code,
                headers=headers,
                content=bytes(body),
                request=response.request,
            )

    async def call(self, action, payload):
        encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        ts, nonce = int(time.time()), secrets.token_hex(16)
        signed = f"1\n{ts}\n{nonce}\n{action}\n{encoded}"
        signature = hmac.new(self.settings.gateway_secret.encode("utf-8"), signed.encode("utf-8"), hashlib.sha256).hexdigest()
        envelope = {"v": 1, "ts": ts, "nonce": nonce, "action": action, "payload": encoded, "signature": signature}
        try:
            # A total deadline also bounds redirect chains/slow trickle reads;
            # the per-socket httpx timeouts alone do not bound the whole call.
            async with asyncio.timeout(self.settings.gateway_timeout):
                response = await self._request("POST", self.settings.gateway_url, json=envelope)
                # Apps Script ContentService redirects the already-produced
                # response. Never resend the signed POST to a redirect.
                for _ in range(3):
                    if response.status_code not in (302, 303):
                        break
                    location = response.headers.get("location", "")
                    parsed = urlsplit(location)
                    if (parsed.scheme != "https" or parsed.hostname not in
                        ("script.googleusercontent.com", "script.google.com") or
                        parsed.username or parsed.password or parsed.port not in (None, 443)):
                        raise GatewayError()
                    response = await self._request("GET", location)
                if response.status_code != 200:
                    raise GatewayError()
                data = response.json()
            if not isinstance(data, dict) or type(data.get("ok")) is not bool:
                raise GatewayError()
            if not data["ok"]:
                code = data.get("error", {}).get("code", "GATEWAY_UNAVAILABLE")
                if not isinstance(code, str) or len(code) > 64 or not code.replace("_", "").isalnum():
                    code = "GATEWAY_UNAVAILABLE"
                raise GatewayError(code)
            return data
        except GatewayError:
            raise
        except (asyncio.TimeoutError, httpx.HTTPError, ValueError, TypeError, AttributeError):
            raise GatewayError() from None
