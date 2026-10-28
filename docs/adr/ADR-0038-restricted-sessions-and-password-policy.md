# ADR-0038: Restricted sessions, MFA for external members, and the password policy

Status: accepted (2026-10-28) · Review: TPN/MPA repository review, TM-007

## Context

Two controls were advisory. Login for a user whose policy required MFA but who had not enrolled
returned a full session plus a flag (`mfa_enrollment_required`) asking the client to send them to an
enrollment screen. `must_change_password` was a claim in the token and a field in the user payload,
set by an administrator's reset and by `bootstrap`; nothing on the server read it, so the old (or
default) password stayed fully usable. In both cases the control was the front end, which is not a
control. MFA was also required only of staff and superusers, although vendor and client members reach
pre-release content from outside the studio, and the password policy had no history and a minimum of
eight characters.

## Decisions

1. **A session can be restricted.** `SessionBoundJWTAuthentication` refuses every endpoint with
   `403 {"detail", "code"}` while the user owes a password change (`password_change_required`) or an
   MFA enrollment (`mfa_enrollment_required`), except the endpoints that settle it, `auth/me` and
   `logout`. Doing it in the authenticator means no view can forget it. The password is settled first.
2. **The 403 is kept.** The exception handler turns an authenticator's `PermissionDenied` into a 401
   because the user is not yet set; an exception marked `keeps_forbidden_status` is exempt, since the
   user was identified and the client needs the code.
3. **MFA is required of external members.** A user with an active vendor or client project membership
   must use MFA (`MFA_REQUIRE_EXTERNAL`, default on). Identity does not import Production: it asks the
   `production.external_membership` provider by name (`apps.core.providers`). `MFA_REQUIRE_ALL`
   (environment) extends the requirement to every account; the production templates turn it on.
4. **Password policy.** 12 to 128 characters, no reuse of the current password or the last five
   (hashes in `PasswordHistory`, pruned to the window). Composition rules stay as they were.

## Consequences

- Clients must handle the two 403 codes and send the user to the matching screen; the login response
  still carries `mfa_enrollment_required`.
- A bootstrapped superuser must change the initial password and enroll MFA before doing anything else.
  A required user who loses their factor needs a recovery code or another superuser's MFA reset.
- Per-request cost: a policy check, and for required users one `UserMFA` lookup. Staff/superuser
  decisions need no query; the external check is one indexed membership query.
- API keys and personal access tokens are not sessions and are not restricted; they are created from a
  full session, so the creator has passed the gate.

## Not decided here

Password expiry (NIST 800-63B advises against periodic rotation) and breach-corpus screening (needs an
outbound call or a shipped list) are left out; `must_change_password` after an administrator's reset
covers the compromise case.
