# StudioHub Domain Model Specification

## 1. Domain Entities Overview

StudioHub models the complete VFX and animation studio ecosystem.

---

## 2. Organization & Business Entities

### 2.1 Organization (Studio Entity)
The root multi-tenant entity representing a visual effects studio or company group.
- **Fields**: `id`, `name`, `slug`, `code`, `tier`, `logo_url`, `headquarters`, `offices_count`, `active_projects_count`, `crew_count`, `storage_quota_tb`, `storage_used_tb`, `status`, `created_at`
- **Sub-domains**: Offices, Departments, Teams, People, Clients, Vendors, Projects, Settings, Billing

### 2.2 Client (Studio Partner / Production Company)
Film studios, streaming networks, and production houses commissioning VFX work.
- **Fields**: `id`, `organization_id`, `name`, `code`, `contact_name`, `email`, `phone`, `studio_type`, `active_projects`, `contract_tier`, `portal_access`, `status`, `logo_url`
- **Relations**: Associated Projects, Client Review Sessions, Delivery Specs, Milestones

### 2.3 Vendor (Outsourcing & Specialist VFX Partner)
External boutique studios, rotoscope vendors, matchmove houses, and simulation specialists.
- **Fields**: `id`, `organization_id`, `name`, `code`, `contact_name`, `email`, `specialization`, `security_tier`, `nda_signed`, `active_tasks_count`, `active_projects`, `rating`, `status`
- **Relations**: Assigned Tasks, Outsourcing Deliverables, Quality Scores, Secure Transfer Portals

### 2.4 Person (Studio Crew Member / Artist)
Artists, department supervisors, production coordinators, technical directors, and pipeline developers.
- **Fields**: `id`, `organization_id`, `full_name`, `email`, `role`, `department_id`, `department_name`, `team_id`, `team_name`, `office_id`, `office_name`, `avatar_url`, `skills`, `seniority`, `availability_status`, `active_tasks`, `logged_hours`

### 2.5 Department (Discipline Unit)
Core pipeline crafts (Layout, Modeling, Animation, FX & Simulation, Lighting & LookDev, Compositing, Pipeline, Editorial).
- **Fields**: `id`, `organization_id`, `name`, `code`, `head_id`, `head_name`, `member_count`, `active_tasks_count`, `color`, `description`, `software_stack`

### 2.6 Team (Production Squad)
Cross-functional squads assigned to specific sequences, hero assets, or technical milestones.
- **Fields**: `id`, `organization_id`, `department_id`, `name`, `code`, `lead_id`, `lead_name`, `member_count`, `current_project_id`, `current_project_code`, `focus_discipline`

### 2.7 Office (Global Studio Facility)
Physical locations and cloud virtual studios with timezone and infrastructure parameters.
- **Fields**: `id`, `organization_id`, `name`, `code`, `city`, `country`, `address`, `timezone`, `capacity`, `current_occupancy`, `manager_id`, `manager_name`, `network_speed_gbps`, `color_space`

---

## 3. Production Entities

### 3.1 Project (Show / Production)
Feature film, episodic series, or commercial project with delivery specs and OCIO configuration.
- **Fields**: `id`, `organization_id`, `name`, `code`, `type`, `description`, `status`, `fps`, `resolution`, `aspect_ratio`, `color_space`, `start_date`, `delivery_date`, `thumbnail_url`, `budget_usd`, `supervisor_id`, `coordinator_id`, `client_name`

### 3.2 Shot (Cinematic Cut)
Film cuts with frame counts, head/tail handles, cut timecodes, and discipline progress.
- **Fields**: `id`, `project_id`, `sequence_code`, `code`, `name`, `status`, `frame_in`, `frame_out`, `frame_count`, `handle_frames`, `thumbnail_url`, `video_url`, `current_version`, `assigned_artist_name`, `pipeline` (layout, anim, fx, lgt, comp)

### 3.3 Asset (OpenUSD Model / Rig / Prop)
Digital production assets authored in Maya, Houdini, Blender, and packaged into USD layers.
- **Fields**: `id`, `project_id`, `name`, `code`, `category`, `status`, `version`, `thumbnail_url`, `file_format`, `poly_count`, `lod_levels`, `software`

### 3.4 Task (Discipline Work Unit)
Atomic assignments with tracked vs estimated hours and software runtime dependencies.
- **Fields**: `id`, `project_id`, `entity_type`, `entity_id`, `entity_code`, `title`, `code`, `department`, `status`, `priority`, `assignee_name`, `due_date`, `estimated_hours`, `logged_hours`

### 3.5 Version & Review
Published render passes, review dailies, frame annotations, timecodes, and supervisor verdicts.
- **Fields**: `id`, `entity_type`, `entity_id`, `entity_code`, `version_number`, `status`, `supervisor_verdict`, `annotations`, `timecode`, `color_lut`
