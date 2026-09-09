Commercial Schemas — Canonical DB & JSON Schemas

This document provides canonical sketches for DB tables and JSON schemas for core commercial entities. These are intended as a starting point for engineering and mapping to existing backend models/migrations.

Guidelines

- Use UUID PKs for cross-service stability.
- Monetary amounts: use DECIMAL(20, 6) or application-level decimal type and store currency code separately.
- Use JSONB for flexible metadata where needed but model heavy fields as columns for indexing (status, currency, created_at, organization_id).
- Include created_by/updated_by and audit trail references.

1) Contract (DB sketch)

Table: commercial_contract
- id UUID PK
- organization_id UUID (the owning organization)
- contract_number TEXT (unique within organization)
- title TEXT
- status TEXT (draft|negotiation|pending_approval|active|suspended|expired|terminated)
- effective_date DATE
- expiry_date DATE
- currency CHAR(3)
- total_amount DECIMAL(20,6)
- parties JSONB (client, vendor, signatories)
- terms TEXT (or attachment reference)
- attachments JSONB (list of storage refs)
- version INTEGER
- previous_version UUID nullable
- created_at TIMESTAMP
- created_by UUID
- approved_at TIMESTAMP nullable
- approved_by UUID nullable
- metadata JSONB

JSON Schema (contract.json)
{
  "$id": "https://studiohub/docs/schemas/contract.json",
  "type": "object",
  "required": ["id","organization_id","contract_number","status","currency","version"],
  "properties": {
    "id": {"type":"string","format":"uuid"},
    "organization_id": {"type":"string","format":"uuid"},
    "contract_number": {"type":"string"},
    "title": {"type":"string"},
    "status": {"type":"string"},
    "effective_date": {"type":"string","format":"date"},
    "expiry_date": {"type":"string","format":"date"},
    "currency": {"type":"string","maxLength":3},
    "total_amount": {"type":"string","pattern":"^\\d+(.\\d+)?$"},
    "version": {"type":"integer"},
    "previous_version": {"type":"string","format":"uuid"},
    "attachments": {"type":"array","items":{"type":"object"}}
  }
}

Indexes: organization_id, contract_number (unique per organization), status, effective_date

2) Estimate (DB sketch)

Table: commercial_estimate
- id UUID PK
- project_id UUID nullable
- organization_id UUID
- estimate_number TEXT
- version INTEGER
- status TEXT (draft|submitted|under_review|approved|rejected|superseded|expired)
- currency CHAR(3)
- total_amount DECIMAL(20,6)
- lines JSONB (array of estimate lines with category, qty, unit, rate, amount)
- assumptions TEXT
- created_at, created_by, approved_at, approved_by
- metadata JSONB

JSON Schema (estimate.json) — similar to contract schema; ensure lines schema defined

3) Invoice (DB sketch)

Table: commercial_invoice
- id UUID PK
- organization_id UUID (invoice issuer organization)
- client_account_id UUID (the billed client account)
- invoice_number TEXT (unique per issuing org/fiscal rules)
- project_id UUID nullable
- status TEXT (draft|pending_approval|approved|issued|partially_paid|paid|overdue|void|cancelled)
- invoice_date DATE
- due_date DATE
- currency CHAR(3)
- subtotal DECIMAL(20,6)
- tax DECIMAL(20,6)
- total DECIMAL(20,6)
- lines JSONB
- payments JSONB (or separate payment link table)
- related_contract_id UUID nullable
- created_at, created_by
- immutable_when_issued BOOLEAN (true)
- metadata JSONB

JSON Schema (invoice.json)
- id, invoice_number, client_account_id, invoice_date, due_date, currency, total, status, lines

Index: client_account_id, invoice_number, status, due_date

4) PurchaseOrder (DB sketch)

Table: commercial_purchaseorder
- id UUID PK
- po_number TEXT
- vendor_id UUID
- project_id UUID nullable
- status TEXT (draft|pending_approval|approved|issued|received|closed|cancelled)
- currency CHAR(3)
- total_amount DECIMAL(20,6)
- lines JSONB
- created_at, approved_at, created_by, approved_by
- metadata JSONB

5) TimeEntry / Timesheet

Table: commercial_timeentry
- id UUID PK
- user_id UUID
- project_id UUID nullable
- task_id UUID nullable
- date DATE
- duration_minutes INTEGER
- duration_decimal DECIMAL(10,4) (hours)
- billing_classification TEXT (billable|non-billable|internal)
- internal_cost_rate_id UUID nullable
- billing_rate_id UUID nullable
- cost_amount DECIMAL(20,6)
- created_at, updated_at, submitted_at, approved_at
- status TEXT (draft|submitted|approved|rejected|locked)
- notes TEXT
- metadata JSONB

6) RateCard

Table: commercial_ratecard
- id UUID PK
- organization_id UUID
- name TEXT
- effective_from DATE
- effective_to DATE nullable
- rates JSONB (array of rate entries: service, unit, amount, currency)
- version INTEGER
- created_at, created_by

7) Budget

Table: commercial_budget
- id UUID PK
- project_id UUID
- contract_id UUID nullable
- currency CHAR(3)
- baseline_amount DECIMAL(20,6)
- current_amount DECIMAL(20,6)
- forecast_amount DECIMAL(20,6)
- components JSONB (breakdown by category)
- version INTEGER
- status TEXT (draft|approved|revised)
- created_at, approved_at

8) Payment

Table: commercial_payment
- id UUID PK
- organization_id UUID
- invoice_id UUID nullable
- payment_date DATE
- amount DECIMAL(20,6)
- currency CHAR(3)
- payment_method TEXT (bank_transfer|card|stripe|paypal|check|other)
- external_reference TEXT
- reconciliation_status TEXT (unreconciled|reconciled|disputed)
- metadata JSONB

Canonical JSON types

- money: represent monetary amounts as strings or structured objects {amount: "123.45", currency: "USD"} to avoid floating issues in JSON transport.

Example money object
{
  "amount":"12345.67",
  "currency":"USD"
}

Audit & Append-only patterns

- For authoritative financial records (invoices, issued POs, payments), maintain an audit table (commercial_audit) capturing change events (who, when, delta) and a version pointer on primary records.

Next steps for engineers

1. Map these sketches to existing migrations and models found in the repository and add missing columns/tables via migrations.
2. Confirm money precision and DB types with DBA/Finance.
3. Draft API surface for CRUD and state transitions and add OpenAPI fragments for schema enforcement.

