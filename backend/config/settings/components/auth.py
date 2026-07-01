"""
Authentication settings.
"""

AUTH_USER_MODEL = "identity.User"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": (
            "django.contrib.auth.password_validation." "UserAttributeSimilarityValidator"
        )
    },
    {"NAME": ("django.contrib.auth.password_validation." "MinimumLengthValidator")},
    {"NAME": ("django.contrib.auth.password_validation." "CommonPasswordValidator")},
    {"NAME": ("django.contrib.auth.password_validation." "NumericPasswordValidator")},
]
