# HTTP Security Headers Guide

## Overview

HTTP security headers instruct browsers how to securely handle responses from StudioHub. Properly configured headers help mitigate common web attacks such as Cross-Site Scripting (XSS), Clickjacking, MIME sniffing, and downgrade attacks.

Security headers complement application-level security controls but do not replace authentication, authorization, or secure coding practices.

Every production deployment should include a consistent and reviewed set of security headers.

---

# Objectives

Security headers aim to:

- Protect browser clients
- Reduce common web attacks
- Enforce HTTPS
- Prevent clickjacking
- Prevent MIME sniffing
- Improve browser security
- Support modern security standards
- Strengthen defense in depth

---

# Header Strategy

StudioHub should apply security headers at the reverse proxy or web server whenever possible.

```text
Browser

↓

HTTPS

↓

NGINX / Load Balancer

↓

Security Headers

↓

Application
```

Infrastructure-level enforcement provides consistency across all endpoints.

---

# Strict-Transport-Security (HSTS)

Purpose:

Force browsers to communicate using HTTPS.

Example:

```text
Strict-Transport-Security:
max-age=31536000;
includeSubDomains;
preload
```

Recommendations:

- Enable only after HTTPS is fully deployed.
- Use long expiration periods in production.
- Include subdomains when appropriate.

---

# Content-Security-Policy (CSP)

Purpose:

Reduce Cross-Site Scripting (XSS) and content injection attacks.

Example:

```text
Content-Security-Policy:
default-src 'self';
img-src 'self' data:;
script-src 'self';
style-src 'self' 'unsafe-inline';
object-src 'none';
frame-ancestors 'none';
```

Policies should be tailored to application requirements.

---

# X-Content-Type-Options

Purpose:

Prevent browsers from MIME type sniffing.

Recommended value:

```text
X-Content-Type-Options: nosniff
```

This header should be enabled for all production responses.

---

# X-Frame-Options

Purpose:

Prevent clickjacking attacks.

Recommended value:

```text
X-Frame-Options: DENY
```

Use `SAMEORIGIN` only when framing by the same origin is required.

---

# Referrer-Policy

Purpose:

Control how much referrer information is shared.

Recommended value:

```text
Referrer-Policy:
strict-origin-when-cross-origin
```

Choose a policy appropriate for privacy and analytics requirements.

---

# Permissions-Policy

Purpose:

Restrict browser features that the application does not require.

Example:

```text
Permissions-Policy:
camera=(),
microphone=(),
geolocation=()
```

Disable unnecessary browser capabilities by default.

---

# Cross-Origin Resource Policies

Consider configuring:

- Cross-Origin-Opener-Policy (COOP)
- Cross-Origin-Embedder-Policy (COEP)
- Cross-Origin-Resource-Policy (CORP)

These headers provide additional isolation for modern browsers.

---

# Cache-Control

Sensitive responses should prevent unintended caching.

Example:

```text
Cache-Control:
no-store
```

Authentication responses and user-specific data should not be cached by shared intermediaries.

---

# Server Header

Avoid exposing infrastructure details.

Instead of:

```text
Server: nginx/1.29.0
```

Prefer removing or minimizing server identification where possible.

---

# CORS Headers

CORS configuration should:

- Allow only trusted origins
- Restrict methods
- Restrict headers
- Avoid wildcard origins in production
- Support credentials only when required

CORS should not be treated as an authorization mechanism.

---

# Django Configuration

Typical settings include:

- `SECURE_SSL_REDIRECT`
- `SECURE_HSTS_SECONDS`
- `SECURE_HSTS_INCLUDE_SUBDOMAINS`
- `SECURE_HSTS_PRELOAD`
- `SECURE_CONTENT_TYPE_NOSNIFF`
- `X_FRAME_OPTIONS`
- `CSRF_COOKIE_SECURE`
- `SESSION_COOKIE_SECURE`

Production values should be reviewed regularly.

---

# Reverse Proxy Configuration

NGINX or the chosen reverse proxy should:

- Enforce HTTPS
- Apply security headers
- Remove unnecessary headers
- Redirect HTTP traffic
- Support modern TLS configuration

Centralized configuration simplifies maintenance.

---

# Validation

Verify headers using:

- Browser Developer Tools
- Security Scanners
- Automated CI Checks
- External Header Analysis Tools

Configuration should be validated after every deployment.

---

# Monitoring

Monitor for:

- Missing headers
- Incorrect policies
- TLS configuration issues
- Browser compatibility problems

Security header regressions should be treated as deployment issues.

---

# Best Practices

- Enforce HTTPS.
- Use HSTS.
- Implement a restrictive CSP.
- Disable unnecessary browser features.
- Prevent MIME sniffing.
- Protect against clickjacking.
- Review configurations regularly.

---

# Anti-Patterns

Avoid:

- Missing HSTS
- Wildcard CSP rules
- Wildcard CORS origins
- Exposing server versions
- Allowing insecure HTTP in production
- Overly permissive browser permissions
- Ignoring browser security warnings

---

# Related Documents

- overview.md
- api-security.md
- secure-coding.md
- encryption.md
- ../06-infrastructure/networking.md
- ../07-deployment/nginx.md
- ../09-testing/security-testing.md
- ../11-operations/monitoring.md
```