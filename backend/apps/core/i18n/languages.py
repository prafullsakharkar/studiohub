import pycountry

LANGUAGES = tuple(
    sorted(
        (
            language.alpha_2,
            language.name,
        )
        for language in pycountry.languages
        if hasattr(language, "alpha_2")
    )
)
