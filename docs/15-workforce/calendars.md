Calendars — Architecture & Rules

Purpose

Define calendar scopes, rules, exceptions, and how calendars feed capacity calculations.

Calendar scopes

- Organization
- Department
- Team
- Project
- Resource

Calendar model

- calendar_id UUID
- scope_type (org|dept|team|project|resource)
- scope_id
- working_days (Mon..Sun)
- working_hours (start, end, breaks)
- holidays (list)
- exceptions (list of date ranges and overrides)

Precedence

Resource-specific calendars override higher-scope calendars. Exceptions are applied after base rules.

Next steps

- Provide example calendar payloads and merge algorithm pseudocode for capacity calculation.