# API Authentication

## Overview

StudioHub secures all protected API endpoints using **JSON Web Tokens (JWT)**. The authentication system is built on top of Django REST Framework and SimpleJWT, providing stateless authentication suitable for web, mobile, desktop, and third-party integrations.

Authentication is implemented within the **Identity** module and integrates with Roles, Permissions, Multi-Factor Authentication (MFA), and Organization Membership.

---

# Objectives

The Authentication API provides:

- User Login
- User Logout
- JWT Authentication
- Token Refresh
- Token Verification
- Password Management
- Multi-Factor Authentication
- Trusted Devices
- Session Management

---

# Authentication Flow

```text
                User
                  │
                  ▼
        POST /auth/login/
                  │
                  ▼
      Validate Credentials
                  │
                  ▼
        Password Verification
                  │
                  ▼
       MFA Verification (Optional)
                  │
                  ▼
      Generate JWT Tokens
           │           │
           ▼           ▼
     Access Token  Refresh Token
                  │
                  ▼
        Authenticated Requests
```

---

# JWT Architecture

StudioHub uses two JWT tokens.

## Access Token

Purpose

- Authenticate API requests

Characteristics

- Short-lived
- Stateless
- Signed
- Contains user claims

---

## Refresh Token

Purpose

- Generate new access tokens

Characteristics

- Long-lived
- Secure storage
- Rotation enabled
- Revocable

---

# Token Lifecycle

```text
Login

↓

Access Token

↓

Protected API

↓

Access Token Expired

↓

Refresh Token

↓

New Access Token

↓

Continue Requests
```

---

# HTTP Headers

Every authenticated request includes:

```http
Authorization: Bearer <access_token>
```

Example

```http
GET /api/v1/projects/

Authorization: Bearer eyJhbGciOi...
```

---

# Authentication Endpoints

## Login

```http
POST /api/v1/auth/login/
```

Request

```json
{
    "email": "artist@studiohub.com",
    "password": "********"
}
```

Response

```json
{
    "access": "...",
    "refresh": "...",
    "user": {}
}
```

---

## Refresh Token

```http
POST /api/v1/auth/refresh/
```

Request

```json
{
    "refresh": "..."
}
```

Response

```json
{
    "access": "..."
}
```

---

## Verify Token

```http
POST /api/v1/auth/verify/
```

---

## Logout

```http
POST /api/v1/auth/logout/
```

Logout invalidates the current refresh token and optionally revokes active sessions.

---

# Multi-Factor Authentication

Supported methods

- TOTP
- Backup Codes
- Trusted Devices

Workflow

```text
Login

↓

Password Verified

↓

MFA Challenge

↓

Code Verification

↓

Authenticated
```

---

# Trusted Devices

Trusted devices reduce repeated MFA prompts.

Stored information includes:

- Device Name
- Browser
- Operating System
- Last Login
- Expiration Date

Users can revoke devices from their profile.

---

# Session Management

Supported operations

- View Active Sessions
- Revoke Session
- Logout All Devices
- Track Login History

---

# Authentication Errors

Example

```json
{
    "success": false,
    "code": "authentication_failed",
    "message": "Invalid email or password."
}
```

Common error codes

| Code | Description |
|------|-------------|
| authentication_failed | Invalid credentials |
| token_expired | Access token expired |
| token_invalid | Invalid token |
| permission_denied | Authorization failed |
| mfa_required | MFA verification required |
| session_expired | Session expired |

---

# Security Features

StudioHub implements

- Password Hashing
- JWT Signing
- Refresh Token Rotation
- MFA
- Trusted Devices
- Session Tracking
- Audit Logging
- Rate Limiting
- HTTPS Enforcement

---

# Authentication Events

Successful authentication publishes events.

Examples

```text
LoginSucceeded

LoginFailed

Logout

PasswordChanged

PasswordReset

MFAEnabled

MFADisabled

TrustedDeviceAdded

SessionRevoked
```

---

# Best Practices

- Always use HTTPS.
- Keep access tokens short-lived.
- Rotate refresh tokens.
- Enable MFA for privileged users.
- Store refresh tokens securely.
- Never expose sensitive authentication details.
- Audit every login attempt.

---

# Future Enhancements

Planned features

- OAuth2
- OpenID Connect (OIDC)
- SAML
- LDAP
- Microsoft Entra ID
- Google Workspace Login
- GitHub Authentication
- WebAuthn / Passkeys
- Hardware Security Keys

---

# Related Documents

- overview.md
- permissions.md
- ../03-backend/authentication.md
- ../03-backend/identity.md
- ../03-backend/events.md