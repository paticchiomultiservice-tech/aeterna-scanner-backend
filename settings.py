"""Configuration only: no production defaults for credentials or account access."""
from dataclasses import dataclass
import ipaddress
import json
import os
import re
from urllib.parse import urlsplit


def exact_https_origin(value):
    """Validate an explicit serialized HTTPS origin; never derive one from Host."""
    if (type(value) is not str or not 1 <= len(value) <= 2048 or
            not value.isascii() or any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in value) or
            any(c in value for c in ("*", "\\", "?", "#", "%")) or
            not value.startswith("https://")):
        return False
    try:
        origin = urlsplit(value)
        if (origin.scheme != "https" or not origin.hostname or
                origin.username is not None or origin.password is not None or
                origin.path != "" or origin.query or origin.fragment or
                origin.port not in (None, 443)):
            return False
        hostname = origin.hostname
        try:
            ipaddress.ip_address(hostname)
        except ValueError:
            if (len(hostname) > 253 or
                    any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label)
                        for label in hostname.split("."))):
                return False
        # urlsplit accepts an empty trailing port. It is not a serialized origin.
        if origin.netloc.endswith(":"):
            return False
    except ValueError:
        return False
    return True


def additional_origins_from_env(raw):
    """Empty is disabled; malformed JSON remains invalid rather than falling back."""
    if raw == "":
        return ()
    try:
        values = json.loads(raw)
    except (ValueError, TypeError):
        return None
    return tuple(values) if type(values) is list else None


@dataclass(frozen=True)
class Settings:
    app_origin: str = ""
    gateway_url: str = ""
    gateway_secret: str = ""
    auth_secret: str = ""
    gateway_timeout: float = 15.0
    scan_timeout: float = 8.0
    operation_ttl: int = 300
    max_operations: int = 1000
    session_max_age: int = 43200
    max_body_bytes: int = 131072
    # Add at the end to preserve existing constructor argument positions.
    # None denotes malformed configuration and makes origin checks fail closed.
    additional_origins: tuple[str, ...] | None = ()

    @classmethod
    def from_env(cls):
        # Deliberately one worker and one instance. An in-memory cancellation
        # registry is not cross-process or cross-instance coordination.
        return cls(
            app_origin=os.environ.get("APP_ORIGIN", "").rstrip("/"),
            gateway_url=os.environ.get("GATEWAY_URL", ""),
            gateway_secret=os.environ.get("GATEWAY_SECRET", ""),
            auth_secret=os.environ.get("AUTH_SECRET", ""),
            additional_origins=additional_origins_from_env(
                os.environ.get("APP_ADDITIONAL_ORIGINS_JSON", "")),
        )

    def origin_errors(self):
        errors = []
        if not exact_https_origin(self.app_origin):
            errors.append("APP_ORIGIN")
        values = self.additional_origins
        if (type(values) is not tuple or len(values) > 8 or
                any(not exact_https_origin(value) for value in values)):
            errors.append("APP_ADDITIONAL_ORIGINS_JSON")
        elif len(set(values)) != len(values):
            errors.append("APP_ADDITIONAL_ORIGINS_JSON")
        return errors

    def origin_allowed(self, origin):
        if self.origin_errors() or not exact_https_origin(origin):
            return False
        return origin == self.app_origin or origin in self.additional_origins

    def errors(self):
        errors = self.origin_errors()
        if not re.fullmatch(r"https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec", self.gateway_url):
            errors.append("GATEWAY_URL")
        for name, value in (("GATEWAY_SECRET", self.gateway_secret), ("AUTH_SECRET", self.auth_secret)):
            if (not 43 <= len(value) <= 256 or not value.isascii() or any(c.isspace() for c in value)
                or any(marker in value.lower() for marker in ("replace", "changeme", "example", "inserire"))):
                errors.append(name)
        if self.gateway_secret == self.auth_secret:
            errors.append("SECRETS_MUST_DIFFER")
        if os.environ.get("WEB_CONCURRENCY", "1") != "1":
            errors.append("SINGLE_WORKER_REQUIRED")
        if not 1 <= self.scan_timeout <= 30:
            errors.append("SCAN_TIMEOUT")
        return list(dict.fromkeys(errors))
