# Rotating secrets

What each secret protects, what rotating it costs, and the steps (TPN review TM-006). Fresh random values
come from `manage.py generate_secrets` (add `--output FILE` to write them to a new file readable only by
its owner). Do the rotation in a maintenance window and keep the old value until the step says to remove it.

Treat every secret as exposed, and rotate it, if it was ever committed, pasted into a ticket or chat, or
kept in a file other users could read. The repository is public: a committed value is a published value.
A scan of the history (351 commits, 28 October 2026) found no production-grade secret: the only committed
environment files carried short placeholder values, and the keys in the committed test environment are for
tests only. The one value worth rotating if it was ever used is the object-store root password from the
July 2026 compose file; the object store has since been removed.

| Secret | Protects | Rotating it |
| ------ | -------- | ----------- |
| `DJANGO_SECRET_KEY` | Signs access/refresh tokens and download links | Every session ends (everyone signs in again). No overlap period |
| `API_KEY_PEPPER` | HMAC digests of API keys and personal access tokens | Every API key and token stops working; owners create new ones. No overlap period |
| `MFA_ENCRYPTION_KEY` | TOTP secrets at rest (Fernet) | No user impact when done in order below |
| `DELIVERY_SECRET_KEY` | Delivery passcodes at rest (Fernet) | No user impact when done in order below |
| `REDIS_PASSWORD` | Cache, permission cache, task queue | Brief outage while Redis and the app restart; queued tasks may be lost |
| Database password | All application data | Brief outage while the app restarts |
| Mail relay credentials | Outgoing email | Reset emails fail until updated |
| Backup key pair | Reading backups | Old backups still need the old private key; keep it |
| Internal CA and service certificates | Internal TLS | All services restart; see below |

## Order of work

1. Generate new values: `manage.py generate_secrets --output new-secrets.env`, then move the file to your
   secret store and delete it from the host.
2. Rotate the two Fernet keys first, because they need an overlap:
   1. Put the new key **first** and keep the old one after it, comma separated
      (`MFA_ENCRYPTION_KEY=<new>,<old>`, `DELIVERY_SECRET_KEY=<new>,<old>`). Restart the application and
      workers. New values are written under the new key; old values still read.
   2. Run `manage.py mfa_rekey` and `manage.py delivery_rekey` (each takes `--dry-run`). They re-encrypt
      every stored value under the first key and print counts only. Run them again: the second run must
      report `rekeyed: 0`.
   3. Remove the old key from each setting and restart. Keep the old key in the secret store until a
      database backup taken before step 2 has aged out of retention, because that backup needs it.
3. Rotate `REDIS_PASSWORD`: change it in the environment and in both Celery URLs
   (`CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`), then restart Redis, the application and the workers
   together. Use URL-safe characters (the generator does).
4. Rotate the database password: `ALTER ROLE <user> PASSWORD '<new>'` on the running server (the
   `POSTGRES_PASSWORD` variable is used only when the data directory is first created, so changing it
   alone does nothing), then set `DB_PASSWORD` (and `POSTGRES_PASSWORD`, to keep them equal) and restart
   the application and workers.
5. Rotate `DJANGO_SECRET_KEY` and `API_KEY_PEPPER` last, together, and tell users: everyone signs in again
   and re-creates API keys and personal access tokens. If you suspect the pepper leaked, first run
   `manage.py legacy_credentials` to see what depends on the old digests.
6. Rotate mail relay credentials at the provider and update `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD`.
7. Backup key pair: run `infrastructure/scripts/backup.sh keygen <dir>`, move the new private key off the
   machine, point `BACKUP_CERT` at the new certificate. New backups use it; keep the old private key for the
   old backups.
8. Internal certificates: they renew themselves 30 days before expiry when the stack is brought up. To
   replace the authority (suspected CA key exposure), remove the `tls_data` and `tls_ca` volumes and bring
   the stack up; every service restarts.
9. After rotating, confirm: `manage.py check --deploy` reports no errors, a login works, an MFA login works,
   and a delivery passcode can be read.

## After an exposure

- Rotate everything in the table, not only the exposed secret, if you cannot tell how far it spread.
- Revoke sessions and credentials: changing `DJANGO_SECRET_KEY` ends every session; changing
  `API_KEY_PEPPER` invalidates every API key and token; individual credentials can be revoked from the
  credentials screens (`manage.py legacy_credentials` lists those still on the old digest).
- Removing a file from the repository does not remove it from history. Rewriting public history is
  disruptive (every clone must be replaced) and does not recall copies already taken, so rotation is the
  fix; rewrite only if you also need the content gone for other reasons.
- Secret scanning with push protection is switched on for this repository on GitHub, and CI scans every
  push; both are backstops, not a reason to commit secrets.

See also `secrets-management.md` (general guidance) and `repository-controls.md`.
