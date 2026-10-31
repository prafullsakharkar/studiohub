# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StudioHub is a comprehensive React-based studio management platform built with Vite, TypeScript, and Tailwind CSS. It's a full-featured SaaS application with modules for production, asset management, reviews, workflows, and more.

**Tech Stack:**
- **Frontend:** React 19, TypeScript 5.8
- **Build Tool:** Vite 6
- **Package Manager:** pnpm
- **Styling:** Tailwind CSS 4, Emotion (MUI)
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
├── api/                    # API client and error handling
│   ├── client/            # HTTP client (Ky-based)
│   └── errors/            # Error mapping and handling
├── core/                   # Application core services
│   ├── auth/              # Authentication context and provider
│   ├── permissions/       # RBAC system with role/permission checks
│   ├── workspace/         # Workspace state (Zustand store)
│   ├── production/        # Production store
│   ├── repository/        # BaseRepository abstract class
│   ├── logging/           # Logger utility
│   └── errors/            # Error boundary component
├── components/            # Canonical components (single authoritative implementations)
│   ├── ui/                # Button, Dialog, Drawer, Badge, Card, Input... (barrel re-exports shared primitives)
│   ├── data/              # DataTable, FilterBar
│   ├── workspace/         # Workspace chrome
│   ├── entity/            # Configuration-driven entity presentation
│   ├── forms/             # FormDialog, FormDrawer, FormSection
│   ├── navigation/        # Global/context navigation
│   └── system/            # Loading/Error states, ConfirmDialog, Feature/Permission gates
├── modules/               # Feature modules (see below)
├── routes/                # Route definitions (AppRoutes.tsx)
├── layouts/               # Layout components (AppLayout)
├── shared/                # Shared utilities
│   ├── components/        # Reusable UI components
│   ├── crud/              # CRUD table component
│   ├── hooks/             # Shared hooks
│   ├── stores/            # Shared Zustand stores
│   ├── utils/             # Utility functions
│   └── views/             # View helpers
├── providers/             # Context providers (Query, Theme)
├── types/                 # Global type definitions
└── pages/                 # Error/system pages (404, 403, 500)
```

### Module Structure

Each module follows this pattern:
```
modules/<module-name>/
├── pages/           # Page components (route endpoints)
├── components/      # Module-specific components
├── hooks/           # Module-specific hooks
├── services/        # Business logic (API calls)
├── repositories/    # Data access layer (extends BaseRepository)
├── schemas/         # Zod validation schemas (auth module)
└── utils/           # Module utilities (scheduling module)
```

**Major Modules:**
- `auth` – Login, authentication, token management
- `production` – Projects, shots, assets, versions
- `tasks` – Task management, time logging
- `reviews` – Review sessions, playlists
- `publishing` – Content publishing
- `deliveries` – Delivery management
- `workflows` – Workflow builder and automation
- `scheduling` – Calendar and event scheduling
- `intelligence` – Search, knowledge base, AI/copilot, analytics, integrations, automations
- `audit` – Activity and audit logging
- `dashboard` – Dashboard views
- `settings` – User settings
- `platform` – Notifications, billing, reports, data platform

### Core Services & Patterns

#### Authentication & Permissions
- **AuthProvider** (`src/core/auth/AuthProvider.tsx`) – Manages user state, login/logout
- **RBAC System** (`src/core/permissions/rbac.ts`) – Role and permission checking
- **Protected Routes** – `ProtectedRoute` and `GuestRoute` wrappers enforce authorization
- **Permission Components** – `<Can>`, `<HasRole>`, `<ProtectedComponent>` for conditional rendering

#### Data Layer
- **BaseRepository** (`src/core/repository/BaseRepository.ts`) – Abstract class extending all repositories
  - Provides CRUD, search, bulk operations, restore
  - Expects DRF (Django REST Framework) API format with trailing slashes
  - PaginatedResponse wrapper for list endpoints
- **ApiClient** (`src/api/client/ApiClient.ts`) – HTTP client wrapper (Ky-based)
- **Error Handling** (`src/api/errors/errorMapper.ts`) – Maps API errors to user-friendly messages

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

All common UI/UX patterns have ONE implementation, imported via the canonical barrel:

```typescript
import { Button, Dialog, DataTable, LoadingState } from '@/components';
```

Do not import these from `@/shared/components/*` in feature code, and never create module-local duplicates. Full registry and ownership rules: [`docs/frontend/CANONICAL_COMPONENTS.md`](docs/frontend/CANONICAL_COMPONENTS.md).

### Type System

Global types in `src/types/`:
- `auth.ts` – User, Role, Permission
- `drf.ts` – DRF pagination (PaginatedResponse, QueryParams)
- `common.ts` – Base types (timestamps, IDs)
- `crud.ts` – Standard CRUD response shape
- `<module>.ts` – Domain-specific types

**Type Path Alias:**
```typescript
// Available: @/* maps to src/*
import { User } from '@/types/auth';
import { ProjectService } from '@/modules/production/services/ProjectService';
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
1. Create module directory: `src/modules/<name>/`
2. Add subdirectories: `pages/`, `components/`, `hooks/`, `services/`, `repositories/`
3. Create repository extending `BaseRepository<T>`
4. Create service layer calling repository methods
5. Create page component (hook into the service)
6. Add routes to `AppRoutes.tsx`
7. Add navigation link to sidebar/menu

### Adding an API Endpoint
1. Verify the route and its response in `docs/sync/00-backend-inventory.md` or the OpenAPI schema; never invent one.
2. Add a typed module in `src/api/<app>/` (types from `openapi.ts`, a query-key factory, `listFetcher` for lists).
3. Use `usePaginatedList` / `useQuery` / `useMutation` in a hook; show errors with `QueryBoundary` and `useServerForm`.
4. Add a test that serves a captured sample (`loadSample` + `mockFetch`); capture a new one with the tools in `docs/sync/tools/` if none exists.

### Adding Form Validation
1. Define Zod schema in `src/modules/<module>/schemas/`
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
