Commercial Data Security & Permissions

Purpose

Document security controls required for commercial data: contracts, invoices, payments, and PII in commercial attachments.

Key controls

- Role-based access control (Finance, Procurement, Producer, Executive). Commercial-specific roles must be distinct from production roles.
- Project scoping: commercial records should be scoped by organization and project; client-facing visibility must be explicitly granted.
- Data encryption: encrypt sensitive attachments at rest using storage encryption and maintain access logs.
- Audit trails: every change to commercial authoritative records must be logged with who/when/what.
- Secrets handling: credentials for payment gateways and ERP integrations must be stored in encrypted vault (don’t store in plaintext in DB or repos).

Template & Document redaction

- When sending contract attachments or invoices, ensure any PII is handled per privacy policy; provide redaction APIs for exports if required.

Next steps

- Map commercial roles to existing auth/permissions model and add commercial-specific permissions.
- Draft retention and data deletion policies with legal/finance.