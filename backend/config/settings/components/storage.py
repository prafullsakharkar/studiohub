"""
Media storage.
"""

from config.env import BASE_DIR, settings

MEDIA_URL = "/media/"

MEDIA_ROOT = BASE_DIR / "media"

# Directories the app server can read, by publishing StorageRoot code (see config/env.py).
PUBLISHING_STORAGE_MOUNTS = {
    code.upper(): path for code, path in settings.publishing_storage_mounts.items()
}

# ---------------------------------------------------------------------------
# Attachments (core.Attachment): what may be uploaded and how it leaves again.
# ---------------------------------------------------------------------------

# Largest accepted upload, in bytes.
ATTACHMENT_MAX_BYTES = 512 * 1024 * 1024

# Lower-case extensions accepted for upload. Anything else, and any file without an extension,
# is refused. Web-active formats (html, svg, xml, js) are deliberately absent.
ATTACHMENT_ALLOWED_EXTENSIONS = frozenset(
    {
        # images and plates
        "jpg", "jpeg", "png", "gif", "webp", "tif", "tiff", "bmp", "exr", "dpx", "psd", "hdr",
        # video
        "mp4", "mov", "m4v", "mxf", "avi", "mkv", "webm",
        # audio
        "wav", "mp3", "aac", "flac", "m4a", "aif", "aiff",
        # documents
        "pdf", "txt", "md", "csv", "rtf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
        # caches, scenes and colour data
        "abc", "usd", "usda", "usdc", "usdz", "obj", "fbx", "ocio", "cube", "lut", "3dl", "cdl",
        # bundles
        "zip",
    }
)  # fmt: skip

# What one user may hold in live attachments, in bytes. An upload past it is refused.
ATTACHMENT_USER_QUOTA_BYTES = 5 * 1024 * 1024 * 1024

# How long a download link stays valid after it was issued.
ATTACHMENT_LINK_TTL_SECONDS = 300

# nginx ``internal`` location that maps to MEDIA_ROOT; empty = Django streams the file.
MEDIA_ACCEL_PREFIX = settings.media_accel_prefix.rstrip("/")
