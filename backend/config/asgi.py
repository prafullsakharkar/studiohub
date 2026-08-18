"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings.local",
)

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application


def get_websocket_urlpatterns():
    """Lazy import of websocket patterns to avoid circular imports."""
    from apps.tournament.routing import websocket_urlpatterns

    return websocket_urlpatterns


def get_application():
    """Get the ASGI application after Django is fully initialized."""
    http_application = get_asgi_application()
    websocket_application = AuthMiddlewareStack(URLRouter(get_websocket_urlpatterns()))
    return ProtocolTypeRouter(
        {
            "http": http_application,
            "websocket": websocket_application,
        }
    )


application = get_application()
