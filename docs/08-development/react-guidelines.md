# React Development Guidelines

## Overview

This document defines the React development standards for StudioHub. It establishes best practices for building scalable, maintainable, performant, and reusable frontend applications using React 19, TypeScript, Vite, Material UI, and Material React Table.

The frontend architecture follows the same principles as the backend: separation of concerns, modularity, consistency, and testability.

---

# Objectives

The React guidelines promote:

- Component Reusability
- Maintainable Code
- Performance
- Accessibility
- Type Safety
- Consistent UI
- Scalable Architecture
- Excellent Developer Experience

---

# Technology Stack

StudioHub frontend uses:

```text
React 19

TypeScript

Vite

Material UI

Material React Table

React Router

Ky

React Hook Form

Zod

TanStack Query
```

---

# Frontend Architecture

```text
Pages

↓

Layouts

↓

Features

↓

Components

↓

Hooks

↓

API Client

↓

Backend API
```

Each layer has a clearly defined responsibility.

---

# Project Structure

```text
src/
│
├── api/
├── app/
├── assets/
├── components/
├── config/
├── features/
├── hooks/
├── layouts/
├── pages/
├── providers/
├── routes/
├── services/
├── stores/
├── styles/
├── types/
├── utils/
└── main.tsx
```

---

# Component Design

Components should be:

- Small
- Reusable
- Stateless where possible
- Easy to test
- Strongly typed

Avoid creating components that perform multiple unrelated tasks.

---

# Component Types

StudioHub uses three component categories.

## UI Components

Reusable presentation components.

Examples

```text
Button

Dialog

Avatar

Badge

Card
```

---

## Feature Components

Business-specific components.

Examples

```text
UserTable

ProjectForm

TaskBoard

ReviewTimeline
```

---

## Layout Components

Examples

```text
DashboardLayout

AuthLayout

SettingsLayout
```

Layouts should only organize pages.

---

# Functional Components

Always use functional components.

Preferred

```tsx
export function UserCard() {
    return <Card />;
}
```

Avoid class components.

---

# Props

Use explicit TypeScript interfaces.

Example

```tsx
interface UserCardProps {
    user: User;
}
```

Avoid using `any`.

---

# State Management

Use state appropriately.

| State Type | Tool |
|------------|------|
| Local State | useState |
| Derived State | useMemo |
| Server State | TanStack Query |
| Forms | React Hook Form |
| Global UI State | Context (minimal use) |

Avoid unnecessary global state.

---

# API Layer

All API communication should go through the shared API client.

```text
Components

↓

Hooks

↓

API Client

↓

Backend
```

Components should never perform raw HTTP requests.

---

# Hooks

Create reusable hooks.

Examples

```text
useAuth()

useProjects()

usePermissions()

useTheme()

usePagination()
```

Business logic should reside in hooks instead of components whenever practical.

---

# Forms

Use:

- React Hook Form
- Zod Validation
- Controlled Components

Avoid manual form validation.

---

# Routing

Routes belong in:

```text
src/routes/
```

Organize routes by feature.

Example

```text
/dashboard

/projects

/shots

/tasks

/users
```

---

# Styling

Use Material UI.

Prefer:

- sx prop
- Theme customization
- Shared design tokens

Avoid inline CSS whenever possible.

---

# Theme

Use a centralized theme.

Include

- Colors
- Typography
- Spacing
- Breakpoints
- Shadows
- Component Overrides

Do not hardcode colors throughout the application.

---

# Material UI

Prefer official Material UI components.

Examples

```text
DataGrid

Dialog

Drawer

Tabs

Chip

Snackbar

Tooltip
```

Avoid custom implementations unless necessary.

---

# Material React Table

Use Material React Table for enterprise data grids.

Features

- Pagination
- Filtering
- Sorting
- Column Visibility
- Export
- Row Selection
- Virtualization

All tables should use shared configuration.

---

# Performance

Optimize using:

- React.memo
- useMemo
- useCallback
- Lazy Loading
- Code Splitting
- Virtualized Tables

Measure before optimizing.

---

# Error Handling

Provide consistent error handling.

Examples

- Error Boundaries
- Snackbar Notifications
- API Error Components
- Retry Actions

Errors should be user-friendly.

---

# Accessibility

Follow WCAG guidelines.

Include

- Keyboard Navigation
- Proper Labels
- Focus Management
- Screen Reader Support
- Color Contrast

Accessibility should be considered during development.

---

# Testing

Frontend testing should include:

- Component Tests
- Hook Tests
- Integration Tests
- End-to-End Tests

Critical user workflows should always be tested.

---

# Security

Always:

- Escape user-generated content
- Validate input
- Protect authentication state
- Avoid storing sensitive data in local storage
- Use HTTPS

Never expose secrets in frontend code.

---

# Best Practices

- Keep components small.
- Prefer composition over inheritance.
- Use TypeScript everywhere.
- Reuse hooks.
- Centralize API calls.
- Follow Material UI patterns.
- Write reusable components.

---

# Anti-Patterns

Avoid:

- Large components
- Inline business logic
- Excessive prop drilling
- Global mutable state
- Direct HTTP requests from components
- Using `any`
- Hardcoded styles

---

# Related Documents

- overview.md
- coding-standards.md
- typescript-style-guide.md
- git-workflow.md
- testing.md
- ../04-frontend/overview.md
- ../04-frontend/components.md
- ../04-frontend/state-management.md
- ../04-frontend/routing.md
- ../04-frontend/api-integration.md