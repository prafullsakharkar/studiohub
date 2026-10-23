# ADR-0036: Scoped Credentials and Peppered Digests

- **Status:** Accepted
- **Date:** 2026-10-22
- **Decision Makers:** Architecture Team (implements decisions A5 and A6 in `docs/identity/CONTRACTS.md`)
- **Supersedes:** None
- **Superseded By:** None

---

# Context

API keys and personal access tokens (PATs) authenticated a request as their
owner but carried no usable restriction: `scopes` was stored and never
evaluated, so every credential had its owner's full access, and a credential
owned by a superuser inherited the superuser bypass. Digests were an unkeyed
`sha256(SECRET_KEY:token)`. There was no way to create, rotate or revoke a
credential except Django admin, which could not mint a valid one. Re-activating
an account turned on every inactive credential, including ones deliberately
revoked.

# Decision

1. **Scopes are permission codes and only ever narrow.** For a request
   authenticated by a credential with scopes, `HasPermission` requires each
   needed permission to be listed in the scopes, and the owner must still hold
   it (superusers hold everything). A scoped credential therefore never
   exceeds its scopes or its owner. A scoped credential owned by a superuser
   gets exactly its scopes, not the break-glass bypass.
2. **Legacy credentials with no scopes keep the owner's full access.** This
   is the documented exception to "empty means nothing" (DOM-CRED-04): turning
   it off would break every credential in existence. New credentials must
   declare at least one scope, and each scope must be a permission the owner
   holds at creation time. Old coarse labels (`read`, `write`) are not
   permission codes and grant nothing.
3. **Digests are `HMAC-SHA256(API_KEY_PEPPER, token)`**, stored as `v2$…`.
   The pepper is a dedicated secret. Old unkeyed digests still verify while
   `API_KEY_ACCEPT_LEGACY_HASH` is true and are replaced on first successful
   use. A missing pepper fails closed: no credential is created and no `v2$`
   digest verifies. Lookup is by the non-secret prefix with a constant-time
   comparison.
4. **One service and API over both tables** (no physical merge): create,
   list, retrieve, rotate, revoke. The secret is returned once, by create and
   rotate. Only the owner can create or rotate; an administrator holding
   `identity.credential.manage` can list and revoke. The lifecycle routes
   accept a session JWT only, so a credential cannot mint, rotate or revoke
   credentials.
5. **Revocation is distinct from suspension.** `revoked_at` marks a deliberate
   revocation; an account's deactivation only clears `is_active`, and
   re-activation restores only credentials with no `revoked_at`.
6. An `ApiKey` acts as its **owner, else its creator**.

# Consequences

- `API_KEY_PEPPER` must be set before deployment (`manage.py check` reports
  `identity.E002`). Changing it invalidates every stored credential.
- Scope enforcement applies where `HasPermission` is used. Endpoints that
  need no permission, or that use other permission classes, are not narrowed
  by scopes.
- Credentials that existed before this change and were revoked while their
  owner was active are back-filled with `revoked_at`; ones revoked while the
  owner was inactive cannot be told apart from suspended ones.
- The legacy digest path and the unscoped-credential exception should be
  retired once ops confirm every credential has been used (or reissued) since
  the change.
