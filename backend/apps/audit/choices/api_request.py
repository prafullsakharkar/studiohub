"""
API Request choices.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _


class HttpMethod(models.TextChoices):
    """
    HTTP methods.
    """
    
    GET = "GET", _("GET")
    POST = "POST", _("POST")
    PUT = "PUT", _("PUT")
    PATCH = "PATCH", _("PATCH")
    DELETE = "DELETE", _("DELETE")
    OPTIONS = "OPTIONS", _("OPTIONS")
    HEAD = "HEAD", _("HEAD")


class ApiStatusCategory(models.TextChoices):
    """
    API status categories.
    """
    
    SUCCESS = "success", _("Success")
    CLIENT_ERROR = "client_error", _("Client Error")
    SERVER_ERROR = "server_error", _("Server Error")
