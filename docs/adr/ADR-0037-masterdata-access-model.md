# ADR-0037: Masterdata Access Model (Field-Level Gating and Write Permissions)

- **Status:** Accepted
- **Date:** 2026-10-23
- **Decision Makers:** Architecture Team (decisions recorded in `docs/masterdata/DECISIONS.md` D4, D9, D11, D13)
- **Supersedes:** None (amends the masterdata part of ADR-0033 D4)
- **Superseded By:** None

---

# Context

Masterdata endpoints were readable by every authenticated user, including people's date of
birth, security clearance, e-mail and phone, client and vendor contact data, and contract values.
One code, `platform.master_data.configure`, guarded all writes; `org-admin`, an organization-era
role, could write global catalogs and personal data. Personal data was copied into audit
snapshots and database error text reached the logs.

# Decision

1. **Write permissions are split by area.** `masterdata.catalog.manage` guards the lookup
   catalogs; `masterdata.directory.manage` guards everything else; `masterdata.hard_delete`
   is required in addition for a permanent delete. The legacy `platform.master_data.*` codes were
   removed (an alias existed for one release).
2. **Reads stay open, sensitive fields do not.** Fields that are personal data need
   `masterdata.person.view_sensitive`; money needs `masterdata.client.view_financial`
   (deliberately separate: finance and people data are different audiences).
   A field the caller may not see is **omitted**, never blanked; writing it is `403`; filtering,
   ordering or searching on it is `403` (search skips it); an update that does not name a hidden
   field never changes it. Contact endpoints are purely sensitive: `403` before any object lookup,
   so a missing and a forbidden id look the same.
3. **Personal and financial values are never recorded.** They are excluded from `ChangeLog`
   snapshots (`audit_exclude_fields`) and from audit events (field names and ids only); query
   strings and database error `DETAIL` text are redacted in logs.
4. **The Identity link is controlled.** `Person.user` changes only through `link-user` /
   `unlink-user` (`directory.manage`); while linked, name and e-mail are owned by Identity.
5. **Admin is read-only**, so no path writes masterdata without the services.

# Consequences

- Roles that previously saw everything now need explicit grants (`init_platform` seeds them:
  `org-admin` and `platform-admin` both, `production-admin` financial only). Pinned by tests.
- Frontend clients must tolerate omitted fields and `403` on gated writes.
- Existing databases lose the old codes and their grants when `init_platform` runs.
- Follow-up FU-1: `org-admin` holds `catalog.manage` as a stop-gap; a platform-level role should own it.
