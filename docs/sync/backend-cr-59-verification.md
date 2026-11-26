# CR-59: verification

Branch `fix/role-delete`, off `develop` at `1924f33b`. Change request: `docs/sync/backend-change-requests.md` CR-59, approved by the owner ("approvde", 2026-11-26). Reported as "unable to delete temporary role".

## The bug, reproduced first

On the test database, as a superuser and as platform-admin, a new role "Temporary" was deleted in four states: with no links, and with a permission, a user or a group attached. Every delete answered 204, and afterwards:
- the role was still in `GET /roles/` and its page still opened (200);
- `PATCH` answered 200 and a second `DELETE` answered 204;
- creating `temporary` again was a 400, "role with this code already exists.".

The row had `is_deleted=True`, but `RoleSelector` reads `Role.objects`, a plain `BaseManager`. Groups behaved the same way. The permission resolver already ignored the deleted role, so it granted nothing.

## What changed

| Where | What |
|---|---|
| `identity/selectors/rbac.py` | `RoleSelector` and `GroupSelector` read live rows only, so a deleted row answers 404 on every route. |
| `identity/services/rbac.py` | `RbacGuardMixin._release_code` renames the code to `<code>--deleted-<first 8 of the id>`, cut to fit the field. `RoleService.delete` and `GroupService.delete` call it and record a `role_changed` event with the original code. |
| `identity/api/serializers/rbac.py` | `AttachRoleSerializer.role_id` and `AttachGroupSerializer.group_id` accept live rows only. |
| `identity/api/viewsets/rbac.py` | `groups/{id}/roles/` leaves out links to deleted roles. |
| `identity/migrations/0005_release_deleted_rbac_codes.py` (new) | Renames the codes of roles and groups that are already deleted. Running it again changes nothing; it is not reversed. |
| `core/tests/test_bootstrap.py` | The identity migration limit goes from 4 to 5. |
| `identity/tests/test_cr59_role_delete.py` (new) | 8 tests. |
| `docs/identity/CONTRACTS.md` | API-RBAC-01, 04 and 06, and DOM-RBAC-03. |

## Checks

- **Tests:** `test_cr59_role_delete.py` has 8 passing tests. Together with identity `security/`, `services/`, `api/`, `permissions/`, `test_no_org_rbac.py`, `core/tests/test_bootstrap.py`, `test_contract.py` and `test_contract_regression.py`, 1,199 passed. Not the full suite (targeted tests only).
- **Lint and types:** `ruff check` is clean. The changed files were formatted at the base, or are new, and are formatted. `basedpyright` shows 0 errors. `makemigrations --check` finds no changes.
- **Mutation checks**, each caught:
  1. the role selector without the filter;
  2. the group selector without the filter;
  3. a role delete that keeps the code;
  4. the renamed code not cut to fit;
  5. attaching a deleted role allowed;
  6. attaching a deleted group allowed;
  7. the group's role list showing deleted roles;
  8. the migration renaming an already-released code again;
  9. a group delete that keeps the code.

## Upgrading

- Migration `identity.0005` frees the codes of roles and groups already deleted. A deleted "temporary" role disappears from the Roles list as soon as the backend is deployed, and its code can be used again.
- No frontend change.
