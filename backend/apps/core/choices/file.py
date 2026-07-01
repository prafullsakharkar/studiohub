from .base import BaseChoices


class FileType(BaseChoices):

    IMAGE = "image", "Image"

    VIDEO = "video", "Video"

    AUDIO = "audio", "Audio"

    DOCUMENT = "document", "Document"

    CACHE = "cache", "Cache"

    SCRIPT = "script", "Script"
