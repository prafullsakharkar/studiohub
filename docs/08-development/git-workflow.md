# Git Workflow

## Overview

StudioHub follows a disciplined Git workflow to ensure a clean commit history, reliable collaboration, and predictable releases. Every code change must be traceable from the initial issue through implementation, review, testing, and deployment.

The workflow integrates with the project's branching strategy, CI/CD pipeline, and code review process.

---

# Objectives

The Git workflow provides:

- Consistent Development Process
- Clean Commit History
- Reliable Collaboration
- Automated Validation
- Easy Rollbacks
- Release Traceability
- High Code Quality
- Stable Production Releases

---

# Workflow Overview

```text
Create Issue

↓

Create Feature Branch

↓

Develop Feature

↓

Commit Changes

↓

Push Branch

↓

Open Pull Request

↓

Automated CI Checks

↓

Code Review

↓

Approval

↓

Merge

↓

Deploy
```

---

# Development Workflow

## Step 1 — Update Local Repository

Always start by synchronizing with the latest changes.

```bash
git checkout develop

git pull origin develop
```

---

## Step 2 — Create a Branch

Create a branch from `develop`.

```bash
git checkout -b feature/project-dashboard
```

Examples

```text
feature/user-management

feature/mfa

bugfix/login

docs/api-guide
```

---

## Step 3 — Develop

During development:

- Write clean code
- Add tests
- Update documentation
- Run local validation
- Keep commits focused

Commit frequently with meaningful messages.

---

## Step 4 — Verify Before Commit

Run project quality checks.

Backend

```bash
ruff check .

ruff format .

python manage.py test
```

Frontend

```bash
npm run lint

npm run type-check

npm run test
```

Never commit code that fails validation.

---

# Commit Guidelines

Each commit should represent a single logical change.

Examples

```text
Add project dashboard filters

Implement MFA recovery codes

Fix organization permission lookup

Update deployment documentation
```

Avoid combining unrelated changes into one commit.

---

# Commit Message Format

StudioHub follows the Conventional Commits specification.

Format

```text
<type>: <summary>
```

Examples

```text
feat: add project dashboard

fix: resolve login redirect

docs: update deployment guide

refactor: simplify task service

test: add organization API tests

chore: upgrade dependencies
```

---

# Common Commit Types

| Type | Description |
|--------|-------------|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation |
| refactor | Code restructuring |
| test | Tests |
| style | Formatting only |
| perf | Performance improvement |
| build | Build changes |
| ci | CI/CD updates |
| chore | Maintenance |

---

# Push Changes

Push the feature branch.

```bash
git push origin feature/project-dashboard
```

Never push directly to `main`.

---

# Pull Requests

Create a Pull Request against `develop`.

A Pull Request should include:

- Description
- Linked Issue
- Testing Notes
- Screenshots (if applicable)
- Documentation Updates

---

# Continuous Integration

Every Pull Request automatically runs:

- Ruff
- Type Checking
- Backend Tests
- Frontend Tests
- Security Scan
- Build Verification

All required checks must pass before merging.

---

# Code Review

Every Pull Request requires review.

Review focuses on:

- Architecture
- Readability
- Maintainability
- Security
- Performance
- Testing
- Documentation

Feedback should be constructive and actionable.

---

# Addressing Review Feedback

When review comments are received:

1. Make the requested changes.
2. Run validation again.
3. Push additional commits.
4. Request another review if needed.

Avoid force-pushing reviewed branches unless absolutely necessary.

---

# Merge Strategy

Preferred merge method

```text
Squash and Merge
```

Benefits

- Clean history
- Single commit per feature
- Easier release notes
- Simplified rollback

---

# After Merge

After the Pull Request is merged:

Delete the local branch.

```bash
git branch -d feature/project-dashboard
```

Delete the remote branch.

```bash
git push origin --delete feature/project-dashboard
```

Update your local repository.

```bash
git checkout develop

git pull origin develop
```

---

# Resolving Merge Conflicts

If conflicts occur:

1. Update your branch.
2. Resolve conflicts manually.
3. Run all tests.
4. Commit the resolution.
5. Push the updated branch.

Conflicts should be resolved carefully to avoid introducing regressions.

---

# Handling Hotfixes

Production hotfix workflow.

```text
main

↓

hotfix/security-fix

↓

Review

↓

Merge to main

↓

Merge back to develop
```

Hotfixes should be limited to critical production issues.

---

# Large Features

Large features should be split into multiple Pull Requests.

Example

```text
Authentication

↓

User API

↓

Permissions

↓

Frontend

↓

Documentation
```

Smaller Pull Requests are easier to review and test.

---

# Git Best Practices

- Commit early and often.
- Keep commits focused.
- Write meaningful commit messages.
- Pull frequently.
- Rebase when appropriate.
- Resolve conflicts promptly.
- Delete merged branches.

---

# Anti-Patterns

Avoid:

- Direct commits to `main`
- Large monolithic commits
- Force pushing shared branches
- Committing generated files
- Mixing formatting with feature changes
- Skipping code review
- Ignoring CI failures

---

# Related Documents

- overview.md
- branching-strategy.md
- contributing.md
- coding-standards.md
- testing.md
- ../07-deployment/ci-cd.md
- ../07-deployment/release-process.md
- ../10-security/code-review.md
- ../10-security/secure-coding.md