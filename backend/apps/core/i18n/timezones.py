from zoneinfo import available_timezones

TIMEZONES = tuple(
    sorted(
        (
            timezone,
            timezone,
        )
        for timezone in available_timezones()
    )
)
