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

# No application currently exposes websocket consumers. Register per-app
# ``websocket_urlpatterns`` here when real-time features land (e.g. live
# review notifications), keeping the ASGI entry point importable in the
# meantime.
websocket_urlpatterns: list = []


def get_application():
    """Get the ASGI application after Django is fully initialized."""
    http_application = get_asgi_application()
    websocket_application = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
    return ProtocolTypeRouter(
        {
            "http": http_application,
            "websocket": websocket_application,
        }
    )


application = get_application()
