# TypeScript Style Guide

## Overview

This document defines the TypeScript development standards for the StudioHub frontend. It establishes conventions that improve type safety, maintainability, readability, and developer productivity.

TypeScript should be used to model the application's business domain, not merely to satisfy the compiler. Strong typing helps prevent runtime errors and improves IDE support, refactoring, and long-term maintainability.

---

# Objectives

The TypeScript style guide promotes:

- Type Safety
- Readability
- Consistency
- Maintainability
- Refactorability
- Developer Productivity
- Performance
- Scalability

---

# TypeScript Version

StudioHub uses the latest stable TypeScript version supported by React and Vite.

Developers should avoid experimental language features unless approved.

---

# Core Principles

Always prefer:

- Explicit types
- Strong typing
- Predictable APIs
- Immutable data
- Small interfaces
- Composition over inheritance

Avoid unnecessary complexity.

---

# File Naming

Use lowercase with hyphens or feature-based names.

Examples

```text
auth-provider.tsx

project-service.ts

use-projects.ts

project-table.tsx

user.types.ts
```

---

# Naming Conventions

## Interfaces

Use PascalCase.

```ts
interface User {}

interface Project {}

interface ApiResponse {}
```

---

## Types

Use PascalCase.

```ts
type ProjectStatus = "ACTIVE" | "ARCHIVED";

type ApiError = {
    message: string;
};
```

---

## Enums

Prefer string union types unless interoperability requires enums.

Preferred

```ts
type Status = "ACTIVE" | "INACTIVE";
```

Avoid unnecessary enums.

---

## Variables

Use camelCase.

```ts
const currentUser

const projectList

const selectedTask
```

---

## Constants

Use UPPER_SNAKE_CASE for shared constants.

```ts
MAX_UPLOAD_SIZE

DEFAULT_PAGE_SIZE

API_TIMEOUT
```

---

# Type Definitions

Prefer interfaces for object shapes.

```ts
interface User {
    id: string;
    email: string;
}
```

Use `type` for:

- Unions
- Intersections
- Utility Types
- Function Types

---

# Avoid `any`

Never use

```ts
any
```

Instead use

```ts
unknown
```

or create proper interfaces.

Example

```ts
function parse(data: unknown) {}
```

---

# Optional Properties

Use optional fields only when appropriate.

```ts
interface User {
    id: string;
    phone?: string;
}
```

Do not overuse optional properties.

---

# Readonly

Use immutable types where possible.

```ts
interface Project {
    readonly id: string;
}
```

Prefer immutable data structures.

---

# Functions

Always specify return types for exported functions.

Example

```ts
function calculateTotal(): number {
    return 100;
}
```

---

# Arrow Functions

Prefer arrow functions for callbacks.

```ts
const onSave = (): void => {
    ...
};
```

Use named functions when they improve readability.

---

# Generics

Use meaningful generic names.

Good

```ts
function getItem<T>(value: T): T
```

Avoid

```ts
function getItem<A>(value: A)
```

unless the meaning is obvious.

---

# Null & Undefined

Prefer explicit handling.

```ts
if (user == null) {
    return;
}
```

Avoid unsafe non-null assertions (`!`) unless absolutely necessary.

---

# Imports

Group imports by category.

```ts
React

Third-Party Libraries

Internal Modules

Relative Imports
```

Example

```ts
import { useMemo } from "react";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/api";

import "./styles.css";
```

---

# React Props

Always define interfaces.

```ts
interface ProjectCardProps {
    project: Project;
}
```

Avoid inline object definitions for component props.

---

# API Models

Backend API models should be represented with dedicated interfaces.

Example

```ts
interface ProjectResponse {
    id: string;
    name: string;
}
```

Do not use raw JSON objects throughout the application.

---

# Utility Types

Use built-in utility types when appropriate.

Examples

```ts
Partial<T>

Pick<T>

Omit<T>

Record<K, V>

Readonly<T>
```

Avoid rewriting existing utility types.

---

# Error Handling

Define typed API errors.

Example

```ts
interface ApiError {
    code: string;
    message: string;
}
```

Errors should be handled consistently across the application.

---

# Code Organization

Organize code into:

```text
Components

Hooks

Services

Types

Utils

Constants
```

Each file should have a single responsibility.

---

# Formatting

Formatting is enforced using:

- ESLint
- Prettier

Manual formatting should not be necessary.

---

# Performance

Prefer:

- Memoized computations
- Lazy imports
- Strong typing
- Stable object references

Optimize only after profiling.

---

# Testing

TypeScript code should be easy to test.

Avoid hidden dependencies and global mutable state.

---

# Security

Always:

- Validate external data
- Escape user-generated content
- Avoid unsafe type assertions
- Sanitize API inputs where appropriate

Type safety complements—but does not replace—runtime validation.

---

# Best Practices

- Prefer interfaces for object models.
- Avoid `any`.
- Use explicit return types.
- Keep types small and reusable.
- Reuse shared interfaces.
- Write immutable code.
- Keep files focused.

---

# Anti-Patterns

Avoid:

- Using `any`
- Deeply nested types
- Duplicate interfaces
- Massive type definition files
- Non-null assertions everywhere
- Inline object types for reusable models

---

# Related Documents

- overview.md
- coding-standards.md
- react-guidelines.md
- git-workflow.md
- testing.md
- ../04-frontend/overview.md
- ../04-frontend/components.md
- ../04-frontend/api-integration.md
- ../04-frontend/state-management.md
- ../10-security/secure-coding.md