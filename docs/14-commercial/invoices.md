Invoices — Issuance, numbering, and immutability

Purpose

Define invoice records, state transitions, numbering strategy, and immutability/correction patterns.

Model Highlights

- invoice_number: unique per issuing org; consider fiscal year prefix or organization scope
- status: draft|pending_approval|approved|issued|partially_paid|paid|overdue|void|cancelled
- invoice_date, due_date
- lines: description, qty, unit_price, tax, total
- taxes: breakdown per jurisdiction
- related_contract_id
- payments: list of payment allocations or separate payments table

Numbering

- Define organization-scoped numbering convention; do not bake fiscal logic into core model; provide pluggable numbering strategies.

Immutability & corrections

- Issued invoices should be immutable; corrections handled via credit notes or reversal invoices with explicit references.

Next steps

- Draft API endpoints for invoice issuance, preview, and PDF rendering.
- Add workflow for credit notes and refunds.