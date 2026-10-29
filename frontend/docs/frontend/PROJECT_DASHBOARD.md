# StudioHub VFX Production Context-Aware Dashboard

## Overview
The StudioHub Project Dashboard (`/dashboard`) serves as the primary **VFX Production Command Center**. It operates with strict context-awareness, dynamically mounting and displaying telemetry, metrics, shot matrices, task velocity, review queues, and schedules scoped strictly to the currently selected project in `useProductionStore`.

## Architectural Principles

1. **Strict Zero-Contamination Isolation**:
   - Query keys strictly incorporate the current project ID: `['dashboard', organizationId, projectId]`.
   - Data from Project A is never rendered or cached as Project B data.
   - When the user switches projects using the header Context Switcher, TanStack Query invalidates and refetches telemetry for the newly active project.

2. **VFX Command Center Aesthetics**:
   - Designed around a high-density, low-clutter production control surface.
   - Color spaces (ACEScg), resolution formats (4K DCI, UHD), frame rates (24.00 fps), and timecodes are prominently displayed.
   - Distinctive dark HUD aesthetic using deep slate tones (`slate-950`, `slate-900`) and high-visibility status indicators (`emerald-400` approved, `sky-400` in-progress, `amber-400` overdue, `rose-400` blocked).

3. **Core Modules & Telemetry**:
   - **Command Header**: Project code badge (`[NK99]`), client name, production phase, color space, aspect ratio, frame rate, date ranges, and quick action triggers (`Create Task`, `Create Shot`, `Shot Matrix`, `Project Detail`, `Refresh Telemetry`).
   - **KPI Telemetry HUD**: Sequence Shots, Pipeline Tasks, Production Assets, Screening Room, and Client Deliveries.
   - **Production Progress Gauge**: Visual multi-segmented bar (Approved / WIP / Queued) with calculation footnote (60% Approved Shots + 40% Completed Tasks).
   - **Shot Pipeline Matrix**: Interactive 7-stage breakdown (Not Started, In Progress, Internal Review, Client Review, Approved, Final, On Hold) with one-click filtering to `/shots`.
   - **Task Health Deck**: Blocked task callout alert, status distribution counters, and critical priority task watch list.
   - **Screening Room & Dailies**: Active review sessions, reviewers count, and approval status.
   - **Milestones & Schedule**: Timeline progress bar (% elapsed), countdown to delivery date, next upcoming deadline callout, and milestone checklist.
   - **Team Workload Roster**: Artist capacity indicators (`normal`, `high`, `overloaded`) with task counts and overdue alerts.
   - **Client Delivery & Turnover Packages**: Master render packages, recipient studios, and approval status.
   - **Live Telemetry Stream**: Project-scoped audit events and update feed.

4. **Lifecycle & Fallback States**:
   - **Empty State (`DashboardEmptyState`)**: Rendered when no project is active, guiding user to select or browse projects.
   - **Skeleton State (`DashboardSkeleton`)**: Exact 1:1 HUD skeleton displayed during network queries to prevent layout shifting.
   - **Error State (`DashboardErrorState`)**: Provides descriptive error feedback and a one-click query retry trigger.
