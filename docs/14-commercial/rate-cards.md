Rate Cards — Definition & Precedence

Purpose

Rate cards define the cost and billing rates used for time, services, and other chargeable items.

Key rules

- Rate types: hourly, daily, per_shot, per_asset, per_frame, fixed, percentage.
- Rate precedence (priority): Contract Rate > Project Rate > Client Rate Card > Organization Default Rate.
- Versioning: rates are time-bound (effective_from, effective_to) and versioned. Historical calculations must use the rate effective at the transaction date.

Rate entries

- service_code
- unit
- amount (decimal string)
- currency
- effective_from, effective_to
- metadata (e.g., skill level, department)

Next steps

- Implement rate lookups with effective date resolution and precedence rules.
- Add UI for editing and versioning rate cards with audit logs.