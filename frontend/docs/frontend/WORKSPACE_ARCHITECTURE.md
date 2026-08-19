# StudioHub Universal Workspace Architecture

## 1. Non-Linear Production Philosophy
StudioHub treats every entity (Organization, Client, Vendor, Project, Shot, Asset, Task, Version, Review) as a first-class node in a universal DAG (Directed Acyclic Graph). Artists, supervisors, and studio executives can traverse arbitrary depths without losing multi-tab context.

## 2. Organization Multi-Tenancy Engine

### Switcher Mechanics
1. **Selection**: Switcher UI (`OrganizationSwitcher.tsx`) displays recent studios, favorites, and quick search.
2. **Context Synchronization**: Triggering `switchOrganization(orgId)` performs:
   - Updates `localStorage.setItem('studiohub_active_org_id', orgId)`
   - Updates `ApiClient` header injection (`X-Organization-Id: <active_org_id>`)
   - Invalidates all TanStack Query caches (`queryClient.invalidateQueries()`) to eliminate cross-tenant data bleed
   - Updates `OrganizationContext` and triggers reactive re-renders across the navigation header, active breadcrumbs, and permission gates.

### 12-Tab Organization Workspace Layout
When viewing `/organizations/:id`, users access the comprehensive studio operational control plane:
- **Overview**: Real-time show count, crew count, storage quota consumption, OCIO standards, and high-level health vitals.
- **Profile**: Legal entity details, registered URL slug, jurisdiction, and supervisory contacts.
- **Branding**: Logos, screening portal banners, burn-in watermark presets, and UI accent themes.
- **Offices**: Physical facilities, timezone alignments, DCI screening suites, and SAN bandwidth links.
- **Departments**: Pipeline craft units (FX, Lighting, Comp, Asset) with custom software toolchains.
- **Teams**: Specialized squads and sequence strike pods.
- **People**: Crew directory with hourly rates, active task loads, and MPAA clearance levels.
- **Clients**: Commissioning studios, contract tiers, and client screening portals.
- **Vendors**: Outsourcing partner labs with NDA status and secure direct transfer links.
- **Projects**: Direct access to production modules (Shots, Assets, Tasks, Versions, Reviews) with zero data duplication.
- **Settings**: Global FPS defaults, ACES color pipelines, OpenUSD versions, and SAML SSO enforcement.
- **Activity**: Live audit trail of pipeline changes, key rotations, and facility updates.
