# Test Coverage Guide

## Overview

Test coverage measures how much of the StudioHub codebase is exercised by automated tests. While coverage is a useful quality metric, it should never be treated as the primary objective. A high coverage percentage does not necessarily indicate well-tested software if business rules, edge cases, and failure scenarios are not validated.

StudioHub prioritizes meaningful coverage over numerical targets. Tests should verify observable behavior, critical workflows, security boundaries, and business logic.

---

# Objectives

The coverage strategy aims to:

- Measure test completeness
- Identify untested code
- Reduce regression risk
- Improve software quality
- Support safe refactoring
- Increase deployment confidence
- Guide testing priorities
- Track quality trends over time

---

# Coverage Philosophy

StudioHub follows these principles:

- Test behavior, not implementation.
- Prioritize critical business logic.
- Cover failure scenarios.
- Include edge cases.
- Use coverage reports as guidance.
- Do not write meaningless tests solely to increase percentages.

---

# Coverage Types

Coverage analysis includes:

| Coverage Type | Description |
|--------------|-------------|
| Line Coverage | Executed source lines |
| Branch Coverage | Decision branches executed |
| Function Coverage | Executed functions and methods |
| Statement Coverage | Executed statements |
| Path Coverage | Execution paths (limited use) |

Branch coverage is generally more valuable than line coverage.

---

# Coverage Targets

Recommended minimum targets:

| Component | Target |
|----------|--------|
| Services | ≥95% |
| Validators | ≥95% |
| Permissions | ≥95% |
| Selectors | ≥90% |
| Models | ≥90% |
| Managers | ≥90% |
| QuerySets | ≥90% |
| APIs | ≥90% |
| Frontend Components | ≥80% |
| Overall Project | ≥90% |

Coverage targets should be reviewed periodically.

---

# High Priority Areas

Highest priority:

- Business Services
- Authentication
- Authorization
- Billing (if applicable)
- Project Workflows
- Review Workflows
- File Processing
- Background Tasks

These areas should maintain the highest testing standards.

---

# Low Priority Areas

Lower coverage priority:

- Simple Data Classes
- Configuration Files
- Generated Code
- Framework Boilerplate
- Thin Wrapper Functions

Testing effort should align with business value.

---

# Measuring Coverage

Backend example:

```bash
pytest --cov=apps --cov-report=term-missing
```

HTML report:

```bash
pytest --cov=apps --cov-report=html
```

Frontend example:

```bash
npm run test:coverage
```

Coverage reports should be generated automatically during CI.

---

# Coverage Reports

Reports should identify:

- Untested files
- Missing branches
- Low coverage modules
- Coverage trends
- Recently added code

Coverage reports should be easy to review and understand.

---

# CI Enforcement

Continuous Integration should:

- Generate coverage reports
- Compare against thresholds
- Fail when minimum coverage decreases
- Publish artifacts for review

Coverage enforcement should be applied consistently.

---

# New Code Requirements

New features should include:

- Unit Tests
- Integration Tests (when appropriate)
- API Tests (for backend endpoints)
- Frontend Tests (for UI changes)

New code should not reduce overall coverage.

---

# Excluded Code

Coverage exclusions may include:

- Auto-generated files
- Migration files
- Development scripts
- Third-party integrations
- Experimental prototypes

Exclusions should be documented and justified.

---

# Coverage Trends

Track:

- Overall coverage
- Module coverage
- Branch coverage
- Newly added code
- Historical improvements

Long-term trends are often more valuable than individual percentages.

---

# Common Gaps

Review coverage for:

- Error handling
- Permission failures
- Validation errors
- Transaction rollback
- Background task failures
- Boundary conditions
- Empty datasets

These areas are frequently under-tested.

---

# Best Practices

- Measure regularly.
- Prioritize business logic.
- Test failure scenarios.
- Keep reports visible.
- Review coverage after major changes.
- Improve weak areas incrementally.
- Combine coverage metrics with code review.

---

# Anti-Patterns

Avoid:

- Chasing 100% coverage
- Writing meaningless tests
- Ignoring branch coverage
- Excluding important files
- Measuring coverage without reviewing results
- Using coverage as the only quality metric
- Assuming covered code is correct

---

# Related Documents

- overview.md
- unit-testing.md
- integration-testing.md
- api-testing.md
- test-automation.md
- ci-testing.md
- best-practices.md
- ../08-development/testing.md