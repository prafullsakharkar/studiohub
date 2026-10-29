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

### 2.2 Project-Scoped Isolation
StudioHub is org-free: directory entities (clients, vendors, people, departments, teams, offices) are platform-wide, and production data is isolated by **project membership**:
- Project workspaces are only reachable by project members (or platform superusers); non-members are redirected to a denial page with no data leak.
- The API layer sends no tenant headers or query parameters; isolation is enforced by the backend's project membership checks and the frontend route/action guards.
- Access decisions are evaluated consistently on both the client (route registry) and the server (DRF permissions).

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
   - `ProjectMasterHUD`: Active production selector with ACEScg / frame-rate metadata.
   - `GlobalSearch`: Quick search across shots, USD assets, tasks, crew, and documentation.
   - `CommandPalette` (`⌘K`): Keyboard-first command execution and persona switching.
   - `NotificationCenter`: Real-time dailies alerts, farm warnings, and mention notifications.
   - `UserMenu`: Profile, role badges, theme toggles, and session termination.
2. **PrimaryNavigation (Sidebar)**:
   - **Home & Workspace**: Global Dashboard
   - **Studio (Directory)**: Clients, Vendors, Crew & People, Departments, Teams, Global Offices
   - **Production**: Projects, Shots & Sequences, OpenUSD Assets, Discipline Tasks, Published Versions, Screening Room & Reviews
   - **Platform**: Platform Admin, API Health, Data Platform, Notifications, Reports, Billing, QA Runner
3. **InspectorDrawer & Peek Modals**:
   - Contextual slide-out inspection for deep metadata, USD stage hierarchies, version histories, and activity logs.

---

## 4. State Management Strategy
- **Server State**: Managed exclusively by TanStack Query (`@tanstack/react-query`) with deterministic cache invalidation, background refetching, and optimistic mutations.
- **Client UI State**: Lightweight Zustand stores for layout preferences, sidebar collapse, active filters, command palette triggers, and inspector drawer selections.
- **Context State**: React Context for `AuthContext` (JWT tokens, permissions, user identity).

---

## 5. Security & RBAC Enforcement
- **Permission Matrix**: Fine-grained permissions (`project:create`, `shot:approve`, `version:publish`, `vendor:manage`, `billing:admin`, `audit:read`).
- **Permission Guards**: Declarative `<PermissionGate>` wrappers and `can(permission)` utility hooks.
- **HTTP Interception**: Automatic JWT bearer injection, 401 token refresh retry loop, and DRF error mapping.
