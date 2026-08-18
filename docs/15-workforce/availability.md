Availability — Windows, Exceptions & Precedence

Purpose

Document how availability is modeled, precedence of calendars, and how availability affects capacity calculations.

Availability window

- resource_id
- start_datetime
- end_datetime
- availability_percent (0-100)
- availability_type (available|unavailable|partial)
- reason (meeting|training|leave|other)
- status (draft|approved)

Calendar precedence (high-level)

1. Resource Calendar/Overrides
2. Project Calendar (if set)
3. Team Calendar
4. Department Calendar
5. Organization Calendar
6. Default Working Hours

Notes

- Availability windows should be combinable: a resource-level exception (leave) can override a higher-scope working calendar.
- For cross-timezone resources store start/end in UTC and include resource timezone for display.

Next steps

- Define API responses for availability resolver and integrate with allocation conflict detector.