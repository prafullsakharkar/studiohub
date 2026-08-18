# Delivery Domain

## Purpose

Delivery models the packaging and transfer of final content to external recipients (clients, vendors, archives). Delivery is a business process with specifications, recipients, manifests, and compliance checks.

## Responsibilities

- Create deliverable packages with defined specifications
- Track delivery status and confirmations
- Manage recipients and destination endpoints (SFTP, cloud, physical media)
- Produce manifests and checksums for auditability

## Key entities

- Deliverable (collection of publishes/versions with a specification)
- DeliveryPackage (file set and metadata)
- Recipient (client contact, vendor contact)
- DeliveryStatus (pending, in_progress, delivered, failed)

## Lifecycle

Prepared → InTransit → Delivered → Confirmed → Archived

## Events

- DeliveryRequested
- DeliveryStarted
- DeliveryCompleted
- DeliveryFailed

## Ownership & permissions

- Create delivery: Producers or designated Delivery Coordinators
- Confirm delivery: Client or receiving party
- Reconcile: Finance/Producer for contractual reconciliation

## Notes

- Delivery often includes packaging rules (codecs, burn-ins, LTO/archival formats) — these are implementation-level policies configured per production or customer.
- Keep delivery manifests auditable and immutable after completion.
