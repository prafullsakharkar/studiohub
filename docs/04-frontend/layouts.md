# Layouts

Layouts compose the app "shell" around route content. They live in `shared/layouts/` and are wired in at the router level (see `routing.md`).

## AppShell

The primary authenticated layout: top nav/header, collapsible sidebar (module navigation), and a content outlet.

```tsx
// src/shared/layouts/AppShell.tsx
export function AppShell() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
```

- **Sidebar** renders navigation grouped by module, filtered by the current user's permissions (`RequirePermission`-aware nav items, so users never see links to sections they can't access).
- **Topbar** hosts breadcrumbs, global search, notifications, and the user/account menu.
- Sidebar collapsed/expanded state is UI state, stored in the `uiStore` (Zustand) and persisted across sessions.

## AuthLayout

A minimal, centered layout for unauthenticated routes (login, forgot password, MFA challenge) — no sidebar/topbar, typically a centered card on a branded background.

```tsx
export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
}
```

## Page-Level Layout Conventions

Within `AppShell`, individual pages follow a consistent structure via a shared `PageHeader` composite:

```tsx
<PageHeader
  title="Departments"
  breadcrumbs={[{ label: "Organization", to: "/organization" }, { label: "Departments" }]}
  actions={<Button onClick={openCreateModal}>New Department</Button>}
/>
<DataTable ... />
```

This keeps title placement, spacing, and action-button positioning consistent across modules without every page reimplementing header markup.

## Responsive Behavior

- Sidebar collapses to an icon-only rail below a defined breakpoint, and to an overlay drawer on mobile widths.
- Tables (see `tables.md`) switch to a stacked card layout below the `sm` breakpoint via the shared `DataTable` component, rather than each module handling responsive table logic individually.

## Nested Layouts

Some modules define an additional nested layout for sub-navigation (e.g. a settings area with its own left-hand tab list). These live in the owning module (`modules/identity/layouts/SettingsLayout.tsx`) and are only used within that module's route subtree — they don't get promoted to `shared/` unless a second module needs the same pattern.
