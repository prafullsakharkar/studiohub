# StudioHub

## Enterprise VFX Production Management Platform

StudioHub is an enterprise-grade **Visual Effects (VFX) Production Management Platform** built to manage the complete lifecycle of VFX and animation production. It provides a scalable foundation for studios to organize teams, manage production pipelines, track assets and shots, automate workflows, and integrate with existing studio tools.

Built using **Python**, **Django**, **Django REST Framework**, **PostgreSQL**, **React**, and **Docker**, StudioHub follows **Domain-Driven Design (DDD)**, **Clean Architecture**, and a **Modular Monolith** architecture.

---

# Vision

StudioHub aims to become a self-hosted enterprise production management platform comparable to ShotGrid, ftrack, and Kitsu while remaining fully customizable.

## Goals

- Studio & Organization Management
- Identity & Security
- Production Tracking
- Asset & Shot Management
- Review & Approval Pipelines
- Workflow Automation
- Analytics & Reporting
- AI-assisted Production

---

# Technology Stack

## Backend

- Python
- Django
- Django REST Framework
- PostgreSQL
- Redis
- Celery

## Frontend

- React
- TypeScript
- Vite
- Material UI

## Infrastructure

- Docker
- Docker Compose
- Nginx

---

# Repository Structure

```text
studiohub/
├── backend/
│   ├── apps/
│   │   ├── core/
│   │   ├── identity/
│   │   ├── organization/
│   │   └── production/
│   ├── config/
│   ├── infrastructure/
│   ├── tests/
│   └── manage.py
├── frontend/
├── docs/
├── scripts/
└── docker-compose.yml
```

---

# Domain Architecture

```text
apps/<domain>/
├── admin/
├── api/
├── authentication/
├── choices/
├── constants/
├── events/
├── exceptions/
├── filters/
├── managers/
├── middleware/
├── migrations/
├── models/
├── permissions/
├── querysets/
├── selectors/
├── serializers/
├── services/
├── signals/
├── tasks/
├── validators/
└── views/
```

Every business domain follows the same architecture, making the codebase consistent and maintainable.

---

# Core Framework ✅

The Core module provides reusable enterprise building blocks.

## Base Models

- UUIDModel
- TimeStampedModel
- AuditModel
- SoftDeleteModel
- MetadataModel

## Enterprise Components

- Base Models
- QuerySets
- Managers
- Selectors
- Services
- Validators
- Event Framework
- API Foundation
- Utilities
- Constants
- Choices

## Layered Architecture

```text
Model
  ↓
QuerySet
  ↓
Manager
  ↓
Selector
  ↓
Service
  ↓
API
```

---

# Service Layer

```text
Client
  ↓
APIView
  ↓
Serializer
  ↓
Business Service
  ↓
Validator
  ↓
Selector
  ↓
Manager
  ↓
QuerySet
  ↓
Model
  ↓
Database
```

| Layer | Responsibility |
|--------|----------------|
| Model | Database representation |
| QuerySet | Query logic |
| Manager | Query entry point |
| Selector | Read operations |
| Validator | Business validation |
| Service | Business logic |
| Event | Domain events |
| API | HTTP interface |

---

# Event Driven Architecture

```text
Entity Created
      ↓
Domain Event
      ↓
Audit Log
Notification
Activity Feed
Celery Tasks
Analytics
Webhooks
```

---

# Identity Module ✅

## Features

### User Management

- Custom User Model
- UUID Users
- Audit Tracking
- Soft Delete

### Authentication

- JWT Authentication
- Login / Logout
- Access & Refresh Tokens
- Token Rotation

### Authorization

- Roles
- Permissions
- Permission Groups
- Module & Action Based Permissions

### Security

- Multi-Factor Authentication (MFA)
- Trusted Devices
- Backup Codes
- Password Policies
- Login Auditing

---

# Organization Module ✅

## Features

- Organizations
- Departments
- Offices
- Teams
- Positions
- Memberships
- Invitations
- Branding
- Calendars
- Holidays
- Work Hours
- Organization Settings

```text
Organization
├── Departments
├── Offices
├── Teams
├── Positions
└── Members
```

---

# Production Module 🚧

## Planned Modules

```text
Project
   ↓
Sequence
   ↓
Shot
   ↓
Task
   ↓
Version
   ↓
Review
   ↓
Publish
```

### Planned Features

- Projects
- Assets
- Sequences
- Shots
- Tasks
- Versions
- Reviews
- Publishing
- Deliveries
- Playlists
- Notes
- Attachments
- Time Logs
- Workflow Engine

---

# API Architecture

```text
HTTP Request
      ↓
APIView
      ↓
Serializer
      ↓
Business Service
      ↓
Selector
      ↓
Model
      ↓
Database
```

Features:

- Pagination
- Filtering
- Ordering
- Search
- Validation
- Authentication
- Authorization

---

# Security

- JWT Authentication
- Role Based Access Control
- MFA
- Trusted Devices
- Secure Password Policies
- Login Auditing
- Soft Delete
- Token Rotation

---

# Database Principles

- UUID Primary Keys
- Audit History
- Metadata Support
- Soft Delete
- Indexed Relationships
- Transactional Services
- Domain Isolation

---

# Infrastructure

```text
Docker
   ↓
Nginx
   ↓
Django
   ↓
Redis
   ↓
Celery
   ↓
PostgreSQL
```

---

# Development Principles

- Domain Driven Design
- Clean Architecture
- SOLID Principles
- Modular Monolith
- Service Layer Pattern
- Selector Pattern
- Event Driven Design
- API First Development

---

# Development Roadmap

| Phase | Status |
|------|--------|
| Bootstrap | ✅ |
| Docker Infrastructure | ✅ |
| Core Framework | ✅ |
| Identity | ✅ |
| Organization | ✅ |
| Production | 🚧 |
| Reviews | ⏳ |
| Automation | ⏳ |
| AI | ⏳ |

---

# Current Status

| Module | Status |
|---------|--------|
| Core | ✅ Completed |
| Identity | ✅ Completed |
| Organization | ✅ Completed |
| Production | 🚧 In Progress |

---

# License

**Private Enterprise Software**

StudioHub is proprietary software intended for enterprise VFX production management.
