from zoneinfo import available_timezones

TIMEZONE_CHOICES = sorted(
    [(tz, tz) for tz in available_timezones()],
    key=lambda x: x[0],
)
