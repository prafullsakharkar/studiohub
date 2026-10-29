# StudioHub Domain Model & Entity Specifications

## 1. Domain Overview
StudioHub coordinates enterprise visual effects (VFX) production across two complementary operational domains:
1. **Platform Directory Entities**: The institutional foundation (Clients, External Vendors, Crew Members, Departments, Teams, Offices, and Billing). These are flat, org-free directory entities owned by the platform.
2. **Production & Pipeline Entities**: The media creation graph (Projects, Sequences, Shots, 3D Assets, Pipeline Tasks, Published Versions, Screening Reviews, and Notes).

There is no organization tenant layer. Access to production data is scoped by **project membership** (a user is either a member of a project or not), and directory entities are platform-wide.

---

## 2. Comprehensive Entity Matrix

### 2.1 Client Studio (`Client`)
- **Ownership**: Platform directory
- **Relationships**: `N : M` with `Project` (A client commissions multiple projects; joint-venture projects can involve co-distributor clients).
- **Cardinality**: `Client N:M Project`
- **Lifecycle**: `Prospect` → `Active Account` → `Completed` → `Archived`
- **Permissions**: `client:read`, `client:create`, `client:edit`, `client:delete`
- **Attributes**: `id`, `name`, `code`, `contact_name`, `email`, `phone`, `studio_type`, `active_projects`, `contract_tier`, `portal_access`, `status`, `total_billed_usd`

### 2.2 Outsourcing Partner (`Vendor`)
- **Ownership**: Platform directory
- **Relationships**: `N : M` with `Project` and `Task` (Vendors receive task packages and deliver version publishes).
- **Cardinality**: `Vendor N:M Project`, `Vendor 1:N VendorUser`, `Vendor 1:N TaskPackage`
- **Lifecycle**: `Vetting` → `Approved Partner` → `Contract Active` → `Offboarded`
- **Permissions**: `vendor:read`, `vendor:create`, `vendor:edit`, `vendor:delete`, `vendor:assign`
- **Attributes**: `id`, `name`, `code`, `contact_name`, `email`, `specialization`, `security_tier (MPAA Tier 1-4)`, `nda_signed`, `bandwidth_gbps`, `active_tasks_count`, `active_projects`, `rating`, `location`

### 2.3 Crew Member / User (`Person`)
- **Ownership**: Platform directory
- **Relationships**: Assigned to 1 `Department`, 1+ `Teams`, 1 `Office`, and multiple `Projects` / `Tasks`.
- **Cardinality**: `Department 1:N Person`, `Team N:M Person`, `Office 1:N Person`, `Project N:M Person`
- **Lifecycle**: `Invited` → `Active` → `On Leave` → `Deactivated`
- **Permissions**: `people:read`, `people:create`, `people:edit`, `people:delete`, `people:assign`
- **Attributes**: `id`, `full_name`, `email`, `role`, `department_id`, `team_id`, `office_id`, `avatar_url`, `skills`, `seniority`, `availability_status`, `assigned_projects`, `security_clearance`, `active_tasks`, `logged_hours`, `timezone`

### 2.4 Discipline Department (`DepartmentEntity`)
- **Ownership**: Platform directory
- **Relationships**: Parent of `Teams` and `People`; linked across all active `Projects`.
- **Cardinality**: `Department 1:N Team`, `Department 1:N Person`, `Department N:M Project`
- **Lifecycle**: `Active` → `Restructuring` → `Inactive`
- **Permissions**: `department:read`, `department:manage`
- **Attributes**: `id`, `name`, `code`, `head_id`, `head_name`, `member_count`, `active_tasks_count`, `color`, `software_stack`, `capacity_hours_weekly`, `utilization_percentage`, `assigned_projects`

### 2.5 Production Squad (`Team`)
- **Ownership**: Platform directory (parented by a Department)
- **Relationships**: Sub-unit of a `Department`; groups `People` for specific `Project` assignments.
- **Cardinality**: `Department 1:N Team`, `Team N:M Person`, `Team N:M Project`
- **Lifecycle**: `Active` → `Disbanded`
- **Permissions**: `team:read`, `team:manage`
- **Attributes**: `id`, `department_id`, `name`, `code`, `lead_id`, `lead_name`, `member_count`, `member_ids`, `current_project_id`, `current_project_code`, `assigned_projects`, `focus_discipline`, `capacity_utilization`

### 2.6 Global Facility Hub (`Office`)
- **Ownership**: Platform directory
- **Relationships**: Physical workstation site housing `People` and hosting pipeline infrastructure.
- **Cardinality**: `Office 1:N Person`, `Office N:M Project`
- **Lifecycle**: `Operational` → `Maintenance` → `Decommissioned`
- **Permissions**: `office:read`, `office:manage`
- **Attributes**: `id`, `name`, `code`, `city`, `country`, `address`, `timezone`, `capacity`, `current_occupancy`, `manager_id`, `network_speed_gbps`, `color_space`, `status`, `working_hours`, `holidays`, `resources`

### 2.7 Production Master (`Project`)
- **Ownership**: Platform (commissioned by one or more Clients)
- **Relationships**: Central hub for `Shots`, `Assets`, `Tasks`, `Versions`, `Reviews`, and `Teams`.
- **Cardinality**: `Project 1:N Sequence`, `Project 1:N Shot`, `Project 1:N Asset`, `Project 1:N Task`, `Project 1:N Delivery`
- **Lifecycle**: `Bidding` → `Pre-Production` → `In Progress` → `Final Delivery` → `Archived`
- **Permissions**: `project:read`, `project:create`, `project:edit`, `project:delete`, `project:approve`
- **Attributes**: `id`, `name`, `code`, `type (Feature/Episodic/Commercial)`, `client_id`, `client_name`, `status`, `start_date`, `delivery_date`, `shot_count`, `asset_count`, `progress_percentage`, `budget_usd`, `spent_usd`, `fps`, `resolution`, `color_space`, `aspect_ratio`

---

## 3. Production Graph Entities

### 3.1 Shot (`Shot`)
- **Ownership**: Project (and Sequence)
- **Relationships**: `Project 1:N Shot`, `Shot 1:N Task`, `Shot 1:N PublishedVersion`, `Shot 1:N Note`
- **Lifecycle**: `Not Started` → `Ready to Start` → `In Progress` → `Internal Review` → `Client Review` → `Approved` → `Omitted`
- **Attributes**: `id`, `project_id`, `code`, `sequence`, `status`, `frame_in`, `frame_out`, `duration_frames`, `thumbnail_url`, `assigned_artists`, `hero_version`, `delivery_date`

### 3.2 3D / Pipeline Asset (`Asset`)
- **Ownership**: Project
- **Relationships**: `Project 1:N Asset`, `Asset 1:N Task`, `Asset 1:N PublishedVersion`, `Asset N:M Shot (Instancing)`
- **Lifecycle**: `Concept` → `Modeling` → `Texturing` → `Rigging` → `Approved`
- **Attributes**: `id`, `project_id`, `code`, `name`, `type (Character/Prop/Environment/FX/Vehicle)`, `status`, `usd_path`, `polygon_count`, `thumbnail_url`

### 3.3 Discipline Task (`Task`)
- **Ownership**: Shot or Asset (under Project)
- **Relationships**: `Shot 1:N Task`, `Asset 1:N Task`, `Person 1:N Task`, `Vendor 1:N Task`
- **Lifecycle**: `Unassigned` → `Ready to Start` → `In Progress` → `Pending Review` → `Approved`
- **Attributes**: `id`, `project_id`, `entity_type`, `entity_id`, `entity_code`, `department`, `name`, `assignee_id`, `assignee_name`, `bid_days`, `logged_hours`, `status`, `progress_percentage`, `due_date`

### 3.4 Published Version (`PublishedVersion`)
- **Ownership**: Shot or Asset
- **Relationships**: `Entity 1:N Version`, `Version 1:N ReviewSession`, `Version 1:N Note`
- **Lifecycle**: `Published` → `In Review` → `Approved / Promoted` → `Superseded`
- **Attributes**: `id`, `project_id`, `entity_type`, `entity_id`, `entity_code`, `version_number`, `department`, `published_by_name`, `status`, `thumbnail_url`, `file_path`, `usd_stage_path`, `frame_range`, `file_size_mb`, `notes`

### 3.5 Screening Room Review (`ReviewSession`)
- **Ownership**: Project / Version
- **Relationships**: `ReviewSession 1:N Version`, `ReviewSession 1:N Attendee (Person/Client)`
- **Lifecycle**: `Scheduled` → `In Progress` → `Concluded`
- **Attributes**: `id`, `project_id`, `title`, `review_type`, `session_date`, `lead_reviewer_name`, `status`, `items_count`, `approved_count`, `notes_count`, `stream_url`
