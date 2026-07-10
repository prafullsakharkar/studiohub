# End-to-End Testing Guide

## Overview

End-to-End (E2E) testing validates complete business workflows by exercising the application from the user's perspective. Unlike unit and integration tests, E2E tests verify that the frontend, backend, database, authentication, and supporting infrastructure work together as a complete system.

StudioHub uses E2E testing to protect its most critical user journeys and ensure production readiness before release.

---

# Objectives

End-to-End testing aims to:

- Validate complete business workflows
- Verify real user interactions
- Detect integration regressions
- Improve release confidence
- Ensure production readiness
- Validate cross-module functionality
- Verify browser compatibility
- Reduce production defects

---

# Scope

E2E testing covers:

- User Authentication
- Organization Management
- Project Management
- Shot Management
- Asset Management
- Task Management
- Review Workflow
- File Uploads
- Notifications
- Reporting
- User Administration

Only high-value business workflows should be covered by E2E tests.

---

# Testing Stack

StudioHub uses:

```text
Playwright

TypeScript

MSW (for isolated scenarios)

Docker Test Environment
```

Playwright is the preferred framework due to its speed, reliability, and cross-browser support.

---

# Testing Workflow

```text
Browser

↓

Frontend

↓

REST API

↓

Service Layer

↓

Database

↓

Response

↓

User Validation
```

The entire request lifecycle is validated.

---

# Test Organization

```text
tests/

e2e/

authentication/

organizations/

projects/

shots/

assets/

tasks/

reviews/

users/
```

Each business domain should own its own E2E test suite.

---

# Critical Workflows

Examples include:

```text
User Login

↓

Create Organization

↓

Invite User

↓

Create Project

↓

Create Sequence

↓

Create Shot

↓

Assign Task

↓

Submit Review

↓

Approve Review
```

These workflows should remain stable across releases.

---

# Authentication Testing

Verify:

- Login
- Logout
- Session Expiration
- Remember Me
- Password Reset
- MFA Login
- Account Lockout

Authentication is a critical production workflow.

---

# Authorization Testing

Verify:

- Organization Isolation
- Role Permissions
- Feature Restrictions
- Object Permissions
- Administrative Access

Users should only access authorized resources.

---

# CRUD Workflows

Validate complete lifecycle operations:

- Create
- Read
- Update
- Delete
- Restore (if supported)

Verify UI updates and backend persistence.

---

# File Upload Testing

Validate:

- Upload Images
- Upload Videos
- Upload Documents
- Invalid File Types
- File Size Limits
- Upload Progress
- Download

Large file uploads should remain reliable.

---

# Material React Table

Verify:

- Pagination
- Filtering
- Sorting
- Search
- Column Visibility
- Bulk Selection
- Export

Enterprise tables should function correctly with realistic datasets.

---

# Error Handling

Verify:

- Validation Errors
- Network Failures
- Server Errors
- Unauthorized Access
- Permission Errors
- Session Timeout

Error messages should be meaningful to users.

---

# Responsive Testing

Validate workflows on:

- Mobile
- Tablet
- Desktop

Critical workflows should remain functional across supported screen sizes.

---

# Browser Testing

Supported browsers:

- Chrome
- Firefox
- Edge
- Safari

Cross-browser testing should focus on critical business workflows.

---

# Test Data

Prefer isolated test environments.

Use:

- Seed Data
- Factories
- Temporary Users
- Disposable Organizations

Each test should clean up after itself whenever possible.

---

# Environment

Run E2E tests against:

- Local Environment
- CI Environment
- Staging

Production environments should generally be excluded except for smoke tests.

---

# Retry Strategy

Retries should be limited.

Appropriate scenarios:

- Temporary network instability
- Browser startup failures

Retries should not hide application defects.

---

# Performance Validation

Monitor:

- Page Load Time
- Navigation Time
- API Response Time
- Rendering Performance

Performance regressions should be investigated promptly.

---

# Running Tests

Run all E2E tests.

```bash
npm run test:e2e
```

Run a specific suite.

```bash
npm run test:e2e -- authentication
```

Run headed mode.

```bash
npm run test:e2e:headed
```

---

# Continuous Integration

E2E tests should execute:

- Before production releases
- During nightly builds
- After major infrastructure changes
- On release branches

A small smoke suite may also run on every Pull Request.

---

# Best Practices

- Test real user workflows.
- Keep tests independent.
- Use stable selectors.
- Minimize test data dependencies.
- Focus on business value.
- Keep scenarios readable.
- Remove obsolete tests promptly.

---

# Anti-Patterns

Avoid:

- Testing every UI detail
- Large monolithic scenarios
- Hardcoded wait times
- Shared mutable test data
- Environment-specific assumptions
- Fragile CSS selectors
- Excessive duplication

---

# Related Documents

- overview.md
- frontend-testing.md
- integration-testing.md
- performance-testing.md
- security-testing.md
- ci-testing.md
- ../04-frontend/testing.md
- ../07-deployment/release-process.md
- ../08-development/testing.md