# Architecture Overview

## Overview

StudioHub is an enterprise-grade Visual Effects (VFX) Production Management Platform built using a modular monolith architecture based on Domain-Driven Design (DDD). The platform separates business domains while sharing a common enterprise foundation.

## Architectural Goals

- Scalability
- Maintainability
- Clear domain boundaries
- Testability
- Reusable business components
- API-first development

## High-Level Architecture

```text
Client
   |
Frontend (React)
   |
REST API
   |
Business Services
   |
Selectors / Managers
   |
Models
   |
PostgreSQL
```

## Core Domains

- Core
- Identity
- Organization
- Production

## Request Flow

```text
Request
↓
APIView
↓
Serializer
↓
Service
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

## Cross-Cutting Components

- Events
- Authentication
- Authorization
- Audit Logging
- Soft Delete
- Metadata
- Background Tasks

## Design Principles

- Domain-Driven Design
- Clean Architecture
- SOLID
- Modular Monolith
- Event-Driven Design
- Service Layer Pattern
- Selector Pattern
- API-First Development

## Current Status

| Module | Status |
|--------|--------|
| Core | ✅ Complete |
| Identity | ✅ Complete |
| Organization | ✅ Complete |
| Production | 🚧 In Progress |
