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
