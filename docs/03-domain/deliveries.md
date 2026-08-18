# Delivery Domain — Packages, Validation & Acknowledgement

Generated: 2026-08-18T12:27:15+05:30

Purpose
-------
Defines Delivery domain: how publishes and assets are packaged, validated, and delivered to external recipients with tracking and acknowledgement.

Canonical definition
--------------------
A Delivery represents the act of packaging one or more publishes (or versions) for external consumption and recording the transfer, validation, and acknowledgement lifecycle.

Key attributes
--------------
- id (UUID)
- production_id, project_id
- items: list of {publish_id, version_id, asset_id, description}
- package_manifest (file list, checksums)
- recipient (client or vendor info)
- carrier (transfer method: S3, Aspera, physical drive)
- status (pending|in_transit|delivered|acknowledged|failed)
- tracking_reference
- created_by, created_at, delivered_at, acknowledged_at

Delivery lifecycle
------------------
- prepare → package → transfer → delivered → acknowledged

Validation
----------
- Validate manifest checksums and presence of required files
- Validate licensing and embargo rules

Acknowledgement
---------------
- Record recipient confirmation and any discrepancy notes
- Support automated ACK via webhook or manual confirmation

API & Selectors
---------------
- POST /api/v1/deliveries/prepare/
- POST /api/v1/deliveries/confirm/
- DeliverySelector.by_recipient(recipient_id)

Events
------
Emit: DeliveryPrepared, DeliveryTransferred, DeliveryAcknowledged

Testing
-------
- End-to-end delivery simulation with mocked transfer endpoints
- Manifest integrity verification tests

End of Deliveries document.
