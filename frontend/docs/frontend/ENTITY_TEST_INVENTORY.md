# Entity Test Inventory (machine-readable)

Vitest files + engine suite. Status: all passing
(`vitest run`: 34+ files). Legend — Type: U unit, I integration (mock API).
Priority: P0 critical, P1 high, P2 medium.

## Vitest suites (new)

| Test ID | Entity | File | Feature | Type | Priority |
|---|---|---|---|---|---|
| ENT-LIST-CLIENT-* | Client | entities/EntityListMatrix.test.tsx | list/search/type+status filter/toolbar+row gating | I | P0 |
| ENT-LIST-VENDOR-* | Vendor | entities/EntityListMatrix.test.tsx | list/search/spec+status filter/gating/archive-only model | I | P0 |
| ENT-LIST-DEPT-* | Department | entities/EntityListMatrix.test.tsx | list/search/gating | I | P0 |
| ENT-LIST-TEAM-* | Team | entities/EntityListMatrix.test.tsx | list/search/gating | I | P0 |
| ENT-LIST-OFFICE-* | Office | entities/EntityListMatrix.test.tsx | list/search/gating | I | P0 |
| ENT-LIST-PEOPLE-* | People | entities/EntityListMatrix.test.tsx | directory/status filter/invite gating | I | P0 |
| ENT-LIST-PROJECT-* | Project | entities/EntityListMatrix.test.tsx | list/status query/gating | I | P0 |
| ENT-MUT-* | all 7 | entities/EntityMutationRoundtrips.test.tsx | create/read/update/archive/restore/delete + isolation + 404 | I | P0 |
| ENT-REL-TEAM | Team | entities/EntityWorkspaceRelations.test.tsx | member add/remove, lead change | I | P0 |
| ENT-REL-DEPT | Department | entities/EntityWorkspaceRelations.test.tsx | project assign/unassign | I | P1 |
| ENT-REL-PERSON | People | entities/EntityWorkspaceRelations.test.tsx | assign dept/team/project, suspend/reactivate | I | P0 |
| ENT-REL-INVITE | Invitation | entities/EntityWorkspaceRelations.test.tsx | create/resend/revoke/delete | I | P0 |
| ENT-REL-PROJECT | Project | entities/EntityWorkspaceRelations.test.tsx | close/reopen/archive/restore/clone | I | P0 |
| ENT-WS-CLIENT | Client | entities/EntityWorkspaceRelations.test.tsx | workspace tabs render + switch | I | P1 |
| ENT-WS-TEAM | Team | entities/EntityWorkspaceRelations.test.tsx | members tab + lead display | I | P1 |
| ENT-FORM-CLIENT | Client | entities/EntityFormsSelectors.test.tsx | required guard, code uppercase, defaults | I | P0 |
| ENT-FORM-VENDOR | Vendor | entities/EntityFormsSelectors.test.tsx | required guard | I | P0 |
| ENT-SEL-* | all | entities/EntityFormsSelectors.test.tsx | Team/Department/Office/Client selectors + filters | I | P1 |
| ENT-RBAC-* | all | security/EntityRbacIsolation.test.tsx | 6 personas × view/create/delete/audit/security/invite | U | P0 |
| ENT-ISO-URL | all | security/EntityRbacIsolation.test.tsx | cross-org direct URL denied (no_org_membership) | U | P0 |
| ENT-SEARCH-MODAL | all | security/EntityRbacIsolation.test.tsx | universal search category filtering | I | P0 |
| ENT-KBD-* | nav | security/EntityRbacIsolation.test.tsx | go-to honors canNavigate | I | P1 |
| ENT-ACT-001 | Activity | security/EntityRbacIsolation.test.tsx | recordActivity org-scoped, newest-first | U | P1 |
| ENT-ERR-* | API | security/EntityRbacIsolation.test.tsx | DRF 400–500 mapping | U | P1 |
| ENT-A11Y-DLG | UI | security/EntityRbacIsolation.test.tsx | dialog role + aria-modal | I | P2 |

## Engine runner (Testing page)

`entity-exhaustive-suite` (`src/core/testing/suites/entityExhaustiveSuites.ts`):
`entity-{client,vendor,department,team,office,person,project}-lifecycle`
(live CRUD + isolation in active API mode) + `entity-relationships`.
Filter by Entity / Category / text search in Testing page.

## Pre-existing coverage reused (not duplicated)

- `OrganizationAuditRbac.test.tsx` (88): catalog, grants, registry, route
  enforcement, tab mapping, menu/table filtering, mock isolation.
- `OrganizationEntitiesCrudAndActions.test.tsx`, page/workspace/integration/
  msw suites, `ApiParity.test.ts`, parity harness.

## Intentional exclusions (no such feature)

- Sort/pagination/bulk on entity list pages (server search + client filters
  only; DataTable features live on ProductionView path).
- Clone for non-project entities; suspend/activate outside People;
  vendor delete/trash UI; office member/project mutations; department
  add-member/lead-change mutations; selector create-new/pagination/permission
  filter (native selects; permission enforced at page/route).
- Multi-column sort, table URL sync, saved views on org lists.
- Backend persistence beyond mock (frontend-only task).
