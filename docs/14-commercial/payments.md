Payments & Reconciliation

Purpose

Define payment records, reconciliation workflows, and external payment integrations.

Model Highlights

- payment_id
- invoice_id(s)
- amount
- currency
- payment_date
- payment_method
- external_reference (gateway transaction id)
- reconciliation_status (unreconciled|reconciled|disputed)
- fees_amount (if any)

Reconciliation

- Support manual and automatic reconciliation flows (matching by external reference and amounts).
- Record reconciliation events in audit trail.

Integrations

- Payment gateways (Stripe, Braintree), bank integrations, and manual entry.
- For incoming payments, attach proof (bank statement reference or receipt) and store metadata.

Next steps

- Create payment adapters and a reconciliation dashboard for finance users.