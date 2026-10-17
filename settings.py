"""Configuration only: no production defaults for credentials or account access."""
from dataclasses import dataclass
import os
import re
from urllib.parse import urlsplit


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

    @classmethod
    def from_env(cls):
        # Deliberately one worker and one instance. An in-memory cancellation
        # registry is not cross-process or cross-instance coordination.
        return cls(
            app_origin=os.environ.get("APP_ORIGIN", "").rstrip("/"),
            gateway_url=os.environ.get("GATEWAY_URL", ""),
            gateway_secret=os.environ.get("GATEWAY_SECRET", ""),
            auth_secret=os.environ.get("AUTH_SECRET", ""),
        )

    def errors(self):
        errors = []
        try:
            origin = urlsplit(self.app_origin)
            if (origin.scheme != "https" or not origin.hostname or
                origin.username or origin.password or origin.query or
                origin.fragment or origin.path not in ("", "/") or
                origin.port not in (None, 443)):
                errors.append("APP_ORIGIN")
        except ValueError:
            errors.append("APP_ORIGIN")
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
