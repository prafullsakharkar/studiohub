Commercial Domain — Conceptual Model (Part 11)

Overview

This document captures the conceptual model for StudioHub's Commercial bounded context and recommended relationships to Production. It is intentionally domain-first and implementation-agnostic.

Top-level Entities

- Organization
  - Represents an independent legal entity. Can act as Client, Vendor, Partner, or internal Organization.

- ClientAccount
  - Links an Organization to commercial settings for client billing: default currency, payment terms, tax info, billing contacts, credit terms.

- VendorProfile
  - Represents an external supplier organization with capabilities, rate cards, contacts, and region/service metadata.

- Contract
  - Master commercial agreement (MSA, SOW). Versioned and append-only once approved. Links to ClientAccount or VendorProfile and Projects. Contains contract lines, rates, currency, effective/expiry dates.

- Estimate
  - Internal cost projection for a proposed scope. Versioned. Not necessarily client-facing. Distinct from Bid.

- Bid / Proposal
  - Client-facing commercial proposal derived from one or more Estimates. Contains pricing, timeline, assumptions, and acceptance criteria.

- Budget
  - Approved financial plan for a Project. May have versions (baseline, revised baseline, forecast). Linked to Contract and Project.

- RateCard
  - Effective rate definitions (internal cost, billing rate) with time validity and versioning.

- TimeEntry / Timesheet
  - Per-user labour entries with project/task association, duration, billing classification and approval state.

- PurchaseOrder (PO)
  - Represents a procurement commitment, contains PO lines, linked to VendorProfile and Project, and indicates committed cost.

- Invoice
  - Billing document issued to Client (or received from Vendor) with lines, taxes, totals, currency and immutable issued state.

- Payment
  - Record of payment (incoming/outgoing) linked to Invoice(s) and external payment references. Includes reconciliation status.

- Cost / CostLine
  - Atomic monetary cost associated with Project/Task/Shot (labour cost, vendor cost, render cost, expense). Costs accumulate for rollups.

Relationships & Principles

- Separation of concerns: Production domain (Task, Shot, Asset) emits events that link to commercial records via identifiers but do not embed financial calculations.

- Linking model: Tasks/Shots/Assets may reference a commercial allocation (BudgetLine, CostCenter, ChargeCode) — a pointer to commercial entities rather than embedding invoice/ledger fields.

- Versioning & Immutability: Contracts, Estimates, Budgets, Invoices and issued POs use versioning and append-only policies. Auditable change logs must be available.

- Currency & Money: All monetary values stored as decimal with currency code. Exchange rates are stored as versioned records for historical calculations.

- Approvals: Approvals for Estimates, Budgets, POs, and Invoices are auditable and have state transitions. Once approved, the authoritative record cannot be silently modified (adjustments via credit notes or amendment records).

Event Mapping (examples)

- Estimate.approved -> publishes commercial.estimate.approved with estimate_id, project_id, totals
- Contract.signed -> commercial.contract.signed -> may trigger budget creation and project billing milestones
- PO.approved -> commercial.po.approved -> creates committed cost entries
- Invoice.issued -> commercial.invoice.issued -> triggers AR ledger and notification to billing contacts
- Payment.received -> commercial.payment.received -> marks invoice(s) partially/fully paid and triggers reconciliation

Permissions & Visibility

- Client-facing commercial docs must be restricted in UI: clients see their invoices, accepted bids, and permitted contract attachments, but not internal costs or vendor cost details unless explicitly authorized.

- Internal roles (Finance, Producer, Exec) have elevated commercial visibility; commercial permissions are separate from production permissions.

Next steps

- Validate model fields and relationships with Finance/Producer stakeholders.
- Create canonical DB/JSON schemas (commercial-schemas.md) for engineers.
- Run repository search to map existing models/migrations to this model (code ↔ docs gap analysis).