Purchase Orders (PO) — Procurement & Commitments

Purpose

Define PO model, approval lifecycle, PO lines, and how POs create committed cost entries.

Model Highlights

- PO number
- vendor_id
- project_id
- status (draft|pending_approval|approved|issued|received|closed|cancelled)
- lines: each with description, qty, unit_price, currency, account code
- total_amount

Lifecycle

- Draft -> Pending Approval -> Approved -> Issued -> Received -> Closed

Committed cost

- Approved POs create committed cost records that reserve budget but do not mark actual costs until an invoice is received and matched.

Next steps

- Add 2-step approval for large POs and PO change/amendment flows.
- Implement 3-way match guidance (PO, Receipt, Invoice) for reconciliation.