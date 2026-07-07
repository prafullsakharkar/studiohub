# Atom 4

## Enterprise VFX Production Management System

Atom 4 is an enterprise-grade **VFX Production Management Platform** designed to manage the complete lifecycle of visual effects production — from studio organization and user access management to projects, shots, tasks, reviews, publishing, and production workflows.

The system is built using a **modular Django architecture** following Domain Driven Design (DDD) principles, providing a scalable foundation suitable for large VFX studios.

---

# Architecture Overview

Atom 4 follows a **modular monolith architecture** with clear domain boundaries.

```
backend/
│
├── apps/
│   │
│   ├── core/
│   │
│   ├── identity/
│   │
│   ├── organization/
│   │
│   └── production/
│
├── config/
│
├── infrastructure/
│
└── manage.py
```

Each application represents an independent business domain while sharing common enterprise infrastructure through the Core framework.

---

# Technology Stack

## Backend

* Python
* Django
* Django REST Framework
* PostgreSQL
* Redis
* Celery
* Docker

## Architecture Patterns

* Domain Driven Design
* Service Layer Pattern
* Selector Pattern
* Event Driven Architecture
* Modular Monolith
* API First Development

---

# Core Architecture

The `core` application provides the enterprise foundation used by all modules.

```
apps/core/

├── api/
├── choices/
├── constants/
├── events/
├── managers/
├── middleware/
├── models/
├── selectors/
├── services/
├── validators/
└── utils/
```

---

# Core Features

## Base Models

All major entities inherit reusable enterprise models.

Implemented:

```
UUIDModel
TimeStampedModel
AuditModel
SoftDeleteModel
MetadataModel
```

Provides:

* UUID primary keys
* Created/updated timestamps
* User activity tracking
* Soft deletion
* Metadata storage

Example:

```python
class Project(
    UUIDModel,
    TimeStampedModel,
    AuditModel,
    MetadataModel,
    SoftDeleteModel,
):
    pass
```

---

# Query Architecture

Atom 4 separates database logic from business logic.

Architecture:

```
Model
 |
QuerySet
 |
Manager
 |
Selector
 |
Service
 |
API
```

Benefits:

* Cleaner models
* Reusable queries
* Better testing
* Maintainable business logic

---

# Event Architecture

Atom 4 includes an internal event system.

Example:

```
User Created

      |
      v

UserCreatedEvent

      |
      |
 ----------------
 |              |
Audit        Notification
```

Used for:

* Audit logging
* Notifications
* Workflow automation
* Background processing

---

# Identity Module

The Identity module manages authentication, authorization, and user access.

Structure:

```
apps/identity/

├── authentication/
├── models/
├── permissions/
├── selectors/
├── serializers/
├── services/
├── signals/
├── tasks/
└── validators/
```

---

# Identity Features

## Custom User System

Implemented using Django custom authentication.

Features:

* UUID based users
* Enterprise audit support
* Soft deletion
* Permission integration

Architecture:

```
AbstractBaseUser
        +
PermissionsMixin
        +
Core Enterprise Models
```

---

# Authentication System

Supports:

* Login
* Logout
* JWT authentication
* Access tokens
* Refresh tokens
* Token validation
* Token rotation

Authentication flow:

```
Client

 |
 v

Authentication Service

 |
 v

JWT Service

 |
 +-------------+
 |             |
Access       Refresh
Token        Token
```

---

# Permission System

Atom 4 uses a flexible permission model.

Permission structure:

```
Module
 |
Category
 |
Action
```

Example:

```
Production

 ├── Project
 ├── Shot
 └── Asset


Actions:

CREATE
READ
UPDATE
DELETE
APPROVE
EXPORT
```

---

# Organization Module

The Organization module manages studio structure.

Example:

```
Studio

 |
 +-- Departments
 |
 +-- Teams
 |
 +-- Locations
 |
 +-- Members
```

Designed for VFX studios with multiple departments:

```
Studio

 ├── Animation
 |
 ├── Lighting
 |
 ├── FX
 |
 ├── Compositing
 |
 └── Production
```

---

# Production Module

The Production module manages the complete VFX pipeline.

Planned structure:

```
apps/production/

├── projects/
├── assets/
├── sequences/
├── shots/
├── tasks/
├── versions/
├── publishes/
├── reviews/
└── workflows/
```

---

# Production Pipeline

Core hierarchy:

```
Studio

 |
 +-- Project

       |
       +-- Sequence

              |
              +-- Shot

                    |
                    +-- Task

                          |
                          +-- Version
```

Example:

```
Feature Film

Sequence 010

Shot 010_020

Animation

Version v003
```

---

# API Architecture

All domains expose APIs following the same pattern.

```
apps/<domain>/api/

├── serializers/
├── views/
├── filters/
├── permissions/
└── urls.py
```

Request flow:

```
Request

 |
 v

API View

 |
 v

Serializer

 |
 v

Service

 |
 v

Selector

 |
 v

Model

 |
 v

Database
```

---

# Infrastructure

Docker based development environment.

Structure:

```
infrastructure/

├── docker/
├── nginx/
└── scripts/
```

Includes:

* Django container
* PostgreSQL container
* Redis support
* Static/media configuration
* Production deployment foundation

---

# Development Roadmap

## Completed

### Phase 1

Bootstrap & Configuration

Status:

✅ Completed

### Phase 2

Docker Infrastructure

Status:

✅ Completed

### Phase 3

Core Framework

Status:

✅ Completed

Includes:

* Base models
* Managers
* Querysets
* Services
* Selectors
* Events

### Phase 4

Identity System

Status:

🚧 In Progress

Includes:

* User management
* Authentication
* Permissions
* Security layer

### Phase 5

Organization

Status:

✅ Completed

### Phase 6

Production Management

Status:

⏳ Upcoming

Includes:

* Projects
* Assets
* Sequences
* Shots
* Tasks
* Versions
* Reviews
* Publishing

---

# Future Capabilities

Planned enterprise features:

## Production

* Shot tracking
* Asset management
* Task workflows
* Version management
* Review sessions
* Approval pipeline

## Collaboration

* Comments
* Notes
* Notifications
* Activity feeds

## Automation

* Event driven workflows
* Background jobs
* Pipeline integrations

## AI Integration

Future support for:

* AI assisted reviews
* Smart search
* Production analytics
* Automated tagging

---

# Development Principles

Atom 4 follows:

✅ Clean Architecture
✅ Domain Separation
✅ Reusable Components
✅ Explicit Business Logic
✅ Testable Services
✅ Scalable Database Design
✅ Production Pipeline Thinking

---

# License

Private Enterprise Software.

---

# Project Status

Current Status:

```
Core Framework       ✅
Identity             🚧
Organization         ✅
Production           ⏳
```

Atom 4 is being developed as a long-term enterprise VFX production platform.
