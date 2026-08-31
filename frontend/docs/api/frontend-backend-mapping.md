# Frontend-to-Backend Architectural Mapping

This document provides an exhaustive cross-reference mapping between the frontend TypeScript architecture and the target Django REST Framework backend implementation.

---

## 1. Core Architecture Cross-Reference Matrix

| Domain Module | Frontend Type / Interface | Frontend Repository / Service | Frontend MSW Handler | Backend Django App | Backend Model(s) | Backend DRF ViewSet / Views | Backend Service Layer | Backend Selector |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication** | `User`, `AuthTokens`, `LoginCredentials` | `authService`, `tokenStorage` | `authHandlers.ts` | `apps.identity` | `User`, `UserSession` | `LoginView`, `TokenRefreshView`, `LogoutView`, `CurrentUserView` | `auth_service.py` | `user_selector.py` |
| **Organizations** | `Organization`, `StudioBilling` | `OrganizationRepository` | `organizationHandlers.ts` | `apps.organization` | `Organization`, `OrganizationSubscription` | `OrganizationViewSet` | `organization_service.py` | `organization_selector.py` |
| **Clients** | `Client` | `ClientRepository` | `organizationHandlers.ts` | `apps.organization` | `Client`, `ClientContact` | `ClientViewSet` | `client_service.py` | `client_selector.py` |
| **Vendors** | `Vendor` | `VendorRepository` | `organizationHandlers.ts` | `apps.organization` | `Vendor`, `VendorContact` | `VendorViewSet` | `vendor_service.py` | `vendor_selector.py` |
| **Crew / People** | `Person`, `CrewMember` | `PeopleRepository` | `organizationHandlers.ts` | `apps.organization` | `Person`, `CrewProfile` | `PersonViewSet` | `people_service.py` | `people_selector.py` |
| **Departments** | `DepartmentEntity` | `DepartmentRepository` | `organizationHandlers.ts` | `apps.organization` | `Department` | `DepartmentViewSet` | `department_service.py` | `department_selector.py` |
| **Teams** | `Team` | `TeamRepository` | `organizationHandlers.ts` | `apps.organization` | `Team`, `TeamMembership` | `TeamViewSet` | `team_service.py` | `team_selector.py` |
| **Offices** | `Office` | `OfficeRepository` | `organizationHandlers.ts` | `apps.organization` | `Office` | `OfficeViewSet` | `office_service.py` | `office_selector.py` |
| **Projects** | `Project` | `projectRepository`, `useProjects` | `projectHandlers.ts` | `apps.production` | `Project`, `ProjectMember` | `ProjectViewSet` | `project_service.py` | `project_selector.py` |
| **Shots** | `Shot`, `Sequence` | `shotRepository`, `useShots` | `shotHandlers.ts` | `apps.production` | `Sequence`, `Shot` | `ShotViewSet`, `SequenceViewSet` | `shot_service.py` | `shot_selector.py` |
| **Assets** | `Asset` | `assetRepository`, `useAssets` | `assetHandlers.ts` | `apps.assets` | `Asset`, `AssetCategory` | `AssetViewSet` | `asset_service.py` | `asset_selector.py` |
| **Tasks** | `Task`, `TaskSchedule` | `taskRepository`, `useTasks` | `taskHandlers.ts` | `apps.tasks` | `Task`, `TaskDependency` | `TaskViewSet`, `BulkTaskViewSet` | `task_service.py` | `task_selector.py` |
| **Timelogs** | `Timelog` | `timelogRepository`, `useTimelogs` | `timelogHandlers.ts` | `apps.tasks` | `Timelog` | `TimelogViewSet` | `timelog_service.py` | `timelog_selector.py` |
| **Reviews** | `ReviewSession`, `ReviewAnnotation` | `reviewRepository`, `useReviews` | `reviewHandlers.ts` | `apps.reviews` | `ReviewSession`, `ReviewComment`, `ReviewAnnotation` | `ReviewViewSet` | `review_service.py` | `review_selector.py` |
| **Versions** | `ProductionVersion`, `PublishedVersion` | `versionRepository`, `useVersions` | `versionHandlers.ts` | `apps.pipeline` | `PublishedVersion`, `VersionDependency` | `VersionViewSet` | `version_service.py` | `version_selector.py` |
| **Media & Dailies**| `MediaItem` | `mediaRepository`, `useMedia` | `mockRouter.ts` | `apps.media` | `MediaAsset`, `MediaStream` | `MediaViewSet` | `media_service.py` | `media_selector.py` |
| **Attachments** | `AttachmentItem` | `attachmentRepository` | `mockRouter.ts` | `apps.production` | `Attachment` | `AttachmentViewSet` | `attachment_service.py` | `attachment_selector.py` |
| **Playlists** | `Playlist`, `PlaylistEntry` | `playlistRepository`, `usePlaylists` | `mockRouter.ts` | `apps.reviews` | `Playlist`, `PlaylistEntry` | `PlaylistViewSet` | `playlist_service.py` | `playlist_selector.py` |
| **Workflows** | `Workflow`, `AutomationRule` | `workflowRepository`, `useWorkflows` | `mockRouter.ts` | `apps.automation` | `WorkflowDAG`, `AutomationRule`, `AutomationLog` | `WorkflowViewSet`, `AutomationRuleViewSet` | `automation_service.py` | `automation_selector.py` |
| **Scheduling** | `Resource`, `CalendarEvent`, `ResourceLeave` | `schedulingRepository`, `useScheduling` | `mockRouter.ts` | `apps.scheduling` | `ResourceSchedule`, `CalendarEvent`, `ResourceLeave` | `SchedulingViewSet` | `scheduling_service.py` | `scheduling_selector.py` |
| **Deliveries** | `DeliveryPackage`, `DeliveryCheck` | `deliveryService`, `useDeliveries` | `mockRouter.ts` | `apps.deliveries` | `DeliveryPackage`, `DeliveryVersionRef`, `DeliveryQC` | `DeliveryViewSet` | `delivery_service.py` | `delivery_selector.py` |
| **Publishing** | `PublishItem`, `PublishRule` | `publishingService`, `usePublishing` | `mockRouter.ts` | `apps.pipeline` | `PublishItem`, `PublishValidationRule` | `PublishingViewSet` | `publishing_service.py` | `publishing_selector.py` |
| **Audit Logs** | `AuditLog` | `auditRepository`, `useAuditLogs` | `auditHandlers.ts` | `apps.audit` | `AuditLogEntry` | `AuditLogViewSet` | `audit_service.py` | `audit_selector.py` |
| **Analytics** | `ProductionKPIs`, `DepartmentProgress` | `analyticsRepository` | `analyticsHandlers.ts` | `apps.analytics` | (Aggregates) | `AnalyticsViewSet` | `analytics_service.py` | `analytics_selector.py` |
| **Settings** | `PipelineSettings` | `settingsRepository` | `settingsHandlers.ts` | `apps.settings` | `StudioPipelineSettings` | `PipelineSettingsViewSet` | `settings_service.py` | `settings_selector.py` |

---

## 2. Detailed Module Architectural Patterns

### 2.1 Identity & Authentication (`apps.identity`)
- **Frontend Interaction**: `src/modules/auth/`
- **Frontend Storage**: `src/core/auth/tokenStorage.ts` (manages `access_token` and `refresh_token` in memory / secure storage)
- **Django Integration**:
  - `apps.identity.models.User`: Extends `AbstractBaseUser` and `PermissionsMixin`. Uses `UUIDField` as PK.
  - `apps.identity.services.auth_service.login_user`: Authenticates credentials and issues rotated JWT pair.
  - `apps.identity.views.LoginView`: Exposed at `/api/v1/auth/login/`.

### 2.2 Organization & Multi-Tenancy (`apps.organization`)
- **Frontend Interaction**: `src/modules/organization/`, `src/modules/people/`, `src/modules/departments/`, `src/modules/teams/`, `src/modules/offices/`
- **Django Integration**:
  - `apps.organization.models.Organization`: Root tenant record containing studio metadata, slug, plan tier, and feature flags.
  - `apps.core.middleware.TenantMiddleware`: Extracts `X-Organization-Id` from request headers, queries `organization_selector.get_active_organization(request)`, and attaches `request.organization` to all subsequent request lifecycle events.
  - `TenantAwareModel`: Base abstract model adding `organization = ForeignKey(Organization)` to all entities with PostgreSQL compound indexing on `(organization_id, id)`.

### 2.3 Production Shots & Projects (`apps.production`)
- **Frontend Interaction**: `src/modules/production/`, `src/modules/shots/`
- **Django Integration**:
  - Models: `Project`, `Sequence`, `Shot`.
  - Serializers: `ProjectListSerializer`, `ProjectDetailSerializer`, `ShotSerializer`.
  - ViewSets: `ProjectViewSet` & `ShotViewSet` providing standard DRF CRUD plus custom `@action(detail=True, methods=['post']) approve(request, pk)`.
  - Domain Events: Emits `ShotApprovedEvent` and `ProjectMilestoneReachedEvent`.

### 2.4 Tasks & Time Tracking (`apps.tasks`)
- **Frontend Interaction**: `src/modules/tasks/`
- **Django Integration**:
  - Models: `Task`, `Timelog`.
  - Bulk Actions: Supported via `BulkTaskViewSet` handling `/api/v1/tasks/bulk-assign/`, `/api/v1/tasks/bulk-status/`, `/api/v1/tasks/bulk-archive/`, and `/api/v1/tasks/bulk-delete/` inside atomic database transactions (`transaction.atomic()`).

### 2.5 Reviews & Screening (`apps.reviews`)
- **Frontend Interaction**: `src/modules/reviews/`, `src/modules/playlists/`
- **Django Integration**:
  - Models: `ReviewSession`, `ReviewVersion`, `ReviewAnnotation`, `ReviewComment`, `Playlist`, `PlaylistEntry`.
  - Canvas Annotations: Coordinates stored as JSONB data structures validated by `ReviewAnnotationSerializer`.

### 2.6 Automation Engine (`apps.automation`)
- **Frontend Interaction**: `src/modules/workflows/`
- **Django Integration**:
  - Models: `WorkflowDAG`, `AutomationRule`, `AutomationLog`.
  - Execution Engine: Asynchronous rule engine evaluating trigger conditions (e.g. `entity_type == "Shot"` and `status_to == "Approved"`) and queuing Celery worker tasks (`apps.automation.tasks.execute_automation_rule`).
