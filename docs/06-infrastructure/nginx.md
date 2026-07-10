# Nginx

## Overview

StudioHub uses **Nginx** as the primary reverse proxy and web server. Nginx acts as the entry point for all incoming traffic, routing requests to the appropriate backend services while serving static assets efficiently.

Nginx provides SSL termination, request routing, load balancing, compression, caching, and security features required for enterprise deployments.

---

# Objectives

Nginx provides:

- Reverse Proxy
- SSL Termination
- Static File Serving
- Media File Serving
- HTTP Compression
- Load Balancing
- Request Routing
- Security Headers

---

# Architecture

```text
                    Internet
                        │
                        ▼
                  HTTPS (443)
                        │
                        ▼
                     Nginx
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     Frontend      Django API    Static Files
                                    │
                                    ▼
                               Media Files
```

---

# Responsibilities

Nginx is responsible for:

- Accepting incoming requests
- HTTPS termination
- Reverse proxying API requests
- Serving static files
- Serving media files
- HTTP compression
- Request buffering
- Security headers

Business logic should never exist in Nginx.

---

# Request Flow

```text
Browser

↓

HTTPS Request

↓

Nginx

↓

Django

↓

Response

↓

Browser
```

---

# URL Routing

Example routing

```text
/

↓

React Application

/api/

↓

Django REST API

/admin/

↓

Django Admin

/static/

↓

Collected Static Files

/media/

↓

Uploaded Files
```

---

# Reverse Proxy

Example

```text
Client

↓

Nginx

↓

Gunicorn / Uvicorn

↓

Django
```

Nginx should never execute Django directly.

---

# Static Files

Nginx serves:

```text
CSS

JavaScript

Images

Fonts

Icons
```

Static assets should never be served by Django in production.

---

# Media Files

Uploaded content

```text
Images

Videos

Documents

Project Files

Assets
```

Media should be stored outside the application container.

---

# HTTPS

Production deployments should enforce HTTPS.

Benefits

- Encrypted communication
- Secure authentication
- Browser trust
- HTTP/2 support

HTTP traffic should redirect automatically to HTTPS.

---

# SSL Certificates

Supported providers

- Let's Encrypt
- Cloudflare Origin Certificates
- Commercial SSL Providers

Certificates should be renewed automatically.

---

# HTTP Compression

Supported compression

- Gzip
- Brotli (recommended)

Compression reduces bandwidth and improves page load times.

---

# Caching

Nginx may cache:

- Static Assets
- Images
- Fonts
- JavaScript
- CSS

Dynamic API responses should generally not be cached unless explicitly configured.

---

# Security Headers

Recommended headers

```text
Strict-Transport-Security

Content-Security-Policy

X-Frame-Options

X-Content-Type-Options

Referrer-Policy

Permissions-Policy
```

These improve browser-side security.

---

# Request Limits

Configure limits for:

- Maximum Upload Size
- Request Timeout
- Connection Timeout
- Client Body Buffer

Example use cases

- Asset uploads
- Review videos
- Production publishes

---

# Load Balancing

Future deployments may support multiple backend instances.

Example

```text
Internet

↓

Nginx

↓

Backend 1

Backend 2

Backend 3
```

Supported algorithms

- Round Robin
- Least Connections
- IP Hash

---

# Logging

Nginx logs include:

- Access Logs
- Error Logs

Typical information

- Client IP
- Request Method
- Response Code
- Response Time
- Request Path

Logs should be centralized in production.

---

# Performance

Performance optimizations

- HTTP/2
- Keep-Alive
- Compression
- Browser Caching
- Static File Optimization
- Connection Reuse

---

# Monitoring

Monitor:

- Request Rate
- Response Time
- Active Connections
- Error Rate
- SSL Expiration
- Upstream Health

---

# Security

Nginx should implement:

- HTTPS Only
- TLS 1.2+
- Rate Limiting
- Request Size Limits
- Secure Headers
- IP Filtering (if required)
- Hidden Server Version

---

# Best Practices

- Use HTTPS everywhere.
- Serve static files through Nginx.
- Enable compression.
- Configure browser caching.
- Protect with security headers.
- Keep certificates up to date.
- Monitor access and error logs.

---

# Anti-Patterns

Avoid:

- Serving static files from Django
- Running without HTTPS
- Exposing backend servers directly
- Hardcoded certificates
- Weak TLS configurations
- Disabling security headers

---

# Testing

Verify:

- HTTPS configuration
- Reverse proxy routing
- Static file delivery
- Media file delivery
- Compression
- Cache headers
- SSL certificate validity
- Security headers

---

# Related Documents

- overview.md
- docker.md
- docker-compose.md
- postgres.md
- redis.md
- celery.md
- networking.md
- storage.md
- deployment.md
- security.md