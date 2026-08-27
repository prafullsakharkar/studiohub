# Pagination Contract

## Primary Envelope

The frontend type is standard DRF page-number pagination
(`frontend/src/types/drf.ts`):

```ts
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;      // absolute URL incl. ?page=N&page_size=M
  previous: string | null;
  results: T[];
}
```

Query parameters: `page` (default 1), `page_size`. The mock layer also accepts `limit`
as an alias for `page_size` (`paginateDRF` in `mocks/utils/mockServerHelpers.ts`) — the
backend should support both to be safe.

`next`/`previous` are full URL strings or `null`.

## Paginated Endpoints

These endpoints **must always** return `PaginatedResponse<T>`:

| Endpoint | Mock default page size |
|---|---|
| `/api/v1/projects/` | 10 |
| `/api/v1/shots/` | 10 |
| `/api/v1/assets/` | 10 |
| `/api/v1/tasks/` | 10 |
| `/api/v1/timelogs/` | 10 |
| `/api/v1/reviews/` | 10 |
| `/api/v1/versions/` | 20 (router) / 12 (MSW) |
| `/api/v1/workflows/` | 10 |
| `/api/v1/audit/` | 15 |
| `/api/v1/organizations/` | 10 — **only when `page`/`page_size` present** |
| `/api/v1/clients/`, `/api/v1/vendors/`, `/api/v1/people/` | 15 |

Page size is caller-controlled; there is no fixed contract size. The backend default
(`StandardPagination`: 25, max 500) is acceptable as long as the envelope shape matches.

## Bare-Array Endpoints

These endpoints are consumed as plain JSON arrays — **no envelope**:

- `/api/v1/departments/`, `/api/v1/teams/`, `/api/v1/offices/` (legacy flat contract)
- `/api/v1/media/`
- `/api/v1/attachments/`
- `/api/v1/playlists/` (the hook normalizes defensively, but mocks return arrays)
- `/api/v1/scheduling/{events,resources,holidays,leaves}/`
- `/api/v1/automations/rules/`, `/api/v1/automations/audit-logs/`
- `/api/v1/reports/`

`usePlaylists.ts` shows the defensive pattern (`if (Array.isArray(response)) …`), but new
backend work must match the mock behavior exactly rather than rely on it.

## Singleton / Object Endpoints

Plain objects, never wrapped:

- `/api/v1/billing/`, `/api/v1/organization/`, `/api/v1/analytics/kpis/`,
  `/api/v1/settings/pipeline/`, review/version/task/etc. detail routes,
  workflow action responses (`simulate/`, `clone/`, …), playlist action responses.

## Backend Status: ALIGNED (Phase 0 complete)

The Django default (`StandardPagination` in `apps/core/api/pagination/`) now emits the
raw DRF envelope `{count, next, previous, results}` — no `{success,data,meta}` wrapper
anywhere on `/api/v1/*` — and accepts `limit` as an alias for `page_size`
(`BasePagination.get_page_size`). ViewSets inherit raw `ResponseMixin` behavior
(the historically named `ResponseEnvelopeMixin` also emits raw bodies). Verified by
`apps/core/tests/api/` viewset contract tests.
