Part 11 — Commercial & Financial Operations — Overview

Purpose

This section defines StudioHub's Commercial and Financial bounded context: client & vendor management, contracts, estimates, bids, budgets, rate cards, cost tracking, time tracking, purchase orders, invoices, payments, financial reporting, and integrations. It documents domain ownership, key concepts, event mapping, and implementation guidance for safe adoption into StudioHub.

Scope

- Conceptual domain model and API contracts for commercial entities (Client, Vendor, Contract, Estimate, Budget, PO, Invoice, Payment, TimeEntry, RateCard).
- Operational guidance: approvals, immutability, versioning, retention, permissions and security.
- Integration guidance: ERP/accounting connectors, payment provider adapters, and export formats.

Non-goals

- Replacing ERP or accounting systems.
- Implementing payroll, tax filing, or banking systems.

Principles & constraints

- Commercial data is a separate bounded context from production execution; do not tightly couple production models (Task/Shot) to financial ledgers.
- Financial amounts use fixed decimal precision; never use floating point.
- Records that are commercially authoritative (issued invoices, approved POs, payments) are versioned and restricted from silent mutation.
- Events from the commercial domain are published via the platform event architecture and integrate with notifications and activity (Parts 3 & 10).

Recommended structure (this folder)

- domain-model.md — conceptual model and relationships
- commercial-schemas.md — canonical DB and JSON schemas for core entities
- clients.md — client model, contact roles, account settings
- vendors.md — vendor model, capabilities and vendor profiles
- contracts.md — contract lifecycle, versioning, amendments
- estimates.md — internal estimates vs client bids
- budgets.md — budgets, baseline, forecasts
- rate-cards.md — rate cards and precedence rules
- time-tracking.md — time entry/timesheet model and approvals
- purchase-orders.md — PO lifecycle and lines
- invoices.md — client invoice model, numbering, status
- payments.md — payment model & reconciliation guidance
- financial-reporting.md — recommended reports and snapshots
- integrations.md — ERP/payment integration guidance
- security.md — commercial data protections and permissions
- diagrams/ — domain diagrams and flowcharts

Next steps

1. Review these canonical schemas with Finance stakeholders (CFO/Producer) for business rule validation.
2. Run code ↔ docs gap analysis to identify existing backend models and necessary API endpoints.
3. Draft ADRs for Money representation, Financial immutability and System-of-Record definitions.
