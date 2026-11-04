# ADR-0039: Directory (LDAP) sign-in beside local accounts, configured from the application

Status: **accepted** (proposed and revised 2026-11-04; approved by the owner the same day: "approved
CR-40") · Change request: CR-40 (`docs/sync/backend-change-requests.md`) · Implementation and
evidence: `docs/sync/backend-cr-40-verification.md`

## Context

Every account today is local. `AuthenticationService.login` finds the user by e-mail
(`AuthenticationSelector.get_user`, `USERNAME_FIELD = "email"`; there is no username column), and
`AuthenticationValidator.validate_login` makes exactly one password-hash comparison whether or not the
account exists, then applies the lockout (`LoginAttempt` per username), the MFA policy
(`MFAPolicy.is_required`, ADR-0038) and starts a session-bound JWT. A user created by `UserService`
gets a People record after commit (DOM-MD-PER-10).

The studio runs **OpenLDAP** and wants staff to sign in with their directory **username** and
password; an administrator turns it on and off and sets it up **from a settings screen**, and the
first successful sign-in makes the account and its People record.

Owner's answers (2026-11-04): OpenLDAP; users type their username; new directory users get the
**Artist** role; when the directory cannot be reached, directory users cannot sign in (fail closed)
while local accounts keep working. Revised the same day: **MFA is off by default for directory
users**; a platform or organization administrator can require it for a single user; the directory
settings, including on/off, are managed **from the frontend**.

## Decisions

1. **One login, two ways to check the password.** The directory is a second credential check inside
   `AuthenticationService.login`, not a second login system. Everything after the check is shared and
   unchanged: the lockout, the login-attempt ledger, security events, the MFA challenge or enrollment,
   the restricted session (ADR-0038) and the session-bound JWT.

2. **Which check runs.** For the identifier typed:
   - a **directory identity** with that username exists → bind to the directory as that user;
   - else a **local account** with that e-mail exists → the local password check, exactly as today;
   - else, with directory sign-in on → search the directory; a match whose bind succeeds is
     provisioned (decision 6);
   - else the same generic failure as today.

   Local accounts keep signing in with their e-mail whether the directory is on or off; the
   bootstrapped administrator is the break-glass account. A directory user signs in with the username
   only. The local dummy-hash comparison still runs on the directory path, so the two paths do not
   differ by the cost of a hash.

3. **Configured in the application, not in the environment.** One configuration record
   (`identity.DirectoryConfiguration`, a single row) holds: enabled, server URI, StartTLS, the CA
   certificate (PEM), the service account's DN and password, the user search base and filter, the
   attribute names, the timeout, the default role (`artist`), and "require MFA for directory users"
   (default off).
   - **Managed from Settings → System → Directory (LDAP)** in the frontend, through
     `GET`/`PATCH /api/v1/identity/directory/` and two checks, `POST …/test-connection/` (service
     bind and a base search) and `POST …/test-user/ {"username"}` (finds the entry and shows the
     attributes that would be copied; never asks for or uses the user's password).
   - **Who may.** A new permission, `identity.directory.manage`, held by the platform administrator
     only (the full catalog). It is a server and secret setting, so the organization administrator role
     does not get it unless the owner asks for that.
   - **The service password is write-only.** Stored encrypted at rest with a dedicated key
     (`DIRECTORY_ENCRYPTION_KEY`, the same `FieldCipher` as MFA and delivery secrets, fail closed); the
     API reports only whether one is set and never returns it, and the audit log records that it
     changed, not its value.
   - **It cannot be switched on broken.** Saving refuses a plain `ldap://` URI without StartTLS, and
     turning it on requires a successful connection test with the saved settings. Every change is
     audited (who, when, which fields).
   - **Emergency off from the server.** `DIRECTORY_LOGIN_FORCE_OFF` (environment, default off)
     overrides the screen, for an operator who cannot reach the application.

   While directory sign-in is off, directory users cannot sign in (they have no local password) and
   local accounts are unaffected.

4. **How the directory is checked (OpenLDAP).**
   - **Search then bind.** Bind with the service account, search the base with the filter (default
     `(&(objectClass=inetOrgPerson)(uid={username}))`, the username escaped with
     `ldap3.utils.conv.escape_filter_chars`), expect exactly one entry, then bind as that entry's DN
     with the typed password. The password is never read or compared here, only bound with.
   - **An empty password is refused before any bind.** RFC 4513 §5.1.2 defines a DN with an empty
     password as an *unauthenticated* bind, which a server may report as success.
   - **Transport is verified.** `ldaps://` or StartTLS, the server certificate checked against the
     configured CA; a connect and a read timeout (default 5 seconds).
   - **Attributes.** `entryUUID` (RFC 4530, stable across renames) is the subject; `uid`, `mail`,
     `givenName`, `sn` and `displayName` fill the account. Attribute names are part of the
     configuration.
   - **Library.** `ldap3` (pure Python, no C dependency; an in-memory mock server for tests).
     `django-auth-ldap` replaces Django's authentication backend and would bypass the lockout, the
     ledger and the MFA steps in `AuthenticationService`.

5. **MFA: off by default for directory users, required per user by an administrator.**
   - A new per-user flag, **`mfa_required`** on the account (default off), set from the account
     section of the person's page by a platform administrator or an organization administrator: a new
     permission `identity.user.require_mfa`, added to the platform administrator (full catalog) and to
     the `org-admin` role. It works for local accounts too. Turning it on makes the user enrol at their
     next request (the restricted session of ADR-0038); turning it off stops requiring it, and a factor
     they already enrolled keeps being asked for until they remove it.
   - `MFAPolicy.is_required` becomes: superuser and staff rules as now; **`mfa_required`** → required;
     the blanket `MFA_REQUIRE_ALL` → required **for local accounts only**, or for directory users too
     when the configuration's "require MFA for directory users" is on; the external-member rule (a
     vendor or client project member, TM-007) → required for every account, directory or local.
   - **What this changes for production.** ADR-0038's amendment makes MFA for every account the
     production default (`MFA_REQUIRE_ALL`). Directory users become the exception to it unless the
     configuration says otherwise. That is a weaker default than today's for those users and is a
     decision for the owner; the TPN/MPA reviews asked for MFA on remote access to pre-release content.
     The external-member rule is kept for directory users for that reason.

6. **First sign-in creates the account and the People record.**
   - A `User` through `UserService`, e-mail from `mail`, an unusable local password,
     `must_change_password` off, profile names from the directory; an `ExternalIdentity` row ties it to
     the entry. The People record follows by itself (DOM-MD-PER-10).
   - The configured default role (**`artist`**) is granted once, at creation, through the RBAC service
     (so the permission cache is invalidated). An administrator who removes it later is not overridden.
   - **No `mail`, no account.** The account's identity is its e-mail, so an entry without one is
     refused and logged (`ldap_no_email`).
   - **An existing local account with the same e-mail is not taken over.** Provisioning is refused and
     logged (`ldap_email_conflict`); an administrator links the two on purpose (a management command in
     the plan). Linking by e-mail automatically would let anyone who controls a directory entry's
     `mail` sign in as that local account.

7. **Later sign-ins refresh the account.** Name and e-mail are copied from the directory on each
   successful sign-in (an e-mail already used by another account is kept as it was and logged); the
   People record follows through the existing sync (DOM-MD-PER-03).

8. **Passwords stay in the directory.** Change-password and password-reset refuse a directory user
   with a stable code (`password_managed_by_directory`); `auth/me` reports `auth_source`
   (`local` or `ldap`) so the client can hide those screens. Both are API contract additions
   (`docs/identity/CONTRACTS.md`).

9. **Fail closed.** If the directory cannot be reached or times out, a directory user gets the same
   generic failure as a wrong password, and the server logs `ldap_unavailable`. That attempt is recorded
   in the ledger with its reason but **does not count toward the lockout**, so an outage does not lock
   everyone out. A local account is not affected.

10. **Leavers.** An entry that is deleted, or no longer matches the filter (the place to exclude
    disabled accounts), fails at the next sign-in. `manage.py ldap_sync [--dry-run]` deactivates those
    accounts and revokes their sessions, and refreshes names; run it on a schedule.

## Data

- `identity.DirectoryConfiguration`: one row; the fields of decision 3, the service password as
  ciphertext.
- `identity.ExternalIdentity`: `user` (FK), `provider` (`ldap`), `subject` (`entryUUID`, unique per
  provider), `username` (`uid`, unique case-insensitively per provider), `dn`, `last_synced_at`.
- `User.mfa_required` (boolean, default off).

All platform-global, no organization column (ADR-0034). Additive migrations; no existing row changes.

## Consequences

- Directory users depend on the directory being reachable; the break-glass local administrator does
  not.
- One outbound connection per directory sign-in (search and bind), within the login request.
- A new secret key (`DIRECTORY_ENCRYPTION_KEY`) to provision; without it the configuration cannot be
  saved with a password and directory sign-in stays off (fail closed), and the pre-deploy checklist
  lists it.
- The Django admin login stays local-only (it uses `EnterpriseAuthenticationBackend`), so a directory
  user cannot reach the admin even with the role.
- Turning directory sign-in off locks directory users out until it is turned back on; that is the
  intended "off".

## Implementation notes (2026-11-04)

- The login body keeps its one field, `email`, which now also takes a directory username; a value
  with an `@` must still be a valid address. The check is chosen by the identifier
  (`AuthenticationService._check_credentials`): an account's e-mail is checked locally, as before;
  otherwise a linked directory username, or any name while directory sign-in is on, is checked
  against the directory. A directory account therefore signs in with its username: its e-mail
  meets an unusable local password and fails like any wrong password.
- A directory sign-in spends one password-hash comparison even though it compares nothing, so the
  two paths take the same time for an unknown name.
- `UserSelector` shows other accounts only to staff and superusers, so an `org-admin` who is not
  staff gets `404` on a person's `require-mfa`, as on every other account action there. Unchanged
  here (the verification report lists it).

## Not decided here

Mapping directory groups to roles (only the one default role is proposed), single sign-on (SAML or
OIDC), and Active Directory specifics (`sAMAccountName`, `userPrincipalName`) are left for later; the
configuration record and the `ExternalIdentity` table are where they would go.
