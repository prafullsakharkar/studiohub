# Frontend Overview

## Purpose

This section documents the frontend application that consumes the backend API described in `05-api`. It covers the stack, conventions, and architectural decisions that keep the codebase consistent as it grows across modules (identity, organization, production, core).

## Stack

This reflects the actual `package.json` for StudioHub's frontend, not a generic default:

| Concern            | Choice                          | Why |
|---------------------|----------------------------------|-----|
| Build tool           | Vite                             | Fast dev server, native ESM, minimal config |
| Language             | TypeScript (strict mode)         | Type safety across API boundaries |
| UI library            | React 19                         | Concurrent features, current ecosystem support |
| UI kit                 | MUI v7 (`@mui/material`, `@mui/lab`, `@mui/x-date-pickers`) | Fast to ship an accessible, enterprise-grade UI; matches the admin/production-tool nature of the app |
| Routing               | React Router v7 (data routers)   | Loaders/actions map cleanly to our API-driven pages |
| Server state           | TanStack Query (React Query)     | Caching, invalidation, and request dedup for API data |
| Client/UI state         | Zustand *(recommended addition)*  | Lightweight, no boilerplate; holds the in-memory session token and UI state |
| Forms                   | React Hook Form + Zod             | Performant uncontrolled forms with schema validation |
| Tables                    | Material React Table (wraps TanStack Table) | MUI-native styling with headless-table server-side pagination/sorting/filtering underneath |
| Styling                    | MUI theme (tokens/variants) + Tailwind (layout utilities only) | MUI owns color/typography/components; Tailwind is scoped to spacing/flex/grid so the two don't compete for the same job |
| HTTP client                 | **ky** (fetch-based)               | Smaller surface than Axios, built-in retry/timeout, hooks map cleanly onto JWT refresh (see `authentication.md`) |
| Internationalization          | i18next / react-i18next, with RTL support (`stylis-plugin-rtl`) | Multi-locale studios, including RTL locales |
| Notifications                  | notistack                          | MUI-native toast/snackbar system |
| Charts                          | Highcharts                          | Production/analytics reporting views |
| Testing                          | Vitest + React Testing Library *(recommended addition)* | Not yet in `package.json` — see `07-development/testing.md` equivalent for frontend |

The one deliberate exception to "one HTTP client": large VFX asset uploads (plates, renders, versions) bypass `ky` for a raw `XMLHttpRequest`/resumable-upload path, because `fetch`-based clients can't report upload progress reliably. This is documented explicitly in `api-client.md` rather than left as an unexplained inconsistency.

## Guiding Principles

1. **The API is the source of truth.** The frontend does not duplicate backend business logic (validation rules, permissions, calculations). It reflects what the API returns and enforces UX-level constraints only (see `05-api/overview.md`).
2. **Server state and client state are separate.** Data that lives on the server (users, offices, departments) is managed by React Query. Data that is purely UI (modal open/closed, selected tab) lives in local state or Zustand. We do not put server data into Zustand or Context.
3. **Feature-first organization.** Code is grouped by domain module (identity, organization, production, core) before it is grouped by technical type. See `project-structure.md`.
4. **MUI is the design system, not a skin.** Colors, typography, and component variants are defined once in the theme object (`themes.md`) and consumed via MUI's component props/`sx`, not overridden ad hoc per usage. Material React Table is used specifically because it stays inside this system rather than introducing a second, competing visual language.
5. **Security is a frontend responsibility, not just a backend one.** Given the Identity module's JWT rotation, MFA, and RBAC, the frontend treats token storage, session handling, and permission-aware UI as first-class concerns — see `authentication.md`. UI-level permission checks are a UX nicety on top of the backend's real enforcement, never a substitute for it.
6. **Typed all the way through.** API response types are generated or hand-mirrored from the OpenAPI schema (`05-api/openapi.md`) and shared across api-client, forms, and tables.

## How This Section Is Organized

- `project-structure.md` — folder layout and module boundaries
- `routing.md` — route definitions, guards, code-splitting
- `state-management.md` — React Query + Zustand conventions
- `api-client.md` — the Axios wrapper, typed endpoints, error handling
- `authentication.md` — login flow, token storage/refresh, route protection
- `forms.md` — React Hook Form + Zod patterns
- `tables.md` — TanStack Table conventions for list views
- `components.md` — component architecture and conventions
- `layouts.md` — page/app shell layouts
- `themes.md` — design tokens and theming

Related backend docs: `02-architecture/overview.md`, `05-api/overview.md`, `06-security/jwt.md`.
