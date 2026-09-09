Contractors — Model & vendor link

Purpose

Define contractor records and integration with Vendor profiles (Part 11) for external engagements.

Recommended fields

- contractor_id UUID
- person_id UUID
- vendor_id UUID (optional)
- contract_reference_id
- contract_start_date
- contract_end_date
- billing_rate_reference (link to RateCard or vendor PO)
- skills JSONB
- availability JSONB
- metadata JSONB

Notes

- Contractors may be managed by VendorProfile; StudioHub may model contractor-level assignments without creating full identity accounts.
- Billing and invoicing details are handled by Commercial (Part 11).

Next steps

- Map existing vendor/person relations in repository and list gaps.