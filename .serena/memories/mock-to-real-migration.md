# Mock API → Real Django API Migration (studiohub-react contract)

Completed the frontend-contract migration: Django backend now serves the studiohub-react (`../studiohub-react/src`) mock API contract from real DB data. Frontend untouched (read-only; switch is env-only: VITE_API_MODE=rest + VITE_API_URL).

## Key contract facts (do not re-derive)
- Mock authority = `mockRouter.ts` (mock-first ApiClient, network fallback); MSW handlers dormant. Base `/api/`, v1 flat + `/api/organizations/:org/…` nested (slashless) + `/api/organizations/:org/projects/:proj/…` project-scoped (16 endpoints).
- Envelopes: DRF paginated except org-nested flat resources, GET /organizations/, media/attachments (bare arrays). Detail = id-or-code. Bulk shapes: `check-existence {project_id,codes[]}→{items[{code,state}]}`; `bulk-create {project_id,items[{code,action,data}]}→BulkOperationResponse`; `bulk-update {ids,changes}→summary.updatedCount`; `bulk-archive→summary.archivedCount+success/updated_count`.
- Backend answers with UNION envelopes (react shapes + legacy `processed/successful/failed`, `results[].status`) so both frontends work; existing tests asserting legacy keys still pass.

## What was built (backend/, all paths relative)
- Models: production `ProjectMembership|EditorialCut|ProjectNote` (mig 0006); `ShotStatus.ARCHIVED` (mig 0007).
- `production/services/bulk.py` (BulkOperationService: existence/bulk CRUD generalized from SequenceService; Shot/Asset/Task inherit; Sequence refactored onto it).
- `production/api/viewsets/bulk.py` (BulkContractViewSetMixin: check-existence + existence-check alias, bulk-create react/legacy forms, bulk-update POST+PATCH, bulk-archive/restore union, single archive/restore with status flips).
- `production/api/views/project_scoped.py` + `urls_project_scoped.py` (16 endpoints; org/project id/code/slug resolution with Django ValidationError caught on UUID filter; membership gate 403; lists reuse flat filtersets/search/ordering/pagination via shim).
- `organization/api/viewsets/legacy.py`: IdOrCodeDetailMixin, NestedOrganizationMixin (URL org wins, sets _org_context_resolved), FrontendStatusCompatMixin (invitation/api-key/PAT status words), 11 Compat* flat viewsets + 17 Nested* viewsets; `urls_nested.py` (OptionalSlashRouter trailing_slash='/?'); flat registrations in urls_legacy; mount in config/api_urls.
- Identity: `serialize_frontend_membership` + `AuthMembershipsView` (`/api/v1/auth/memberships/`, `/api/v1/users/me/memberships/`).
- Misc: ProjectSelector.summary_counts; projects statistics + client_name search; reviews participant-verdict; playlists paginated; attachments bare-array compat alias; production base id-or-code + include_deleted.
- Fixed pre-existing 500: invitation events dataclass now takes instance=/user= (was breaking ALL invitation mutations). Fixed node loader for workflow cross-refs (_extract_array_source); added _seed_sequences.
- `seed_demo_data` (core): runs seed_dev + react overlay (4 orgs, per-org filtered production via temp TS, user-id→email rewrite, memberships/editorial/notes/activity project linkage). Idempotent. VEL1→VEL01 normalization documented.
- Docs: docs/api/MOCK_API_INVENTORY.md, MOCK_DATA_INVENTORY.md, API_MIGRATION_MATRIX.md, REAL_API.md, MOCK_TO_REAL_MIGRATION.md.
- Tests: 45 new (production/tests/test_frontend_contract.py, organization/tests/api/test_contract_compat.py). Full suite: 1665 passed, 1 pre-existing core failure (OrderingQuerySetMixin.ordered missing — dirty-tree breakage, untouched).

## Gotchas for future work
- `Model.objects.filter(id=<non-uuid-string>)` raises Django ValidationError (not ValueError) → must catch it in id-or-code resolvers.
- Invitation/APIKey selectors gate on user.organizations even for staff → tests need memberships.
- Role codes globally unique (can't create per-org 'artist').
- No SQLite config in settings (Postgres only); studiohub-react untouched.
