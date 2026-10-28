# Security policy

StudioHub handles pre-release client content. Please report security problems privately.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: **Security → Report a vulnerability** on this repository.
Do not open a public issue or pull request for a vulnerability, and do not include real credentials,
tokens or client content in a report.

A useful report says what is affected, how to reproduce it, and what an attacker gains. We will
confirm receipt, tell you whether we consider it a vulnerability, and keep you informed until it is
fixed.

## Supported versions

Only the `main` branch is supported. Fixes are made on `develop` and released from there.

## What to expect from the code base

- Findings from security reviews are tracked with the identifiers used in
  `docs/10-security/tpn-immediate-remediation.md`.
- Dependencies are scanned weekly and on every lock-file change; container images are scanned weekly
  (see `docs/10-security/vulnerability-management.md`).
- Secrets must never be committed; a secret scan runs on every push and pull request.
