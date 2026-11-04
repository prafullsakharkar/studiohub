# ADR-0039: Directory (LDAP) sign-in beside local accounts, switchable on and off

Status: **proposed** (2026-11-04), awaiting the owner's approval · Change request: CR-40
(`docs/sync/backend-change-requests.md`)

## Context

Every account today is local. `AuthenticationService.login` finds the user by e-mail
(`AuthenticationSelector.get_user`, `USERNAME_FIELD = "email"`; there is no username column), and
`AuthenticationValidator.validate_login` makes exactly one password-hash comparison whether or not the
account exists, then applies the lockout (`LoginAttempt` per username), the MFA policy (ADR-0038) and
starts a session-bound JWT. A user created by `UserService` gets a People record after commit
(DOM-MD-PER-10).

The studio runs **OpenLDAP** and wants staff to sign in with their directory **username** and
password, with a switch to turn it off, and an account plus a People record made on the first
successful sign-in.

Owner's answers (2026-11-04): OpenLDAP; users type their username; directory users go through the
application's MFA; new directory users get the **Artist** role; when the directory cannot be reached,
directory users cannot sign in (fail closed) while local accounts keep working.

## Decisions

1. **One login, two ways to check the password.** The directory is a second credential check inside
   `AuthenticationService.login`, not a second login system. Everything after the check is shared and
   unchanged: the lockout, the login-attempt ledger, security events, the MFA challenge or enrollment,
   the restricted session (ADR-0038) and the session-bound JWT.

2. **Which check runs.** For the identifier typed:
   - a **directory identity** with that username exists → bind to the directory as that user;
   - else a **local account** with that e-mail exists → the local password check, exactly as today;
   - else, with directory sign-in on → search the directory; a match whose bind succeeds is
     provisioned (decision 5);
   - else the same generic failure as today.

   Local accounts keep signing in with their e-mail whether the directory is on or off; the
   bootstrapped administrator is the break-glass account. A directory user signs in with the username
   only. The local dummy-hash comparison still runs on the directory path, so the two paths do not
   differ by the cost of a hash.

3. **On and off.** Two switches, both needed:
   - `LDAP_ENABLED` (environment, default **off**) is the master switch and gates the deploy checks.
     Off: no directory code runs and no connection is opened; behaviour is today's.
   - A runtime flag, `identity.ldap_login`, in the settings app lets an administrator turn directory
     sign-in off and on without a redeploy. Identity does not import Settings: it asks a provider
     registered by name (`apps.core.providers`), as ADR-0038 does for Production.

   While either switch is off, directory users cannot sign in (they have no local password) and local
   accounts are unaffected.

4. **How the directory is checked (OpenLDAP).**
   - **Search then bind.** Bind with a service account, search `LDAP_USER_BASE_DN` with
     `LDAP_USER_FILTER` (default `(&(objectClass=inetOrgPerson)(uid={username}))`, the username escaped
     with `ldap3.utils.conv.escape_filter_chars`), expect exactly one entry, then bind as that entry's DN
     with the typed password. The password is never read or compared here, only bound with.
   - **An empty password is refused before any bind.** RFC 4513 §5.1.2 defines a DN with an empty
     password as an *unauthenticated* bind, which a server may report as success.
   - **Transport is verified.** `ldaps://` or StartTLS, with the server certificate checked against
     `LDAP_CA_CERT`; a connect and a read timeout (`LDAP_TIMEOUT_SECONDS`, default 5).
   - **Attributes.** `entryUUID` (RFC 4530, stable across renames) is the subject; `uid`, `mail`,
     `givenName`, `sn` and `displayName` fill the account. Attribute names are settings.
   - **Library.** `ldap3` (pure Python, no C dependency; an in-memory mock server for tests).
     `django-auth-ldap` replaces Django's authentication backend and would bypass the lockout, the
     ledger and the MFA steps in `AuthenticationService`.

5. **First sign-in creates the account and the People record.**
   - A `User` through `UserService`, e-mail from `mail`, an unusable local password,
     `must_change_password` off, profile names from the directory; an `ExternalIdentity` row ties it
     to the entry. The People record follows by itself (DOM-MD-PER-10).
   - The **`artist`** role (`LDAP_DEFAULT_ROLE`) is granted once, at creation, through the RBAC service
     (so the permission cache is invalidated). An administrator who removes it later is not overridden.
   - **No `mail`, no account.** The account's identity is its e-mail, so an entry without one is
     refused and logged (`ldap_no_email`).
   - **An existing local account with the same e-mail is not taken over.** Provisioning is refused
     and logged (`ldap_email_conflict`); an administrator links the two on purpose (a management
     command in the plan). Linking by e-mail automatically would let anyone who controls a directory
     entry's `mail` sign in as that local account.

6. **Later sign-ins refresh the account.** Name and e-mail are copied from the directory on each
   successful sign-in (an e-mail already used by another account is kept as it was and logged); the
   People record follows through the existing sync (DOM-MD-PER-03).

7. **Passwords stay in the directory.** Change-password and password-reset refuse a directory user
   with a stable code (`password_managed_by_directory`); `auth/me` reports `auth_source`
   (`local` or `ldap`) so the client can hide those screens. Both are API contract additions
   (`docs/identity/CONTRACTS.md`).

8. **MFA as for everyone.** Directory users get the same MFA policy as local users (ADR-0038):
   enrollment and challenge, recovery codes, and `MFA_REQUIRE_ALL`, which is on by default in
   production, so every directory user enrols there.

9. **Fail closed.** If the directory cannot be reached or times out, a directory user gets the same
   generic failure as a wrong password, and the server logs `ldap_unavailable`. That attempt is recorded
   in the ledger with its reason but **does not count toward the lockout**, so an outage does not lock
   everyone out. A local account is not affected.

10. **Leavers.** An entry that is deleted, or no longer matches the filter (the place to exclude
    disabled accounts), fails at the next sign-in. `manage.py ldap_sync [--dry-run]` deactivates those
    accounts and revokes their sessions, and refreshes names; run it on a schedule.

11. **Deploy checks** (with `LDAP_ENABLED` on): an error when the URI is plain `ldap://` without
    StartTLS, when certificate verification is off, or when the service account's DN or password is
    empty.

## Data

`identity.ExternalIdentity`: `user` (FK), `provider` (`ldap`), `subject` (`entryUUID`, unique per
provider), `username` (`uid`, unique case-insensitively per provider), `dn`, `last_synced_at`.
Platform-global, no organization column (ADR-0034). One additive migration; no existing row changes.
A separate table keeps `User` unchanged and leaves room for other providers later.

## Consequences

- Directory users depend on the directory being reachable; the break-glass local administrator does
  not.
- One outbound connection per directory sign-in (search and bind), within the login request.
- The Django admin login stays local-only (it uses `EnterpriseAuthenticationBackend`), so a directory
  user cannot reach the admin even with the role.
- Turning the runtime flag off locks directory users out until it is turned back on; that is the
  intended "off".

## Not decided here

Mapping directory groups to roles (only the one default role is proposed), single sign-on (SAML or
OIDC), and Active Directory specifics (`sAMAccountName`, `userPrincipalName`) are left for later; the
`ExternalIdentity` table and the attribute settings are where they would go.
