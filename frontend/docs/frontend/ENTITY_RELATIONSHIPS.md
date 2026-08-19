# StudioHub Entity Relationships Specification

```mermaid
erDiagram
    ORGANIZATION ||--o{ OFFICE : operates
    ORGANIZATION ||--o{ DEPARTMENT : structures
    ORGANIZATION ||--o{ TEAM : groups
    ORGANIZATION ||--o{ PERSON : employs
    ORGANIZATION ||--o{ CLIENT : contracts
    ORGANIZATION ||--o{ VENDOR : partners
    ORGANIZATION ||--o{ PROJECT : produces

    DEPARTMENT ||--o{ PERSON : contains
    DEPARTMENT ||--o{ TEAM : houses

    TEAM ||--o{ PERSON : assigns
    OFFICE ||--o{ PERSON : stations

    CLIENT ||--o{ PROJECT : commissions
    VENDOR ||--o{ TASK : executes

    PROJECT ||--o{ SHOT : sequences
    PROJECT ||--o{ ASSET : builds
    PROJECT ||--o{ TASK : schedules
    PROJECT ||--o{ REVIEW_SESSION : evaluates

    SHOT ||--o{ TASK : requires
    ASSET ||--o{ TASK : requires

    SHOT ||--o{ PUBLISHED_VERSION : renders
    ASSET ||--o{ PUBLISHED_VERSION : publishes

    PUBLISHED_VERSION ||--o{ REVIEW_ANNOTATION : receives
```

## Multi-Tenant Isolation Hierarchy

1. **Organization (Tenant)**:
   - Root isolation boundary.
   - Enforces separate storage quotas, OCIO presets, OpenUSD configurations, and SAML 2.0 / 2FA security enforcement.
   - Every API request carries the `X-Organization-Id` tenant header.

2. **Facilities & Workspaces (Offices, Departments, Teams)**:
   - Partitioning of physical workstations, high-bandwidth SAN connections, software licensing stacks, and artist squads.

3. **Production Sphere (Projects, Shots, Assets, Tasks, Versions, Reviews)**:
   - Non-linear, fully connected production graph.
   - Direct universal cross-referencing via `UniversalEntityType` registry.
