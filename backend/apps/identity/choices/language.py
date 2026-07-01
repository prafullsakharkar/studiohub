from django.db import models


class Language(models.TextChoices):
    ENGLISH = "en", "English"
    HINDI = "hi", "Hindi"
    JAPANESE = "ja", "Japanese"
    CHINESE = "zh", "Chinese"
    KOREAN = "ko", "Korean"
