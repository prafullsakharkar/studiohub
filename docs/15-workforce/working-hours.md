Working Hours & Shifts

Purpose

Define working hours, shifts and break modeling for capacity computation and allocation rules.

Working hours model

- id
- resource_id or calendar_id
- day_of_week
- start_time (HH:MM)
- end_time (HH:MM)
- breaks (list of time ranges)

Shift model

- shift_id
- name
- start_date, end_date
- recurrence rules
- assigned_resources

Notes

- Allow different working hours per resource/timezone and support shift overrides for night/weekend support.
- Avoid encoding country-specific labor law — expose overtime tracking as metadata only.

Next steps

- Add examples for common patterns (9-5, night shift, rotating shifts).