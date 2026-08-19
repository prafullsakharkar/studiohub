# StudioHub Frontend Development Guide

## 1. Getting Started & Development Workflow

### Prerequisites
- Node.js 20+
- React 19 / TypeScript / Vite / Tailwind CSS
- TanStack Query v5

### Running the App
```bash
npm run dev      # Starts Vite dev server on port 3000
npm run lint     # Validates TypeScript types and syntax
npm run build    # Compiles production assets into dist/
```

---

## 2. Directory Structure Conventions

- `src/core/`: Platform primitives, auth, tenancy context, error mappers, logging.
- `src/layouts/`: Global layout components (`AppShell`, `GlobalHeader`, `Sidebar`, `Breadcrumbs`).
- `src/modules/`: Domain feature modules containing services, hooks, components, and pages.
- `src/shared/`: Reusable UI components (`DataTable`, `StatusBadge`, `InspectorDrawer`, `Modal`, `Button`).
- `src/mocks/`: In-memory DRF mock router, seed databases, and request interceptors.

---

## 3. Query & Mutation Guidelines
- Always scope organization queries with the current `activeOrganization.id`.
- Use descriptive query keys: `['clients', orgId, filterParams]`, `['vendors', orgId]`.
- Provide optimistic updates for task status changes and approval verdicts where safe.
- Leverage the `useInspector` hook to trigger contextual right-pane drawer inspections on row clicks.
