# StudioHub Entity Relationships

## Entity Relationship Architecture

```
Organization (Tenant Root)
 │
 ├── User (Identity) ──────────── Person (Profile)
 │                                  │
 ├── Department ────────────────────┼── Head of Dept (Person)
 │     └── Team ────────────────────┼── Team Lead (Person)
 │                                  │
 ├── Office ────────────────────────┘
 │
 ├── Client ────────────────────────┐
 ├── Vendor ──────────┐             │
 │                    │             │
 └── Project ─────────┼─────────────┘
       ├── Sequence   │
       │     └── Shot ├── Tasks ── Assignee (Person) / Vendor
       │               │          └── Timelogs ── Person & Approver (User)
       │               │
       ├── Asset ──────┘
       │
       ├── PublishedVersion ── DeliveryVersionRef ── DeliveryPackage
       │       │
       │       └── PlaylistEntry ── Playlist
       │
       └── ReviewSession
               ├── ReviewAnnotation
               └── ReviewComment
```

## Key Relational Guarantees

1. **Organization Isolation**: Every business entity inherits from `TenantAwareModel` and references `organization` with `db_index=True`.
2. **Client & Vendor Scope**: Clients and Vendors exist at the Organization level and can participate across multiple Projects.
3. **Cross-Entity Linking**: Tasks can bind to either Shots (`entity_type='Shot'`) or Assets (`entity_type='Asset'`), while tracking department, team, assignee, and vendor affiliations.
4. **Publish Version Hierarchy**: Published versions link to Shots or Assets with strict version numbering (`version_number=1, 2, ...`), and a single version marked as `is_hero=True` represents the active approved master.
