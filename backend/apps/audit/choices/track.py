"""
Track choices.
"""
from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _


class TrackEventType(models.TextChoices):
    """
    Track event types.
    """
    
    PAGE_VIEW = "page_view", _("Page View")
    CLICK = "click", _("Click")
    FORM_SUBMIT = "form_submit", _("Form Submit")
    SEARCH = "search", _("Search")
    FILTER = "filter", _("Filter")
    SORT = "sort", _("Sort")
    EXPORT = "export", _("Export")
    IMPORT = "import", _("Import")
    DOWNLOAD = "download", _("Download")
    UPLOAD = "upload", _("Upload")
    CUSTOM = "custom", _("Custom")
