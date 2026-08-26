# StudioHub Frontend Architecture

## 1. Overview & Vision
StudioHub is an enterprise-grade, non-linear global Visual Effects (VFX) & Animation Production Management Platform. Unlike standard CRUD admin dashboards, StudioHub models the complex, highly interconnected production graph of feature film and episodic visual effects workflows across multiple global studios, facilities, clients, and vendor partners.

---

## 2. Core Architectural Principles

### 2.1 Non-Linear Entity Graph
VFX production is not a rigid top-down hierarchy; it is a relational web where artists, supervisors, and producers navigate seamlessly across contextual planes:
- **Client Plane**: `Client → Project → Sequence → Shot → Version → Review → Client Note`
- **Vendor Plane**: `Vendor Studio → Project → Task Assignment → Delivery Package → QC Review`
- **Talent Plane**: `Person → Discipline Department → Team Squad → Active Task → Workstation / Office`
- **Pipeline Plane**: `Project → Sequence → Shot → OpenUSD Asset / Layer → Comp Version → Farm Node`

### 2.2 Multi-Organization Isolation
StudioHub provides full multi-tenant studio virtualization:
- Every query, mutation, and cache key is scoped to the `activeOrganizationId`.
- Cross-tenant data leakage is prevented at both the network layer (via `X-Organization-Id` headers) and UI state levels.
- Fast studio context switching without full browser reloads while retaining active tab and workspace filter state.

### 2.3 Layered Clean Architecture
```
┌────────────────────────────────────────────────────────────────────────┐
│                          Presentation Layer                            │
│  (AppShell, Module Views, Inspectors, Drawers, Peek Cards, DataGrids)  │
├────────────────────────────────────────────────────────────────────────┤
│                           Application Layer                            │
│     (TanStack Query Hooks, Custom Domain Hooks, Zustand UI Stores)     │
├────────────────────────────────────────────────────────────────────────┤
│                             Domain Layer                               │
│     (Entities, Value Objects, Domain Models, RBAC Permission Matrix)   │
├────────────────────────────────────────────────────────────────────────┤
│                      Infrastructure & API Layer                        │
│   (Typed ApiClient [Ky], MSW Mock Server, Error Mappers, Serializers)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Application Shell & State Topography

### 3.1 Global Shell Hierarchy
1. **GlobalHeader**:
   - `OrganizationSwitcher`: Instant switching across studio entities with persistent tenancy.
   - `ProjectMasterHUD`: Active production selector with ACEScg / frame-rate metadata.
   - `GlobalSearch`: Quick search across shots, USD assets, tasks, crew, and documentation.
   - `CommandPalette` (`⌘K`): Keyboard-first command execution and persona switching.
   - `NotificationCenter`: Real-time dailies alerts, farm warnings, and mention notifications.
   - `UserMenu`: Profile, role badges, theme toggles, and session termination.
2. **PrimaryNavigation (Sidebar)**:
   - **Workspace**: Global Dashboard, Productions
   - **Organization**: Organizations, Clients, Vendors, Crew & People, Departments, Teams, Global Offices
   - **Production**: Shots & Sequences, OpenUSD Assets, Discipline Tasks, Published Versions, Screening Room & Reviews
   - **Platform**: Production Alerts, Analytics & KPIs, Milestone Reports, Compute Billing, Pipeline Settings, API Diagnostic Suite
3. **InspectorDrawer & Peek Modals**:
   - Contextual slide-out inspection for deep metadata, USD stage hierarchies, version histories, and activity logs.

---

## 4. State Management Strategy
- **Server State**: Managed exclusively by TanStack Query (`@tanstack/react-query`) with deterministic cache invalidation, background refetching, and optimistic mutations.
- **Client UI State**: Lightweight Zustand stores for layout preferences, sidebar collapse, active filters, command palette triggers, and inspector drawer selections.
- **Context State**: React Context for `AuthContext` (JWT tokens, permissions, user identity) and `OrganizationContext` (active studio, tenant switching).

---

## 5. Security & RBAC Enforcement
- **Permission Matrix**: Fine-grained permissions (`project:create`, `shot:approve`, `version:publish`, `vendor:manage`, `billing:admin`, `audit:read`).
- **Permission Guards**: Declarative `<PermissionGate>` wrappers and `can(permission)` utility hooks.
- **HTTP Interception**: Automatic JWT bearer injection, 401 token refresh retry loop, and DRF error mapping.
