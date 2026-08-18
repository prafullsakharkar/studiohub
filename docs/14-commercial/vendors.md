Vendor model — Overview

Purpose

Defines VendorProfile and vendor capabilities: services offered, regions, capacity, rate cards, contacts, and performance metrics.

Key concepts

- VendorProfile represents an external organization that can provide services (VFX, Roto, Paint, Render Farm, Transfer Provider).
- VendorRateCard: vendor-specific rates, currency, and availability windows.
- Vendor Performance: track on-time delivery, quality, revision rate, cost variance.

Fields & recommended storage

- vendor_id UUID
- organization_id UUID
- services JSONB (list of departments/services)
- regions JSONB
- rate_cards JSONB or relation
- contacts JSONB
- attachments
- performance_metrics JSONB

Security & privacy

- Vendor profiles include sensitive commercial terms and must be limited to Finance and Procurement roles.

Next steps

- Create procurement workflows: PO creation, vendor onboarding, vendor approval process.
- Map existing code (if any) for vendor models and PO handling and add gaps to the implementation todo list.