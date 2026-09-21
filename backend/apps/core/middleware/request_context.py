"""
Thread-local current-request access.

Lets model signals (e.g. audit change tracking) attribute writes to the
calling user without threading ``request`` through every service layer.
Request-scoped: always cleared after the response so state never leaks
between requests (including async contexts via ``asgiref.local``).
"""

from __future__ import annotations

from typing import Any

try:
    from asgiref.local import Local

    _state = Local()
except Exception:  # pragma: no cover - asgiref always present with Django
    import threading

    _state = threading.local()  # type: ignore[assignment]


def get_current_request() -> Any | None:
    """Return the request being served on this thread/task, if any."""
    return getattr(_state, "request", None)


def get_current_user() -> Any | None:
    """Return the authenticated user for the current request, if any."""
    request = get_current_request()
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    return user


class RequestContextMiddleware:
    """Expose the current request to thread-local storage for signals."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _state.request = request
        try:
            return self.get_response(request)
        finally:
            _state.request = None
