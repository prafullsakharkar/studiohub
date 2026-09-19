# Organization Frontend Audit + RBAC (2026-09-19)

## Outcome
Full org audit done in studiohub-react. 231/231 vitest green, tsc clean,
api:validate 0 invented, vite build clean. Report:
docs/frontend/ORGANIZATION_AUDIT_REPORT.md. Tests:
src/features/organizations/__tests__/permissions/OrganizationAuditRbac.test.tsx (88).

## Key fixes
- Catalog: added ~50 codes (org archive/restore/switch/manage, org.access/update,
  plural audit aliases, page.audit_logs/page.background_jobs, permissions.manage,
  security.view, position/invitation/calendar/holiday/api_key/token sets,
  roles/groups CRUD, dept/team/office restore). Plural codes are the RUNTIME
  canonical ones (roles/registry/routes use them); singular catalog entries kept.
- Registry: audit family switched to plural + requireAny (mirrors AppRoutes);
  added 14 entity detail/edit + 4 access + 3 alias entries.
- AppRoutes: PermissionRoute around all org detail/edit + access routes.
- Tabs: WORKSPACE_SECTIONS + ACCESS_TABS carry `permission`; filtered + denied panel.
- Toolbars: Button permission/hide or can() on Organizations/Clients/Vendors/
  Teams/Departments/Offices/workspaces/InvitationsTab/Access.
- Menu/TableView/EntityActions: opt-in `canItem` filtering (requiredPermission
  now enforced in TableView).
- Palette: isUserAdmin replaces role-string checks; active-org evaluation.
- Search (universal + intelligence): entity-type view-permission filtering.
- Shortcuts: canNavigate via evaluateRouteAccess wired in Header.
- switchOrganization: membership fail-closed + cancel/removeQueries (not just invalidate).
- Mock: audit family + editorial tracks fail-closed without org scope (mockRouter
  + MSW audit handler); TracksPage editorial sends organization_id.

## Gotchas for future work
- PERMISSION_MAP is a Map (use .get).
- Test helpers: features testUtils mock AuthContext lacked `can` -> added;
  src/__tests__/test-utils uses REAL providers (null user) -> mock useAuth per test.
- Parallel permission systems (ENTERPRISE_ROLES, DOMAIN_PERMISSIONS_CATALOG,
  permission stores) intentionally untouched; consolidation needs an ADR.
- RoutePermissionGuard provisioned-bypass stays: new registry entries only
  enforce once granted to >=1 role, so catalog+grant+registry must land together.
