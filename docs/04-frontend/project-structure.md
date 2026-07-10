# Project Structure

The frontend is organized **feature-first**: each business module (mirroring the backend modules in `08-modules`) owns its own routes, components, hooks, and types. Shared, cross-module code lives in `shared/`.

```
frontend/
├── public/
├── src/
│   ├── app/                     # App shell: providers, router, entry point
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   ├── providers.tsx        # QueryClientProvider, ThemeProvider, etc.
│   │   └── main.tsx
│   │
│   ├── modules/                 # One folder per business module
│   │   ├── identity/
│   │   │   ├── api/             # Typed endpoint functions for this module
│   │   │   ├── components/      # Module-specific components
│   │   │   ├── hooks/           # useUsers(), useLogin(), etc.
│   │   │   ├── pages/           # Route-level components
│   │   │   ├── types.ts         # Module-specific types/DTOs
│   │   │   └── routes.tsx       # Route definitions for this module
│   │   │
│   │   ├── organization/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── pages/
│   │   │   ├── types.ts
│   │   │   └── routes.tsx
│   │   │
│   │   ├── production/
│   │   │   └── ...              # Same shape
│   │   │
│   │   └── core/
│   │       └── ...              # Same shape
│   │
│   ├── shared/
│   │   ├── api/                 # Axios instance, interceptors, base client
│   │   ├── components/          # Design-system-level components (Button, Input, Table shell...)
│   │   ├── hooks/                # Cross-cutting hooks (useDebounce, usePagination)
│   │   ├── layouts/               # AppShell, AuthLayout, etc.
│   │   ├── lib/                    # Non-React utilities (formatters, constants)
│   │   ├── stores/                  # Zustand stores (ui state, session state)
│   │   └── types/                    # Shared/global types (Paginated<T>, ApiError, etc.)
│   │
│   ├── styles/
│   │   ├── globals.css
│   │   └── tokens.css             # CSS variables consumed by Tailwind (see themes.md)
│   │
│   └── test/
│       ├── setup.ts
│       └── utils.tsx               # render() wrapper with providers
│
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Module Boundary Rules

- A module (`modules/identity`, `modules/organization`, etc.) may import from `shared/` freely.
- A module must **not** import directly from another module's internals (`modules/organization/hooks/...` inside `modules/identity`). If two modules need the same logic, promote it to `shared/`.
- `shared/components` holds only generic, domain-agnostic UI (buttons, inputs, modals, table shell). Anything that knows about "users" or "departments" belongs in the owning module.
- Route registration is decentralized: each module exports a `routes.tsx`, and `app/router.tsx` composes them. This keeps route-to-module mapping obvious and lets modules be code-split independently (see `routing.md`).

## Naming Conventions

- Components: `PascalCase.tsx` (e.g. `UserTable.tsx`)
- Hooks: `useX.ts` (e.g. `useUsers.ts`)
- API endpoint files: `<resource>.api.ts` (e.g. `users.api.ts`)
- Types: `types.ts` per module, or colocated `Component.types.ts` for large components
- Tests colocated as `*.test.tsx` / `*.test.ts` next to the file under test

This mirrors the backend's modular monolith approach (`02-architecture/modular-monolith.md`) so a contributor working across the stack finds the same module names in both places.
