import pycountry

CURRENCIES = tuple(
    sorted(
        (
            currency.alpha_3,
            f"{currency.alpha_3} - {currency.name}",
        )
        for currency in pycountry.currencies
        if hasattr(currency, "alpha_3")
    )
)
