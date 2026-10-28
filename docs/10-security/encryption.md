# Encryption Guide

## Overview

Encryption protects sensitive information from unauthorized access during storage and transmission. StudioHub uses industry-standard encryption algorithms, secure key management, and encrypted communication channels to safeguard user data, authentication credentials, production assets, and system secrets.

Encryption is one layer of a broader defense-in-depth strategy and should always be combined with authentication, authorization, auditing, and secure infrastructure.

---

# What this repository implements

The sections below are the general guide. This one says what the code and the production compose
overlay do today (TPN review TM-009).

## In transit

| Link | Protection |
| ---- | ---------- |
| Browser to nginx | TLS 1.2/1.3 with your certificate (`infrastructure/docker/nginx/certs`), HSTS |
| nginx to Django | HTTPS; nginx verifies Django's certificate against the internal CA (`proxy_ssl_verify on`) |
| Django, Celery to PostgreSQL | TLS 1.2+; `DB_SSLMODE=verify-full` with `DB_SSLROOTCERT`. The server accepts only `hostssl` connections (`pg_hba.prod.conf`) |
| Django, Celery to Redis | TLS (`REDIS_TLS=true`, `rediss://` Celery URLs) verified against `REDIS_CA_CERT`; Redis' plain port is closed and a password is required |
| Django to the mail relay | STARTTLS or implicit TLS; `check --deploy` refuses plain SMTP |

`manage.py check --deploy` reports a database or Redis link that is not encrypted and verified as warnings
`core.W006` / `core.W007`, and as errors `core.E006` / `core.E007` with `INTERNAL_TLS_REQUIRED=true` (the
production template sets it), so a misconfigured start is refused.

**Certificates.** The one-shot `tls-init` service creates a private CA (10 years) and one certificate per
service (PostgreSQL, Redis, Django; 397 days) in the `tls_data` volume. The CA key stays in `tls_ca`, which
only that job mounts. Each private key is readable only by its service's user. `docker compose up`
re-runs the job, and certificates within 30 days of expiry are reissued from the same CA; restart the
services to load them. To replace the CA, remove both volumes and bring the stack up again. To use your own
CA, put `ca.pem` and `<service>.pem` / `<service>.key` in `tls_data` first; existing files are not touched.
For a managed database or cache, set `DB_SSLMODE`, `DB_SSLROOTCERT` and `REDIS_*` for the provider's CA.

## At rest

- **Encrypted by the application:** passwords (Django hashers), password-reset tokens, API keys and personal
  access tokens (HMAC digests keyed by `API_KEY_PEPPER`), TOTP secrets (`MFA_ENCRYPTION_KEY`) and delivery
  passcodes (`DELIVERY_SECRET_KEY`), both Fernet with rotation.
- **Not encrypted by the application:** the other database rows, uploaded files (`media_volume`) and any
  backup. They rely on the storage underneath, so these volumes must be on encrypted storage:
  `postgres_data`, `redis_data`, `media_volume`, `tls_data` and `tls_ca` (private keys and the CA key).
- **Evidence.** `infrastructure/scripts/check-encryption-at-rest.sh [project]` finds each volume's backing
  device and reports `ENCRYPTED` (dm-crypt/LUKS or ZFS native encryption), `ATTESTED` (provider-level
  encryption, with `PROVIDER_ENCRYPTION_REF` pointing at the evidence) or `UNKNOWN` (exit 1). A cloud
  provider's disk encryption is below the guest and cannot be detected; record the evidence instead.
- **Backups.** The repository has no backup tooling (see `docs/06-infrastructure/backup.md`). Whatever takes
  them must encrypt them, with keys held apart from the data.

# Objectives

The encryption strategy aims to:

- Protect confidential data
- Secure network communication
- Prevent unauthorized disclosure
- Support regulatory compliance
- Protect backups
- Secure authentication secrets
- Enable secure key rotation
- Maintain data integrity

---

# Encryption Layers

StudioHub applies encryption at multiple layers.

```text
Client

↓

TLS Encryption

↓

API Server

↓

Application Encryption

↓

Database Encryption

↓

Encrypted Backups

↓

Secure Storage
```

Multiple encryption layers provide defense in depth.

---

# Data Classification

Data should be classified before determining encryption requirements.

| Classification | Examples | Encryption Required |
|---------------|----------|---------------------|
| Public | Documentation | Optional |
| Internal | Project Metadata | Recommended |
| Confidential | User Information | Required |
| Restricted | Password Hashes, Secrets | Mandatory |

Higher classifications require stronger protection.

---

# Encryption in Transit

All communication must use:

- HTTPS
- TLS 1.2 or newer
- Strong cipher suites
- Certificate validation
- HSTS

Plain HTTP should never be used in production.

---

# Encryption at Rest

Sensitive data stored in:

- PostgreSQL
- Redis (where supported)
- Object Storage
- Backup Archives
- Log Archives

should be encrypted using platform-supported encryption mechanisms.

---

# Password Storage

Passwords are **not encrypted**.

They must be:

- Securely hashed
- Salted
- Non-reversible
- Upgradable

Use Django's recommended password hashers.

---

# Token Protection

Protect:

- JWT Signing Keys
- Refresh Tokens
- API Tokens
- Service Credentials

Tokens should never appear in logs or client-side storage unless explicitly required.

---

# Database Encryption

Protect:

- Personally Identifiable Information (PII)
- Sensitive business data
- Configuration secrets
- Audit records (where required)

Database encryption complements access controls but does not replace them.

---

# File Encryption

Sensitive files may include:

- Contracts
- Financial Documents
- Production Assets
- Client Deliverables
- Backup Archives

File encryption requirements depend on organizational policies and deployment environments.

---

# Backup Encryption

Backups should:

- Be encrypted before storage
- Use secure key management
- Support integrity verification
- Follow retention policies

Backup encryption protects against storage compromise.

---

# Key Management

Encryption keys should:

- Be generated securely
- Be stored separately from encrypted data
- Support rotation
- Have restricted access
- Be backed up securely

Key management is as important as the encryption algorithm itself.

---

# Key Rotation

Rotate keys:

- Periodically
- After suspected compromise
- During infrastructure migrations
- When compliance requires

Key rotation procedures should minimize service disruption.

---

# Secret Storage

Never store encryption keys:

- In source code
- In Git repositories
- In Docker images
- In frontend applications

Secrets should be managed through secure secret management systems.

---

# Cryptographic Algorithms

Use modern, well-established algorithms.

Recommended categories:

- AES for symmetric encryption
- RSA or ECC for asymmetric encryption
- SHA-2 or SHA-3 for hashing
- Argon2 or PBKDF2 for password hashing (via Django configuration)

Avoid deprecated or custom cryptographic algorithms.

---

# Certificate Management

TLS certificates should:

- Be issued by trusted authorities
- Be renewed before expiration
- Use modern key sizes
- Be monitored for expiration

Expired certificates can disrupt secure communication.

---

# Random Number Generation

Security-sensitive values such as:

- Session IDs
- API Keys
- Reset Tokens
- Encryption Keys

must use cryptographically secure random number generators.

---

# Logging

Never log:

- Encryption Keys
- Password Hashes
- Tokens
- Secrets
- Raw confidential data

Logs should support troubleshooting without exposing sensitive information.

---

# Testing

Encryption-related testing should verify:

- Secure transport
- Certificate validation
- Key rotation
- Secure storage
- Backup encryption
- Secret handling

Testing should confirm both functionality and security.

---

# Best Practices

- Encrypt sensitive data.
- Use HTTPS everywhere.
- Rotate keys regularly.
- Separate keys from data.
- Protect backups.
- Use trusted cryptographic libraries.
- Monitor certificate expiration.

---

# Anti-Patterns

Avoid:

- Custom cryptographic algorithms
- Hardcoded encryption keys
- Weak random number generators
- Expired certificates
- Storing secrets with encrypted data
- Logging confidential information
- Using obsolete cipher suites

---

# Related Documents

- overview.md
- authentication.md
- api-security.md
- secrets-management.md
- security-headers.md
- compliance.md
- ../06-infrastructure/secrets-management.md
- ../09-testing/security-testing.md
- ../11-operations/backup-recovery.md