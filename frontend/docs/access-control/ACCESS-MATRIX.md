# StudioHub Enterprise RBAC — Access Control Matrix

**Document Status:** Canonical Contract (Phase 2 revision of the approved baseline)  
**Version:** 3.0.0-CANONICAL (revises 2.0.0-ENTERPRISE)  
**Target:** Role Permissions, Granular Scopes, Entity Actions, Sensitive Fields & State Transitions  
**Companion docs:** [RBAC.md](./RBAC.md) · [SCOPES.md](./SCOPES.md) · [IMPLEMENTATION-AUDIT.md](./IMPLEMENTATION-AUDIT.md)

> **Canonical conventions (apply to every token and scope below):**
> 1. Permission tokens are **dot-notation, singular resources**: `shot.view`,
>    `project.create`, `page.project.overview`. Legacy colon tokens (`shots:read`) in
>    backend production/platform constants map to these codes and are removed in Phase 3
>    (RBAC.md Decision D3).
> 2. Role codes follow `src/core/permissions/systemRoles.ts`; backend seed roles are
>    reconciled to them in Phase 3.
> 3. Scopes follow the canonical lattice in [SCOPES.md](./SCOPES.md), including
>    **SHOW as a first-class tier** (Decision D2) and `VENDOR_PROJECT` / `CLIENT_PROJECT`
>    naming.
> 4. `S` (scoped) always means *within the role's effective scope ceiling* — see
>    SCOPES.md §3 rule 1 (scope is a ceiling, not a floor). Production Admin in
>    particular has **no org-wide production fallback** and is barred from org-RBAC codes
>    (RBAC.md §7).

---

## Table of Contents

1. [Role Hierarchy & Classification](#1-role-hierarchy--classification)
2. [Master Permissions & Role Matrix](#2-master-permissions--role-matrix)
   - [2.1 Page & Navigation Permissions](#21-page--navigation-permissions)
   - [2.2 Organization & Foundation Resources](#22-organization--foundation-resources)
   - [2.3 Production Core Resources](#23-production-core-resources)
   - [2.4 Media, Review & Delivery Resources](#24-media-review--delivery-resources)
   - [2.5 Pipeline, Infrastructure & Governance Resources](#25-pipeline-infrastructure--governance-resources)
3. [Granular Scope & Dimension Modeling](#3-granular-scope--dimension-modeling)
4. [External Partner Isolation Matrix (Clients & Vendors)](#4-external-partner-isolation-matrix-clients--vendors)
5. [Sensitive Field-Level Security Matrix](#5-sensitive-field-level-security-matrix)
6. [Workflow State Transition Matrix](#6-workflow-state-transition-matrix)
7. [Bulk Operation Authorization Matrix](#7-bulk-operation-authorization-matrix)

---

## 1. Role Hierarchy & Classification

StudioHub classifies roles into 6 logical tiers with clear separation of duties:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Platform & Executive Tier                                           │
│    • Platform Admin (platform_admin) [GLOBAL]                          │
│    • Organization Owner (org_owner) [ORGANIZATION]                     │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Studio Management Tier                                              │
│    • Organization Admin (org_admin) [ORGANIZATION]                     │
│    • Organization Manager (org_manager) [ORGANIZATION]                 │
│    • Department Manager (dept_manager) [DEPARTMENT]                    │
│    • Team Manager (team_manager) [TEAM]                                │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Production Leadership Tier                                          │
│    • Production Admin (production_admin) [PROJECT]                     │
│    • Executive Producer (executive_producer) [ORGANIZATION]            │
│    • Producer (producer) [ORGANIZATION]                                │
│    • Production Manager (production_manager) [ORGANIZATION]            │
│    • Production Coordinator (production_coordinator) [PROJECT]         │
│    • Production Assistant (production_assistant) [PROJECT]             │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Creative & Pipeline Supervision Tier                                │
│    • VFX Supervisor (vfx_supervisor) [PROJECT]                         │
│    • CG Supervisor (cg_supervisor) [PROJECT]                           │
│    • Animation Supervisor (animation_supervisor) [DEPARTMENT]          │
│    • Sequence Supervisor (sequence_supervisor) [DEPARTMENT]            │
│    • Shot Supervisor (shot_supervisor) [DEPARTMENT]                    │
│    • Asset Supervisor (asset_supervisor) [DEPARTMENT]                  │
│    • Pipeline Supervisor (pipeline_supervisor) [PROJECT]               │
│    • Pipeline TD (pipeline_td) [PROJECT]                               │
│    • Pipeline & Core Tech TD (pipeline_core_tech_td) [PROJECT]         │
│    • Technical Director (technical_director) [PROJECT]                 │
├────────────────────────────────────────────────────────────────────────┤
│ 5. Craft Execution & Artist Tier                                       │
│    • Lead Artist (lead_artist) [DEPARTMENT]                            │
│    • Senior Artist (senior_artist) [ASSIGNED]                          │
│    • Artist (artist) [ASSIGNED]                                        │
│    • 15 Specialized Craft Roles (Modeler, Lighter, Comp, etc.)         │
├────────────────────────────────────────────────────────────────────────┤
│ 6. External Partner & Governance Tier                                  │
│    • Vendor Admin, Vendor Manager, Vendor Artist [VENDOR_PROJECT]      │
│    • Client Admin, Client Producer, Client Reviewer [CLIENT_PROJECT]   │
│    • Reviewer, Viewer, Auditor, Guest [ASSIGNED / AUDIT]               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Master Permissions & Role Matrix

**Legend:**
- `✓` = Full Unrestricted Access
- `S` = Scoped Access (Restricted to User's Assigned Organization, Project, Show, Department, Team, or Vendor)
- `O` = Own Records Only (Entities created by or assigned directly to the user)
- `–` = Denied / No Access

---

### 2.1 Page & Navigation Permissions

| Route / Module | Page Permission | Platform Admin | Org Owner | Org Admin | Prod Admin | VFX Sup | Lead Artist | Artist | Vendor Admin | Vendor Artist | Client Reviewer | Auditor |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dashboard** | `page.dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Workspace** | `page.workspace` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Organizations Directory** | `page.organizations` | ✓ | ✓ | ✓ | – | – | – | – | – | – | – | ✓ |
| **Clients Directory** | `page.clients` | ✓ | ✓ | ✓ | S | S | – | – | – | – | – | ✓ |
| **Vendors Directory** | `page.vendors` | ✓ | ✓ | ✓ | S | S | – | – | – | – | – | ✓ |
| **People / Crew Roster** | `page.people` | ✓ | ✓ | ✓ | S | S | S | – | – | – | – | ✓ |
| **Departments** | `page.departments` | ✓ | ✓ | ✓ | S | S | S | – | – | – | – | ✓ |
| **Teams** | `page.teams` | ✓ | ✓ | ✓ | S | S | S | – | – | – | – | ✓ |
| **Offices** | `page.offices` | ✓ | ✓ | ✓ | S | – | – | – | – | – | – | ✓ |
| **Productions / Projects** | `page.projects` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S | ✓ |
| **Project Overview** | `page.project.overview` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S | ✓ |
| **Editorial & Cuts** | `page.project.editorial` | ✓ | ✓ | ✓ | S | S | S | S | – | – | – | ✓ |
| **Sequences** | `page.project.sequences` | ✓ | ✓ | ✓ | S | S | S | S | S | – | – | ✓ |
| **Shots** | `page.project.shots` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S | ✓ |
| **Assets** | `page.project.assets` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S | ✓ |
| **Tasks** | `page.project.tasks` | ✓ | ✓ | ✓ | S | S | S | S | S | S | – | ✓ |
| **Versions** | `page.project.versions` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S | ✓ |
| **Reviews & Dailies** | `page.project.reviews` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S | ✓ |
| **Notes & Feedback** | `page.project.notes` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S | ✓ |
| **Deliveries** | `page.project.deliveries` | ✓ | ✓ | ✓ | S | S | – | – | S | – | S | ✓ |
| **Schedule & Milestones** | `page.project.schedule` | ✓ | ✓ | ✓ | S | S | – | – | – | – | – | ✓ |
| **Resources & Crews** | `page.project.resources` | ✓ | ✓ | ✓ | S | S | – | – | – | – | – | ✓ |
| **Pipeline & File Hub** | `page.project.pipeline` | ✓ | ✓ | ✓ | S | S | S | – | – | – | – | ✓ |
| **Audit & Governance** | `page.audit` | ✓ | ✓ | ✓ | S | – | – | – | – | – | – | ✓ |
| **Access & Security** | `page.permissions` | ✓ | ✓ | ✓ | – | – | – | – | – | – | – | – |
| **Testing Harness** | `page.testing` | ✓ | ✓ | ✓ | – | – | – | – | – | – | – | – |

---

### 2.2 Organization & Foundation Resources

| Resource / Action | Permission Token | Platform Admin | Org Owner | Org Admin | Prod Admin | VFX Sup | Lead Artist | Artist | Vendor Admin | Client Reviewer | Auditor |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Organization: View** | `organization.view` | ✓ | ✓ | ✓ | S | S | S | S | – | – | ✓ |
| **Organization: Update** | `organization.update` | ✓ | ✓ | ✓ | – | – | – | – | – | – | – |
| **Organization: Delete** | `organization.delete` | ✓ | ✓ | – | – | – | – | – | – | – | – |
| **Client: View** | `client.view` | ✓ | ✓ | ✓ | S | S | – | – | – | – | ✓ |
| **Client: Create/Update** | `client.create`, `client.update` | ✓ | ✓ | ✓ | S | – | – | – | – | – | – |
| **Vendor: View** | `vendor.view` | ✓ | ✓ | ✓ | S | S | – | – | S | – | ✓ |
| **Vendor: Create/Update** | `vendor.create`, `vendor.update` | ✓ | ✓ | ✓ | S | – | – | – | – | – | – |
| **People: View** | `people.view` | ✓ | ✓ | ✓ | S | S | S | S | – | – | ✓ |
| **People: Create/Update** | `people.create`, `people.update` | ✓ | ✓ | ✓ | S | – | – | – | – | – | – |
| **People: Compensation** | `field.people.compensation.view`| ✓ | ✓ | – | – | – | – | – | – | – | ✓ |
| **Department: View** | `department.view` | ✓ | ✓ | ✓ | S | S | S | S | – | – | ✓ |
| **Department: Manage** | `department.create`, `update` | ✓ | ✓ | ✓ | – | – | – | – | – | – | – |
| **Team: View** | `team.view` | ✓ | ✓ | ✓ | S | S | S | S | – | – | ✓ |
| **Team: Manage** | `team.create`, `team.update` | ✓ | ✓ | ✓ | S | – | – | – | – | – | – |
| **Office: View/Manage** | `office.view`, `office.manage` | ✓ | ✓ | ✓ | – | – | – | – | – | – | – |

---

### 2.3 Production Core Resources

| Resource / Action | Permission Token | Platform Admin | Org Owner | Org Admin | Prod Admin | VFX Sup | Lead Artist | Artist | Vendor Admin | Vendor Artist | Client Reviewer |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Project: View** | `project.view` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S |
| **Project: Create** | `project.create` | ✓ | ✓ | ✓ | – | – | – | – | – | – | – |
| **Project: Update** | `project.update` | ✓ | ✓ | ✓ | S | – | – | – | – | – | – |
| **Project: Delete** | `project.delete` | ✓ | ✓ | – | – | – | – | – | – | – | – |
| **Sequence: View** | `sequence.view` | ✓ | ✓ | ✓ | S | S | S | S | S | – | – |
| **Sequence: Create/Edit** | `sequence.create`, `update` | ✓ | ✓ | ✓ | S | S | – | – | – | – | – |
| **Shot: View** | `shot.view` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S |
| **Shot: Create** | `shot.create` | ✓ | ✓ | ✓ | S | S | – | – | – | – | – |
| **Shot: Update** | `shot.update` | ✓ | ✓ | ✓ | S | S | S | – | S | – | – |
| **Shot: Approve** | `shot.approve` | ✓ | ✓ | ✓ | S | S | S | – | – | – | – |
| **Shot: Delete/Archive** | `shot.delete`, `shot.archive` | ✓ | ✓ | ✓ | S | – | – | – | – | – | – |
| **Asset: View** | `asset.view` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S |
| **Asset: Create/Update** | `asset.create`, `asset.update` | ✓ | ✓ | ✓ | S | S | S | – | S | – | – |
| **Asset: Approve** | `asset.approve` | ✓ | ✓ | ✓ | S | S | S | – | – | – | – |
| **Task: View** | `task.view` | ✓ | ✓ | ✓ | S | S | S | S | S | S | – |
| **Task: Create** | `task.create` | ✓ | ✓ | ✓ | S | S | S | – | S | – | – |
| **Task: Assign/Reassign** | `task.assign` | ✓ | ✓ | ✓ | S | S | S | – | S | – | – |
| **Task: Update Status** | `task.update` | ✓ | ✓ | ✓ | S | S | S | O | S | O | – |
| **Timelog: View** | `timelog.view` | ✓ | ✓ | ✓ | S | S | S | O | S | O | – |
| **Timelog: Create/Edit** | `timelog.create`, `update` | ✓ | ✓ | ✓ | S | S | S | O | S | O | – |

---

### 2.4 Media, Review & Delivery Resources

| Resource / Action | Permission Token | Platform Admin | Org Owner | Org Admin | Prod Admin | VFX Sup | Lead Artist | Artist | Vendor Admin | Vendor Artist | Client Reviewer |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Version: View** | `version.view` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S |
| **Version: Create / Publish** | `version.create` | ✓ | ✓ | ✓ | S | S | S | S | S | S | – |
| **Version: Delete** | `version.delete` | ✓ | ✓ | ✓ | S | S | – | – | – | – | – |
| **Review / Playlist: View** | `review.view` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S |
| **Review: Create Session** | `review.create` | ✓ | ✓ | ✓ | S | S | S | – | S | – | – |
| **Review: Submit Annotations** | `review.comment` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S |
| **Review: Internal Approve** | `review.approve` | ✓ | ✓ | ✓ | S | S | S | – | – | – | – |
| **Review: Client Approve** | `review.client_approve` | ✓ | ✓ | – | – | – | – | – | – | – | ✓ |
| **Note: View** | `note.view` | ✓ | ✓ | ✓ | S | S | S | S | S | S | S |
| **Note: Create Internal** | `note.create` | ✓ | ✓ | ✓ | S | S | S | S | S | S | – |
| **Note: Create Client Note** | `note.client.create` | ✓ | ✓ | ✓ | S | S | – | – | – | – | ✓ |
| **Delivery: View** | `delivery.view` | ✓ | ✓ | ✓ | S | S | – | – | S | – | S |
| **Delivery: Create / Ship** | `delivery.create` | ✓ | ✓ | ✓ | S | S | – | – | S | – | – |
| **Delivery: Accept / Ingest** | `delivery.ingest` | ✓ | ✓ | ✓ | S | S | – | – | – | – | S |

---

### 2.5 Pipeline, Infrastructure & Governance Resources

| Resource / Action | Permission Token | Platform Admin | Org Owner | Org Admin | Prod Admin | Pipe Sup | Pipe TD | Lead Artist | Vendor Admin | Auditor |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Pipeline: View Config** | `pipeline.view` | ✓ | ✓ | ✓ | S | S | S | S | – | ✓ |
| **Pipeline: Edit Steps / Flow**| `pipeline.manage` | ✓ | ✓ | ✓ | – | S | S | – | – | – |
| **Files: Storage Browse** | `file.view` | ✓ | ✓ | ✓ | S | S | S | S | S | ✓ |
| **Files: Download Raw Plates** | `file.download` | ✓ | ✓ | ✓ | S | S | S | S | S | – |
| **Audit Logs: View** | `audit.view` | ✓ | ✓ | ✓ | S | – | – | – | – | ✓ |
| **Audit Logs: Export** | `audit.export` | ✓ | ✓ | ✓ | – | – | – | – | – | ✓ |
| **API Request Logs: View** | `api_requests.view` | ✓ | ✓ | ✓ | – | S | S | – | – | ✓ |
| **Security & Roles: View** | `roles.view` | ✓ | ✓ | ✓ | – | – | – | – | – | ✓ |
| **Security & Roles: Manage** | `roles.manage` | ✓ | ✓ | ✓ | – | – | – | – | – | – |

---

## 3. Granular Scope & Dimension Modeling

Evaluation follows the **canonical scope lattice** ([SCOPES.md](./SCOPES.md)):

```text
GLOBAL (Platform)
 └── ORGANIZATION ──── requires active OrganizationMembership
      └── PROJECT ──── requires active ProjectMembership
           └── SHOW ── show_id-bound grants (first-class tier)
                └── DEPARTMENT ── TEAM ── ASSIGNED ── OWN
External branches: VENDOR_PROJECT ── VENDOR_PROJECT_ASSIGNED
                   CLIENT_PROJECT (approved cuts/milestones only)
```

```text
┌─────────────────────────┬────────────────────────────────────────────────────────┐
│ Scope Identifier        │ Dimension Boundary & Access Rule                       │
├─────────────────────────┼────────────────────────────────────────────────────────┤
│ GLOBAL                  │ Platform-wide; Super Admin / platform roles only       │
│ ORGANIZATION            │ All projects and entities belonging to the active org  │
│ PROJECT                 │ All entities of the assigned project (incl. its shows) │
│ SHOW                    │ Only entities of the bound show within the project     │
│ DEPARTMENT              │ Entities tagged with the user's creative craft division│
│ TEAM                    │ Entities assigned to the user's specific team unit     │
│ VENDOR_PROJECT          │ Entities assigned to the user's vendor company         │
│ VENDOR_PROJECT_ASSIGNED │ Only tasks assigned directly to this vendor artist     │
│ CLIENT_PROJECT          │ Only approved client cuts and milestones               │
│ ASSIGNED                │ Only entities explicitly assigned to this artist       │
│ OWN                     │ Only entities authored/created by this user            │
└─────────────────────────┴────────────────────────────────────────────────────────┘
```

Scope predicates are evaluated by the canonical engine (frontend `scopeEngine.ts` under
`can()`; backend `PermissionResolver` + `scope_by_request` selectors). Scope is a ceiling,
never a floor — a narrower membership narrows the grant, and no grant widens a scope
(SCOPES.md §3).

---

## 4. External Partner Isolation Matrix (Clients & Vendors)

External organizations (vendors, partner studios, clients) operate under strict isolation constraints to protect intellectual property:

### 4.1 Restricted Navigation Paths

| URL Path | Client User | Vendor User | Internal Studio Artist |
| :--- | :---: | :---: | :---: |
| `/settings/*` | **BLOCKED** | **BLOCKED** | Allowed |
| `/organizations/*` | **BLOCKED** | **BLOCKED** | Allowed |
| `/people/*` | **BLOCKED** | **BLOCKED** | Allowed |
| `/departments/*` | **BLOCKED** | **BLOCKED** | Allowed |
| `/teams/*` | **BLOCKED** | **BLOCKED** | Allowed |
| `/offices/*` | **BLOCKED** | **BLOCKED** | Allowed |
| `/clients/*` | **BLOCKED** | **BLOCKED** | Allowed |
| `/vendors/*` | **BLOCKED** | **BLOCKED** (Cannot view other vendors) | Allowed |
| `/audit/*` | **BLOCKED** | **BLOCKED** | Allowed (Auditors/Admins) |

### 4.2 Project Workspace Tab Filtering

| Workspace Tab | Client Visibility | Vendor Visibility | Studio Artist Visibility |
| :--- | :---: | :---: | :---: |
| `overview` | Visible (Milestones only) | Visible | Visible |
| `editorial` | Visible (Client Cuts only) | Visible (Assigned Shots) | Visible |
| `sequences` | **Hidden** | Visible (Assigned) | Visible |
| `shots` | Visible (Client Turnovers) | Visible (Assigned to Vendor) | Visible |
| `assets` | Visible (Client Turnovers) | Visible (Assigned to Vendor) | Visible |
| `tasks` | **Hidden** | Visible (Assigned) | Visible |
| `versions` | Visible (Approved / Sent) | Visible (Vendor Published) | Visible |
| `reviews` | Visible (Client Playlists) | Visible (Vendor Dailies) | Visible |
| `notes` | **Hidden** (Internal only) | Visible (Assigned only) | Visible |
| `deliveries` | Visible (Client Shipments) | Visible (Vendor Packages) | Visible |
| `schedule` | **Hidden** | **Hidden** | Visible |
| `resources` | **Hidden** | **Hidden** | Visible |
| `pipeline` | **Hidden** | **Hidden** | Visible |
| `workflow` | **Hidden** | **Hidden** | Visible |
| `timelogs` | **Hidden** | **Hidden** | Visible |
| `activity` | **Hidden** | **Hidden** | Visible |

---

## 5. Sensitive Field-Level Security Matrix

Financial, contractual, and human resources data is filtered at both the API and UI layers via `fieldPermissionEngine.ts`:

| Entity | Sensitive Field | Required View Permission | Masked Placeholder | Roles with Access |
| :--- | :--- | :--- | :--- | :--- |
| **Project** | `budget_usd` | `field.project.budget.view` | `[RESTRICTED_BUDGET]` | Platform Admin, Org Owner, Org Admin, Producer |
| **Project** | `billing_terms` | `field.project.billing.view` | `[RESTRICTED_BILLING]` | Platform Admin, Org Owner, Org Admin, Producer |
| **Task** | `cost` | `field.task.cost.view` | `null` | Platform Admin, Org Owner, Producer, Prod Mgr |
| **Task** | `internal_rate` | `field.task.cost.view` | `null` | Platform Admin, Org Owner, Producer, Prod Mgr |
| **People** | `compensation` | `field.people.compensation.view` | `[CONFIDENTIAL]` | Platform Admin, Org Owner, Auditor |
| **People** | `day_rate` | `field.people.rates.view` | `null` | Platform Admin, Org Owner, Producer |
| **People** | `overtime_rate`| `field.people.rates.view` | `null` | Platform Admin, Org Owner, Producer |
| **Vendor** | `hourly_rate` | `field.vendor.financials.view` | `null` | Platform Admin, Org Owner, Producer, Vendor Admin |
| **Vendor** | `contract_val` | `field.vendor.financials.view` | `null` | Platform Admin, Org Owner, Producer |
| **Client** | `contract_val` | `field.client.financials.view` | `null` | Platform Admin, Org Owner, Producer |

---

## 6. Workflow State Transition Matrix

The Visual Effects pipeline relies on strict status progression. `workflowStateEngine.ts` enforces transition validity:

### 6.1 Shot & Asset Status Lifecycle

```text
Not Started ──► In Progress ──► Pending Review ──► Approved ──► Final Delivered
                     │                 │
                     ▼                 ▼
                 On Hold       Changes Requested
```

| Current Status | Target Status | Authorized Roles | Required Permission |
| :--- | :--- | :--- | :--- |
| `Not Started` | `In Progress` | Artist, Lead, Supervisor, Prod Admin | `shot.update` |
| `In Progress` | `Pending Review` | Artist, Lead, Supervisor, Prod Admin | `shot.update` |
| `In Progress` | `On Hold` | Producer, Supervisor, Prod Admin | `shot.manage` |
| `Pending Review` | `Approved` | VFX Sup, CG Sup, Lead Artist, Prod Admin | `shot.approve` |
| `Pending Review` | `Changes Requested` | VFX Sup, CG Sup, Lead Artist, Reviewer | `review.comment` |
| `Approved` | `Final Delivered` | Producer, Production Coordinator, Delivery Mgr | `delivery.create` |
| Any | `Omitted` | VFX Sup, Producer, Prod Admin | `shot.archive` |

### 6.2 Review & Client Approval Lifecycle

| Current State | Target State | Authorized Roles | Required Permission |
| :--- | :--- | :--- | :--- |
| `Draft Session` | `Internal Review Active` | VFX Supervisor, Lead Artist, Producer | `review.create` |
| `Internal Review` | `Internal Approved` | VFX Supervisor, CG Supervisor | `review.approve` |
| `Internal Approved`| `Sent to Client` | Producer, Production Coordinator | `delivery.create` |
| `Sent to Client` | `Client Approved` | Client Reviewer, Client Producer, Client Admin | `review.client_approve` |
| `Sent to Client` | `Client Notes / Revisions`| Client Reviewer, Client Producer | `review.client_comment` |

---

## 7. Bulk Operation Authorization Matrix

Bulk operations execute atomic validations per entity using `bulkAuthorizationEngine.ts`:

| Bulk Action | Resource | Minimum Required Permission | Atomic Validation Constraint |
| :--- | :--- | :--- | :--- |
| `bulk_create` | `shot`, `task`, `asset` | `[resource].bulk_create` | User must possess project membership for target project ID |
| `bulk_update` | `shot`, `task`, `asset` | `[resource].bulk_update` | Every target entity must reside in user's scoped project and department |
| `bulk_archive` | `shot`, `task`, `asset` | `[resource].archive` | Production Admin or Supervisor authority required |
| `bulk_restore` | `shot`, `task`, `asset` | `[resource].restore` | Production Admin or Supervisor authority required |
| `bulk_delete` | `shot`, `task`, `asset` | `[resource].delete` | Organization Admin or Platform Admin required |

---
*End of Enterprise RBAC Access Control Matrix.*
