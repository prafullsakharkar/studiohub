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

# Bulk create and update (CSV formats)

**Shots** use the staged *Bulk add shots* manager (below). The Sequences, Assets and Tasks lists (the Production pages and each project's tabs) have a **Bulk** menu: *Bulk create* and *Bulk update*, each shown with the entity's `*.create` / `*.update` permission. On a project's tab the rows go to that project; on the Production pages the dialog asks for the project, starting from the list's Project filter or the active project, and says so when you may not write in the one chosen. Rows come from a CSV file or are pasted into the grid (tab-separated text from a spreadsheet works). **Download template** gives the header row for the project. **Load template** fills an empty grid: on a create with three example rows that use the project's own episode, sequence, shot or asset codes and the catalog's types (they pass the check as they are; change the codes and names); on an update with the project's current rows (at most 500), parents by code, where only the cells you change are sent and untouched rows are left out.

The flow is: rows → **Check rows** (a backend dry run: the same serializers, validators, permission and scope checks as a single create or edit, then rolled back) → the outcome of each row (Create, Update, Skip, Error and why) → **Create N / Update N** → the result. By default a batch is all or nothing; tick *Skip invalid rows* to store the valid rows and leave the others. Both the check and the result show the counts as the former bulk screens did: cards (to create or update / created or updated, skipped, errors), a *Batch validation breakdown* whose pills (new, already in the project, archived, twice in the file, not found, validation errors) filter the rows, a badge per row, and on the result a banner with `N created · N updated · N skipped · N failed`; **Download log** gives every row and its outcome as CSV. **Download error report** gives the refused rows as CSV (`row,code,column,message`; row 1 is the first row under the header).

Rules for every file:

* The first row is the header. Column names are matched without case; spaces and dashes count as `_`; the API field name is accepted too (`episode_id` for `episode`). An unknown column, a repeated one or a missing required one is refused before anything is sent.
* `code` is the row's key: unique in the project, upper-cased, no spaces or slashes. Bulk update finds each row by its code in the project; a code cannot be changed in bulk (a shot's code changes with *Rename code* on the shot).
* Parents are written by **code** and resolved inside the project: `episode` (EP101), `sequence` (SQ010), `asset_type` and `task_type` (catalog codes), `entity` (the shot, asset or sequence code of a task). An unknown parent, or one of another project, is "Unknown ...".
* An empty cell means "not given": a create uses the default, an update leaves the field as it is.
* At most 500 rows and 2 MB per file; split bigger ones.
* Quoted fields follow RFC 4180 (`"Smith, J"`, `"He said ""go"""`, line breaks inside quotes).

| Entity | Columns (bold = required) | Only on create | Only on an episodic project |
|---|---|---|---|
| Sequences | **code**, name, description, episode, frame_in, frame_out, status | | `episode` (required there by the backend; refused on a standard project) |
| Shots | **code**, name, description, sequence, episode, frame_in, frame_out, handle_frames, status | | `episode` (refused on a standard project) |
| Assets | **code**, **name**, description, asset_type, category, status | | |
| Tasks | **code**, **title**, description, entity_type, entity, task_type, status, priority, due_date (YYYY-MM-DD), estimated_hours | `entity_type`, `entity` | |

**Bulk add shots** (Shots page, for the Project filter or else the active project, and each project's Shots tab) works in separate steps: fill the grid (paste TSV/CSV or *Load Template*) → *Validate* (duplicate codes and frame ranges in the grid, then the backend's `check-existence`) → archived shots: recover or skip → *Resolve*: the breakdown (new, archived, existing, duplicates, errors) and per row create, skip or recover → *Preview* → *Execute* → the result (counts, a log per row, CSV/JSON export, retry the failed rows). On an episodic project it takes the episode and can create a missing episode or sequence on the spot. It creates only; there is no bulk update of shots from a file.

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