# Production Module

## Overview

The Production module is the heart of StudioHub and represents the complete Visual Effects (VFX) production pipeline. It manages projects, assets, sequences, shots, tasks, versions, reviews, publishing, and production workflows while providing a scalable foundation for enterprise VFX studios.

The module is designed around real-world production pipelines used by film, television, animation, advertising, and game studios.

---

# Objectives

The Production module is responsible for:

- Project Management
- Production Planning
- Asset Management
- Sequence Management
- Shot Management
- Task Management
- Artist Assignment
- Production Scheduling
- Version Tracking
- Review Pipeline
- Publishing
- Delivery
- Production Analytics

---

# Module Dependencies

```text
                 Core
                  │
                  ▼
              Identity
                  │
                  ▼
            Organization
                  │
                  ▼
             Production
```

Production depends on:

- Core
- Identity
- Organization

Production never exposes dependencies back to these modules.

---

# Directory Structure

```text
apps/production/

├── admin/
├── api/
│   ├── filters/
│   ├── serializers/
│   ├── permissions/
│   ├── views/
│   └── urls.py
│
├── choices/
├── constants/
├── events/
├── exceptions/
├── managers/
├── middleware/
├── models/
├── permissions/
├── querysets/
├── selectors/
├── serializers/
├── services/
├── signals/
├── tasks/
├── validators/
├── workflows/
├── utils/
└── tests/
```

---

# Production Hierarchy

StudioHub models production using the following hierarchy.

```text
Organization

    │

    ▼

Project

    │

    ▼

Episode (Optional)

    │

    ▼

Sequence

    │

    ▼

Shot

    │

    ▼

Task

    │

    ▼

Version

    │

    ▼

Publish
```

This hierarchy represents the complete lifecycle of a production.

---

# Core Entities

## Project

Represents an individual production.

Examples

- Feature Film
- TV Series
- Commercial
- Game Cinematic

---

## Episode

Optional level used for television projects.

---

## Sequence

Logical grouping of shots.

Example

```
SEQ010
```

---

## Shot

Represents an individual production shot.

Example

```
SH010_020
```

---

## Asset

Reusable production asset.

Examples

- Character
- Vehicle
- Environment
- Prop
- Creature

---

## Task

Represents work assigned to an artist.

Examples

- Modeling
- Rigging
- Animation
- FX
- Lighting
- Compositing

---

## Version

Represents an iteration of work.

Examples

```
v001

v002

v015
```

---

## Publish

Represents approved work available for downstream departments.

---

## Review

Production review session.

---

## Playlist

Collection of versions for review.

---

## Note

Feedback from supervisors and directors.

---

# Workflow

Typical production workflow

```text
Brief

↓

Asset Creation

↓

Layout

↓

Animation

↓

FX

↓

Lighting

↓

Rendering

↓

Compositing

↓

Review

↓

Approval

↓

Publish

↓

Delivery
```

---

# Services

Business logic belongs inside services.

Examples

```text
ProjectService

SequenceService

ShotService

AssetService

TaskService

AssignmentService

VersionService

PublishService

ReviewService

PlaylistService
```

Responsibilities

- validation

- transactions

- workflow execution

- event publishing

- audit updates

---

# Selectors

Selectors provide optimized queries.

Examples

```text
ProjectSelector

ShotSelector

TaskSelector

VersionSelector

ReviewSelector
```

Used for

- dashboards

- search

- reporting

- filtering

- analytics

---

# Validators

Validators enforce production rules.

Examples

- project code uniqueness

- shot code uniqueness

- version numbering

- task assignment

- workflow transitions

- publish validation

---

# Events

Production publishes domain events.

Examples

```text
ProjectCreated

ProjectArchived

ShotCreated

ShotApproved

TaskAssigned

TaskCompleted

VersionSubmitted

VersionApproved

PublishCreated
```

Subscribers may perform

- notifications

- analytics

- cache invalidation

- activity feeds

- background jobs

---

# Permissions

Production permissions are organized as

```text
Module

↓

Category

↓

Action
```

Example

```text
Production

↓

Shot

↓

CREATE

READ

UPDATE

DELETE

APPROVE

EXPORT
```

---

# API

Production exposes REST APIs.

Examples

```text
/api/v1/projects/

/api/v1/sequences/

/api/v1/shots/

/api/v1/tasks/

/api/v1/assets/

/api/v1/versions/

/api/v1/reviews/

/api/v1/publishes/
```

---

# Integration

Production integrates with

## Core

- Base Models
- Events
- Services
- Utilities

## Identity

- Users
- Roles
- Permissions
- Authentication

## Organization

- Organizations
- Departments
- Teams
- Membership

---

# Performance Considerations

Recommended practices

- optimized querysets

- select_related()

- prefetch_related()

- pagination

- caching

- background jobs

- event-driven processing

---

# Future Roadmap

Upcoming capabilities

- Editorial integration

- Render Farm integration

- DCC integrations

- ShotGrid migration utilities

- AI review assistant

- Production analytics

- Scheduling engine

- Resource planning

- Pipeline automation

---

# Best Practices

- Keep production logic inside services.

- Never place workflows inside models.

- Keep APIs thin.

- Use selectors for all read operations.

- Publish events after successful transactions.

- Make workflows configurable.

- Scope all production data to an organization.

---

# Related Documents

- core.md

- identity.md

- organization.md

- ../02-architecture/service-layer.md

- ../02-architecture/event-system.md

- ../02-architecture/database-design.md