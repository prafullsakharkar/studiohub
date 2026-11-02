# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StudioHub is a comprehensive React-based studio management platform built with Vite, TypeScript, and Tailwind CSS. It's a full-featured SaaS application with modules for production, asset management, reviews, workflows, and more.

**Tech Stack:**
- **Frontend:** React 19, TypeScript 5.8
- **Build Tool:** Vite 6
- **Package Manager:** pnpm
- **Styling:** Tailwind CSS 4, Emotion (MUI)
- **Lint/format:** Biome (`pnpm exec biome check src`)
- **State Management:** Zustand, React Query
- **Forms:** React Hook Form, Zod validation
- **Routing:** React Router v7
- **UI Components:** MUI 9, Lucide React icons
- **Data Visualization:** Recharts
- **Testing:** Vitest + Testing Library (jsdom); Playwright for e2e
- **Runtime:** Express.js for server

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server (runs on port 3000)
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Clean build artifacts
pnpm clean

# Type check (no emit)
pnpm lint
```

### Running Tests
```bash
pnpm test                      # vitest run (jsdom)
pnpm vitest run src/path/to/file.test.ts   # one file
pnpm typecheck                 # tsc --noEmit
```
Tests must not depend on a developer's git-ignored `.env`: the API base URL is pinned in `vitest.config.ts`.
**Mocks come from real responses.** `docs/sync/samples/` holds responses captured from the backend (see `docs/sync/samples/README.md`); load them with `loadSample()` from `@/test/samples` and serve them with `mockFetch()` from `@/test/fetchMock`. Do not hand-write response shapes.

## Project Architecture

### High-Level Structure

```
src/
├── api/                    # The typed API client: one folder per backend app
│   ├── client/            # ApiClient (Ky-based), URL and config helpers
│   ├── errors/            # normalizeApiError and the error classes
│   └── <app>/             # identity, masterdata, production, publishing, deliveries, scheduling, settings, audit, analytics
│                          #   <thing>.ts typed routes + query keys; *RowKeys.ts compile-time key lists pinned to captured responses
├── core/                   # Application core services
│   ├── auth/              # AuthProvider, tokenStorage, session cleanup
│   ├── permissions/       # useCan / evaluateAccess over backend permission codes, the route registry
│   ├── production/        # useProductionStore: the chosen, recent and favourite projects
│   ├── api/generated/     # openapi.ts, generated from the backend schema
│   ├── layout/ notifications/ logging/ errors/
├── components/            # Cross-module pieces: forms/EntityPicker, history/EntityHistory, system/ (QueryBoundary, ConfirmDialog, ApiErrorState), ui/ (Dialog, SmartImg)
├── modules/               # Feature modules (see below)
├── features/dashboard/    # The dashboard (the one feature that is not under modules/)
├── routes/                # AppRoutes.tsx, route guards, lazyNamed
├── layouts/               # AppLayout, Sidebar, Header, Breadcrumbs, ProjectSwitcher
├── shared/
│   ├── components/        # Button, Modal, Badge, Card, Pagination, EmptyState, tabs/, bulk/ …
│   ├── workspace/canonical/  # WorkspaceShell, WorkspaceHeader, WorkspaceActionBar, WorkspaceOverflowMenu
│   ├── data/              # listFetcher, usePaginatedList, fetchAllRows, query keys
│   ├── forms/             # useServerForm, server error mapping
│   ├── hooks/ stores/ utils/ layouts/
├── providers/             # QueryProvider, ThemeProvider
├── test/                  # fetchMock, samples loader, live/ (tests against a real backend)
├── types/                 # common.ts, identity.ts
└── pages/                 # 401/403/404/500 and no-project-access pages
```

### Module Structure

Each module holds what its screens need; there is no per-module data layer (the typed API lives in `src/api/<app>/`):
```
modules/<module-name>/
├── pages/           # Page components (route endpoints)
├── components/      # Module-specific components
├── hooks/           # Module-specific hooks (React Query over the typed API)
└── index.ts         # Public boundary: other code imports '@/modules/<name>', never deep paths
```
Directory-style records (clients, vendors, people, departments, teams, offices, positions, catalog, versions, …) are *configs*, not pages: `modules/directory/{DirectoryListPage,DirectoryFormPage}` take a config, and `modules/directory/workspace/` holds the shared record-workspace pieces.

**Modules:** `assets`, `audit`, `auth`, `catalog`, `clients`, `dashboard`, `deliveries`, `departments`, `directory`, `identity` (account, access/RBAC), `media`, `offices`, `people`, `platform` (health), `playlists`, `production` (projects, structure, work, review), `publishing`, `reviews`, `scheduling`, `settings`, `shots`, `tasks`, `teams`, `vendors`, `versions`, `workflows`.

### Core Services & Patterns

#### Authentication & Permissions
- **AuthProvider** (`src/core/auth/AuthProvider.tsx`) – the signed-in user comes from `/auth/me`; no cached fallback
- **Permissions** (`src/core/permissions/`) – `useCan(code)` / `evaluateAccess` over backend permission codes; `routePermissionsRegistry.ts` guards routes; role names are display labels only
- **Route guards** – `ProtectedRoute`, `GuestRoute`, `RoutePermissionGuard`, `ProjectRoute` (project membership)
- **Gating components** – `PermissionGate`, `PermissionButton`, `PermissionMenuItem` (`core/permissions/PermissionComponents.tsx`) and the `permission` field of workspace actions

#### Data Layer
- **ApiClient** (`src/api/client/ApiClient.ts`) – HTTP client wrapper (Ky-based); tokens are added and refreshed here
- **Typed API modules** (`src/api/<app>/`) – one typed function per backend route, query-key factories, `resourceApi` for plain CRUD, `listFetcher` for lists
- **Errors** (`src/api/errors/normalizeApiError.ts`) – every error body becomes `{status, message, fieldErrors, nonFieldErrors, code, requestId}`

#### State Management
- **Zustand Stores** (`src/core/production/useProductionStore.ts`: the chosen, recent and favourite projects)
  - Persisted in localStorage; `clearUserScopedState()` (`src/core/auth/sessionCleanup.ts`) empties it whenever a session ends
- **React Query** – Caching and syncing remote data
- **Context API** – Auth, Theme providers

#### Theme & Styling
- **ThemeProvider** (`src/providers/ThemeProvider.tsx`) – Dark/light mode toggle
- **Tailwind CSS 4** – Utility-first styling (no config file needed, integrated with Vite)
- **Emotion** – CSS-in-JS for MUI components

### Routing Pattern

Routes are centralized in `src/routes/AppRoutes.tsx`:
- Public routes: `/login`, `/forgot-password` (wrapped in `<GuestRoute>`)
- Protected routes: Everything else (wrapped in `<ProtectedRoute>`)
- All protected routes use `<AppLayout>` as a shell (header, sidebar, etc.)
- Error routes: `/unauthorized`, `/forbidden`, `/error`, `/*` (404)

**Route naming convention:**
- List pages: `/module` (e.g., `/projects`, `/tasks`)
- Detail/create: `/module/:id` or `/module/new`
- Edit forms: `/module/:id/edit`
- Workspaces: `/module/:id` (detail view in a workspace panel)

### Canonical Component Rule

One implementation per pattern; reuse it, do not write a module-local copy. The registry of what exists and where it lives (checked against the file tree) is [`docs/frontend/CANONICAL_COMPONENTS.md`](docs/frontend/CANONICAL_COMPONENTS.md). There is no `@/components` barrel: import from the file that owns the component.

### Type System

- API types live beside the call that uses them, in `src/api/<app>/` (shapes from `openapi.ts` and captured responses). Do not add a hand-written shape for a backend record.
- `src/types/common.ts` – pagination and shared base types; `src/types/identity.ts` – User, membership and permission types.

**Type Path Alias:**
```typescript
// Available: @/* maps to src/*
import type { User } from '@/types/identity';
import { projectsApi } from '@/api/production/structure';
```

### Backend contract

The frontend talks only to the live DRF backend; there is no mock mode. The contract is the backend itself:
- Types: `src/core/api/generated/openapi.ts`, generated from the backend schema (`pnpm api:generate`, input `src/core/api/generated/schema/django-openapi.yml`). Typed per-app modules live in `src/api/<app>/` (see `src/api/masterdata/departments.ts`).
- Errors: `normalizeApiError` (`src/api/errors/`) turns every error body into `{status, message, fieldErrors, nonFieldErrors, code, requestId, retryAfter}`.
- Lists: `usePaginatedList` / `fetchAllRows` / `toPage` (`src/shared/data/`). Never fetch page 1 and treat it as the whole list; 32 list routes return bare arrays and 46 are paginated.
- Forms: `useServerForm` (`src/shared/forms/`) maps field errors onto inputs and the rest into a banner.
- Permissions: `useCan(code)` / `evaluateAccess` (`src/core/permissions/access.ts`). Gates use **backend permission codes**; legacy codes are translated by `permissionMap.ts` (each entry says why). A test fails on any gate code with no rule.
- Sync notes, change requests and the phase plan: `docs/sync/`.

## Common Development Tasks

### Adding a New Module
1. Create `src/modules/<name>/` with `pages/`, `components/`, `hooks/` and an `index.ts` boundary.
2. If it is a record with a list and a form, write a config for `DirectoryListPage` / `DirectoryFormPage` (see `modules/directory/entities`) instead of new pages.
3. Add the typed API first (next section); the module only uses it.
4. Add the route to `AppRoutes.tsx` (load the page with `lazyNamed`) and an entry in `core/permissions/routePermissionsRegistry.ts`.
5. Add the navigation link to the sidebar.

### Adding an API Endpoint
1. Verify the route and its response in `docs/sync/00-backend-inventory.md` or the OpenAPI schema; never invent one.
2. Add a typed module in `src/api/<app>/` (types from `openapi.ts`, a query-key factory, `listFetcher` for lists).
3. Use `usePaginatedList` / `useQuery` / `useMutation` in a hook; show errors with `QueryBoundary` and `useServerForm`.
4. Add a test that serves a captured sample (`loadSample` + `mockFetch`); capture a new one with the tools in `docs/sync/tools/` if none exists.

### Adding Form Validation
1. Define a Zod schema in `src/modules/<module>/schemas/` (directory records use `modules/directory/formModel.ts` instead)
2. Use `useServerForm` (`src/shared/forms/`, a `useForm` that also maps backend errors) with `zodResolver`
3. Submit with `submit(async (values) => { await mutation.mutateAsync(...) })`: field errors from a 400 land on the inputs, the rest in `serverError`
4. Display client errors from `formState.errors` and `serverError.banner` / `.details`

### Checking User Permissions
```typescript
import { useCan } from '@/core/permissions/useCan';

const canManageDirectory = useCan('masterdata.directory.manage');   // a backend permission code
const canEditShots = useCan(['shot.update', 'shot.view'], { projectId });
```
`is_superuser` passes every check except controls with no backend (`unbacked` rules). Role names are display labels, never used for authorization. This only hides UI; the API checks every request again.

## Configuration Files

- `tsconfig.json` – TypeScript config (target ES2022, path alias `@/*`)
- `vite.config.ts` – Vite configuration with React plugin
- `tailwind.config.ts` – Not needed (Tailwind 4 uses no config file by default)
- `package.json` – Scripts and dependencies

## Important Notes

- **API Format:** Endpoints follow DRF conventions (trailing slashes, paginated responses)
- **Environment:** `.env` should contain `VITE_API_URL` for API base URL
- **Type Safety:** Strict mode enabled; all components should be fully typed
- **Responsive Design:** Use Tailwind breakpoints; test on mobile/tablet
- **Accessibility:** Use semantic HTML, ARIA labels where needed; follow MUI/Lucide defaults
- **Performance:** React Query caches by default; avoid duplicate requests
- **Error Handling:** Wrap API calls with try/catch; display user-friendly error toasts
