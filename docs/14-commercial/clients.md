Client model — Overview

Purpose

Defines what a Client is in StudioHub: an Organization with a client relationship, billing terms, contacts, and visibility into permitted projects and deliverables.

Key concepts

- Organization vs ClientAccount: An Organization is the legal/business entity. A ClientAccount represents the billing settings and relationship for that organization in StudioHub.
- Client Contacts: role-based contacts (Client Executive, Producer, Finance Contact, Review Coordinator) with communication preferences.
- Client Visibility: explicit authorization per project and per commercial record; clients only see permitted items.

Fields and settings (recommendation)

- client_account_id UUID
- organization_id UUID
- default_currency CHAR(3)
- billing_terms TEXT (Net30, Net45, milestone-based)
- payment_terms TEXT
- tax_id TEXT
- credit_limit DECIMAL nullable
- contacts JSONB
- allowed_projects JSONB or relation
- attachments (signed contracts) stored via storage refs

Security

- Clients can access only their invoices, proposals submitted to them, and review items explicitly shared.
- Do not expose internal cost rates or vendor costs to clients unless contractually permitted.

Next steps

- Create UI mockups for client billing portal (invoices, payments, statements).
- Map existing repository references for Client/Organization models and link to commercial-schemas.md.