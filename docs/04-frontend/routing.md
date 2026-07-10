# Routing

Routing uses **React Router v6's data router** (`createBrowserRouter`), which lets routes declare loaders, actions, and error boundaries alongside the component tree.

## Route Composition

Each module owns its own routes and exports them as a `RouteObject[]`. The app router composes them:

```tsx
// src/modules/identity/routes.tsx
import type { RouteObject } from "react-router-dom";
import { lazy } from "react";

const UsersListPage = lazy(() => import("./pages/UsersListPage"));
const UserDetailPage = lazy(() => import("./pages/UserDetailPage"));

export const identityRoutes: RouteObject[] = [
  { path: "users", element: <UsersListPage /> },
  { path: "users/:userId", element: <UserDetailPage /> },
];
```

```tsx
// src/app/router.tsx
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/shared/layouts/AppShell";
import { AuthLayout } from "@/shared/layouts/AuthLayout";
import { RequireAuth } from "@/modules/identity/components/RequireAuth";
import { identityRoutes } from "@/modules/identity/routes";
import { organizationRoutes } from "@/modules/organization/routes";
import { productionRoutes } from "@/modules/production/routes";

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
    ],
  },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      ...identityRoutes,
      ...organizationRoutes,
      ...productionRoutes,
    ],
  },
]);
```

## Route Guards

`RequireAuth` checks the session store (`shared/stores/session.ts`) and redirects unauthenticated users to `/login`, preserving the intended destination:

```tsx
export function RequireAuth({ children }: { children: JSX.Element }) {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
```

Permission-scoped routes (matching `06-security/permissions.md` / `06-security/roles.md`) use a `RequirePermission` wrapper that checks the current user's permission set rather than just authentication:

```tsx
<RequirePermission permission="organization.view_department">
  <DepartmentsPage />
</RequirePermission>
```

## Code Splitting

All page-level components are lazy-loaded (`React.lazy`) and wrapped in a single `<Suspense>` boundary at the `AppShell` level with a route-level loading skeleton. This keeps the initial bundle limited to the shell, auth, and shared UI.

## Data Loading

We do **not** use React Router loaders for server data — that responsibility belongs to React Query (see `state-management.md`), so caching/invalidation behaves consistently across navigations and mutations. Loaders are reserved for lightweight, route-critical checks (e.g. redirecting on invalid IDs).

## URL State

List views (tables) persist filters, sort, and pagination in the URL query string via a shared `useUrlState` hook, so views are shareable/bookmarkable and survive refresh. See `tables.md` for how this integrates with TanStack Table.

## 404 and Error Boundaries

Each top-level route group defines an `errorElement`. A generic `RouteError` component renders a friendly message and reports to the error tracker, distinguishing between 404s (`isRouteErrorResponse(error) && error.status === 404`) and unexpected errors.
