# Follow-up Ticket — OrganizationContext Tenancy Reset on Full Reload

Status: **Open — follow-up required before/after Production Role Scoping merge.**
Source: final review of the Production Role Scoping program (ruling: a filed ticket is
**required** before merge). This document IS the ticket — a handoff, not a fix. Do not close it
by editing `OrganizationContext` from the role-scoping branch.

## Symptom

On a full page reload, the active studio tenancy resets to the **first accessible membership**
instead of the previously selected (and persisted) organization. A superuser (or multi-org
member) who had anchored the session in a non-default org silently lands back in the first
org after a reload — context, scoped reads, and any `X-Organization-Id`-scoped traffic all
shift without user intent.

## Reproduction

1. Log in as a superuser (or any account with multiple organization memberships).
2. Switch the active organization to a non-default org (e.g. Wētā Cyberworks) via the header
   OrganizationSwitcher.
3. Perform a full browser reload while anchored on that org.
4. Observe: the active tenancy has converged back to the first accessible org (e.g. Apex
   Digital Studios); the persisted `studiohub_active_org_id` in localStorage has been
   overwritten with the first org.

## Root cause

`src/core/organization/OrganizationContext.tsx`, the "adjust currentOrgId" effect
(~lines 119–142):

- `currentOrgId` initializes from `localStorage` (`STORAGE_KEY`), so the persisted org is
  correct at mount.
- The effect computes `accessibleOrgIds` from `userOrganizations`, which is empty until the
  server-filtered org directory (`refreshOrganizations` → `getMyOrganizations()`) settles.
- **Line 124–130**: when `accessibleOrgIds.length === 0` (directory not yet loaded), any
  non-empty persisted `currentOrgId` is blanked to `''` and the production store is reset.
- **Line 132–135**: once memberships resolve, a blanked (or non-listed) `currentOrgId` is
  coerced to `accessibleOrgIds[0]` and **written back to localStorage**, permanently discarding
  the original persisted org.

In short: the effect blanks a non-listed `currentOrgId` **before the directory settles**, then
converges to the first membership — so a persisted non-default org is lost on every full
reload. The context already exposes `isDirectoryLoaded` (flipped in `refreshOrganizations`)
precisely to distinguish "empty because still loading" from "empty because no access", but the
reset effect does not wait for it.

## Existing workaround

`e2e/production-role-scoping.spec.ts` (header note + lines 149–153): the journey anchors all
reload-bearing steps in Apex — the first membership — and performs the Wētā probe via
client-side navigation only, because a reload in a non-default org would silently reset the
tenancy. See also the T6 report watch-item
(`.superpowers/sdd/2026-09-29-production-role-scoping/task-6-report.md`).

## Suggested fix direction (for the owning ticket)

- **Defer the reset until the directory settles**: gate lines 124–135 on `isDirectoryLoaded`
  (skip — not blank — while `accessibleOrgIds.length === 0 && !isDirectoryLoaded`), so the
  not-yet-loaded window never blanks a persisted org id.
- **Preserve the persisted org when it is still allowed**: once the directory settles, keep
  `currentOrgId` if it is in the accessible set; only coerce to `accessibleOrgIds[0]` when the
  persisted org is genuinely inaccessible (or absent).
- Do not overwrite `localStorage[STORAGE_KEY]` speculatively — the write-back at line 137 is
  what destroys the persisted value; it should only run on a deliberate switch or a confirmed
  access loss.
- Regression pin: E2E — switch to a non-default org, full reload, assert the switcher still
  shows that org (extends `production-role-scoping.spec.ts` once the workaround can be
  removed).
