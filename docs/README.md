# StudioHub Documentation

Welcome to the official documentation for **StudioHub**, an enterprise-grade Production Management Platform designed for VFX, Animation, Game Development, Virtual Production, Motion Graphics, Advertising, and Digital Content Studios.

This documentation describes the architecture, implementation, deployment, operations, security, APIs, development standards, and long-term roadmap of the platform.

---

# Documentation Structure

```
docs/
│
├── 01-getting-started/
├── 02-architecture/
├── 03-backend/
├── 04-frontend/
├── 05-api/
├── 06-infrastructure/
├── 07-deployment/
├── 08-development/
├── 09-testing/
├── 10-security/
├── 11-operations/
├── 12-reference/
├── 13-roadmap/
└── adr/
```

---

# Documentation Overview

## 01. Getting Started

Introduction to the platform.

Contents include:

- Overview
- Installation
- Quick Start
- Development Environment
- Project Structure

---

## 02. Architecture

High-level system architecture.

Topics include:

- Vision
- Domain Driven Design
- Layered Architecture
- Event Driven Architecture
- Multi-Tenancy
- System Design

---

## 03. Backend

Backend implementation documentation.

Includes:

- Django Architecture
- Models
- QuerySets
- Managers
- Selectors
- Services
- Validators
- Events
- Tasks

---

## 04. Frontend

React application architecture.

Topics:

- React
- TypeScript
- MUI
- Routing
- State Management
- API Client

---

## 05. API

REST API documentation.

Includes:

- Authentication
- Authorization
- Versioning
- Error Handling
- Standards

---

## 06. Infrastructure

Infrastructure documentation.

Includes:

- PostgreSQL
- Redis
- Celery
- Object Storage
- Docker

---

## 07. Deployment

Deployment guides.

Includes:

- Docker
- Production
- Database Migration
- Release Process

---

## 08. Development

Developer standards.

Includes:

- Coding Standards
- Git Workflow
- API Standards
- Project Structure

---

## 09. Testing

Testing strategy.

Includes:

- Unit Testing
- Integration Testing
- API Testing
- Performance Testing

---

## 10. Security

Security architecture.

Topics include:

- JWT
- MFA
- RBAC
- Audit Logging
- File Security

---

## 11. Operations

Production operations.

Topics include:

- Monitoring
- Logging
- Backup
- Disaster Recovery
- Runbooks

---

## 12. Reference

Reference documentation.

Includes:

- Architecture References
- Standards
- ADR Index

---

## 13. Roadmap

Project planning.

Includes:

- Milestones
- Release Roadmap
- Backend Roadmap
- Frontend Roadmap
- Infrastructure Roadmap

---

## Architecture Decision Records

The `adr/` directory documents important architectural decisions made throughout the project's lifecycle.

Current ADRs include:

- Repository Structure
- Layered Architecture
- Service & Selector Pattern
- Domain Driven Design
- Event Driven Architecture
- PostgreSQL
- Celery & Redis
- API Design
- Authentication
- Multi-Tenant Model
- Audit Logging
- Asset Storage
- UUID Strategy

---

# Bulk add (CSV formats)

Shots, Sequences, Assets and Tasks each have a **Bulk add** button (*Bulk add shots*, *Bulk add sequences*, …) on their Production page, for the list's Project filter or else the active project, and on each project's tab; it is shown with the entity's `*.create` permission. All four work in the same steps (shots in `ShotBulkManager`, the others in `StagedBulkManager`):

1. **Grid**: type the rows, paste TSV/CSV from a spreadsheet, upload a CSV file, or **Load Template** (example rows that use the project's own episode, sequence, shot or asset codes and the catalog's types; shots: the sample rows of the shot manager).
2. **Validate**: a code given twice in the batch is a *batch duplicate*; the backend says which codes are already in the project (*active existing*) or archived (*soft-deleted*) (`check-existence`). For sequences, assets and tasks the new rows are also dry-run (`bulk-create` with `dry_run`), so a row the backend would refuse (an unknown parent, a bad status, a missing name) is a *validation error* now, not after Execute; shots check duplicates and frame ranges in the grid.
3. **Archived rows**: recover them all, recover some, or skip them.
4. **Resolve**: the *Batch Validation Breakdown* (All, New, Soft-Deleted, Active Existing, Batch Duplicates, Validation Errors; each pill filters the rows) and per row: create, skip or recover, or remove it. Uploading the same file again shows its rows as *active existing*.
5. **Preview**: what will be created, recovered and skipped; **Execute**.
6. **Result**: `N created · N recovered · N skipped · N failed`, a log per row (CSV / JSON export), and *Retry failed rows*.

Rows are stored one by one: a refused row does not stop the others. There is no bulk update from a file; change existing rows with **Edit fields** on the selected rows (below).

Rules for every file:

* The first row is the header. Column names are matched without case; spaces and dashes count as `_`; the API field name is accepted too (`episode_id` for `episode`). An unknown column, a repeated one or a missing required one is refused before anything is sent.
* `code` is the row's key: unique in the project, upper-cased, no spaces or slashes (a shot's code changes later with *Rename code* on the shot).
* Parents are written by **code** and resolved inside the project: `episode` (EP101), `sequence` (SQ010), `asset_type` and `task_type` (catalog codes), `entity` (the shot, asset or sequence code of a task). An unknown parent, or one of another project, is "Unknown ...".
* An empty cell means "not given": the field takes its default.
* At most 500 rows and 2 MB per file; split bigger ones.
* Quoted fields follow RFC 4180 (`"Smith, J"`, `"He said ""go"""`, line breaks inside quotes).

| Entity | Columns (bold = required) | Only on an episodic project |
|---|---|---|
| Sequences | **code**, name, description, episode, frame_in, frame_out, status | `episode` (required there by the backend; refused on a standard project) |
| Shots | the shot manager's grid: **code**, **sequence_code**, name, status, priority, department, frame_in, frame_out, handle_frames, notes | `episode_id` |
| Assets | **code**, **name**, description, asset_type, category, status | |
| Tasks | **code**, **title**, description, entity_type, entity, task_type, status, priority, due_date (YYYY-MM-DD), estimated_hours | |

Selected rows can also be changed together: tick them, **Edit fields**, tick the fields to set and give their values; every row changes or none does. What bulk update may change per entity, and the API (`dry_run`, `atomic`, `errors`, the 500-item limit), is in `docs/production/CONTRACTS.md` (C-57 to C-62); the decisions are D-39 to D-42 in `docs/production/DECISIONS.md`.

# Architecture Summary

StudioHub is based on:

- Domain Driven Design (DDD)
- Layered Architecture
- Modular Monolith
- Service Layer Pattern
- Selector Pattern
- Event Driven Architecture
- Multi-Tenant Design
- Enterprise Security
- REST-first APIs

---

# Technology Stack

## Backend

- Python 3.13
- Django 6
- Django REST Framework
- PostgreSQL 18
- Redis
- Celery

## Frontend

- React 19
- TypeScript
- Vite
- Material UI

## Infrastructure

- Docker
- Nginx
- GitHub Actions
- Object Storage

---

# Documentation Standards

Documentation follows these principles:

- Documentation-first development
- Architecture before implementation
- Consistent terminology
- Clear separation of concerns
- Enterprise maintainability
- Long-term sustainability

---

# Target Audience

This documentation is intended for:

- Software Architects
- Backend Developers
- Frontend Developers
- DevOps Engineers
- QA Engineers
- Security Engineers
- Technical Leads
- Project Managers

---

# Contributing

When introducing new functionality:

- Update relevant documentation.
- Update architecture documentation if required.
- Add or update ADRs when architectural decisions change.
- Keep API documentation synchronized with implementation.
- Review documentation during code reviews.

Documentation is considered part of the production codebase and should evolve alongside the application.