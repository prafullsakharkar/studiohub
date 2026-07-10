# Networking

## Overview

StudioHub uses a secure, layered networking architecture to isolate infrastructure services while providing controlled communication between frontend, backend, databases, caches, and background workers.

The networking design follows the principle of **least privilege**, ensuring that only the required services can communicate with one another.

The networking architecture is designed for both Docker-based development and cloud-native production deployments.

---

# Objectives

The networking architecture provides:

- Secure Service Communication
- Internal Service Isolation
- Controlled External Access
- Scalable Architecture
- High Availability
- Network Security
- Load Balancing
- Cloud Compatibility

---

# Network Architecture

```text
                    Internet
                        │
                        ▼
                  HTTPS (443)
                        │
                        ▼
                     Nginx
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
Frontend (React)                  Backend API
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
       PostgreSQL                  Redis Cache              Celery Workers
```

---

# Network Layers

StudioHub uses multiple logical layers.

```text
Public Network

↓

Reverse Proxy

↓

Application Network

↓

Internal Services

↓

Persistent Storage
```

Only the reverse proxy is publicly accessible.

---

# Docker Networks

Recommended Docker networks

```text
frontend-network

backend-network

database-network

worker-network
```

Each network has a clearly defined responsibility.

---

# Service Communication

Allowed communication

```text
Frontend

↓

Backend

↓

PostgreSQL

Backend

↓

Redis

Backend

↓

Celery

Celery

↓

Redis
```

Services should communicate only when necessary.

---

# Public Access

Publicly accessible services

```text
Nginx

HTTPS

HTTP (Redirect Only)
```

Everything else should remain private.

---

# Private Services

Internal-only services

```text
Backend

PostgreSQL

Redis

Celery

Celery Beat
```

These services should never expose public ports in production.

---

# Reverse Proxy

All external traffic follows:

```text
Browser

↓

Nginx

↓

Backend API

↓

Database
```

Clients should never connect directly to the application server.

---

# API Communication

Frontend communicates exclusively through the API.

```text
Frontend

↓

HTTPS

↓

Nginx

↓

Django API
```

No direct database communication should occur.

---

# Database Access

Only the backend application should access PostgreSQL.

```text
Backend

↓

PostgreSQL
```

External database access should be restricted to administrative tools over secure channels.

---

# Redis Access

Redis communication

```text
Backend

↓

Redis

Celery

↓

Redis
```

Redis should not be exposed outside the internal network.

---

# Celery Communication

Task execution flow

```text
Application

↓

Redis Queue

↓

Celery Worker

↓

Database
```

Workers should never receive direct client traffic.

---

# Internal DNS

Docker provides internal DNS resolution.

Example

```text
backend

postgres

redis

celery

nginx
```

Containers should communicate using service names rather than IP addresses.

---

# Port Management

Typical ports

| Service | Port |
|----------|------|
| Nginx HTTP | 80 |
| Nginx HTTPS | 443 |
| Django | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |

Only ports 80 and 443 should be publicly exposed.

---

# TLS Encryption

Production deployments should enforce:

- HTTPS
- TLS 1.2+
- Strong Cipher Suites
- HSTS

Internal traffic may also be encrypted depending on deployment requirements.

---

# Firewall Rules

Recommended firewall strategy

Allow

- HTTPS
- HTTP (Redirect)

Block

- PostgreSQL
- Redis
- Celery
- Internal APIs

Administrative access should use VPN or secure bastion hosts.

---

# Load Balancing

Future deployments may use:

```text
Internet

↓

Load Balancer

↓

Nginx Cluster

↓

Backend Cluster

↓

Database
```

Backend services should remain stateless to enable horizontal scaling.

---

# Network Monitoring

Monitor

- Active Connections
- Network Latency
- Packet Loss
- Error Rates
- Bandwidth Usage
- Connection Failures

Monitoring helps detect infrastructure issues before they affect users.

---

# High Availability

Future architecture

```text
Multiple Nginx

↓

Multiple Backend Nodes

↓

Redis Sentinel

↓

Primary PostgreSQL

↓

Read Replicas
```

Single points of failure should be minimized.

---

# Security

Networking security includes:

- Internal Networks
- TLS Encryption
- Firewall Rules
- Reverse Proxy
- Private Databases
- Private Redis
- Secure DNS
- Rate Limiting

---

# Best Practices

- Expose only Nginx publicly.
- Keep databases private.
- Use internal Docker networks.
- Encrypt external communication.
- Restrict administrative access.
- Monitor network health.
- Use service discovery instead of IP addresses.

---

# Anti-Patterns

Avoid:

- Public PostgreSQL
- Public Redis
- Direct frontend-to-database communication
- Hardcoded IP addresses
- Flat networks with unrestricted access
- Unencrypted production traffic

---

# Testing

Networking tests should verify:

- Service Discovery
- Internal Connectivity
- HTTPS
- Firewall Rules
- Reverse Proxy
- DNS Resolution
- Container Communication
- Port Exposure

---

# Related Documents

- overview.md
- docker.md
- docker-compose.md
- nginx.md
- postgres.md
- redis.md
- celery.md
- storage.md
- monitoring.md
- backup.md
- ../07-deployment/overview.md