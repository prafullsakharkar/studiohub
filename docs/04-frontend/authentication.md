# Authentication & Security

This is the highest-stakes document in the frontend docs — StudioHub's Identity module exposes JWT auth with token rotation, MFA, trusted devices, backup codes, password policies, and login auditing (see backend `06-security/*`). The frontend's job is to implement each of these correctly, not just call the endpoints.

## Token Storage — the core security decision

| Token | Storage | Why |
|---|---|---|
| **Access token** | In-memory only (Zustand store, never persisted) | Never touches `localStorage`/`sessionStorage`. An XSS payload that runs JS can still read memory, but in-memory-only removes the *persistent* theft vector — nothing survives a page reload or is readable by a separate script tag/extension inspecting storage. |
| **Refresh token** | `httpOnly`, `Secure`, `SameSite=Strict` cookie, set by the backend | Never readable by JS at all, which is the actual point — it's the long-lived credential, so it must be immune to XSS entirely, not just "hard to get to." |

**Do not** put either token in `localStorage`. This is the single most common real-world JWT mistake and it defeats the purpose of using JWTs with rotation in the first place — any XSS becomes full account takeover with a persistent, exfiltratable token.

## Token Rotation

The backend rotates refresh tokens on every use (per `06-security/jwt.md`) and — assuming standard rotation-detection — invalidates the entire token family if a refresh token is reused (a signal of theft/replay). The frontend doesn't implement this logic; it just needs to **fail closed**: if a refresh call ever fails, treat the session as fully compromised/expired and force a clean logout + redirect to `/login`, rather than retrying or silently swallowing the error.

```ts
// src/modules/identity/api/auth.api.ts
export async function refreshAccessToken(): Promise<string> {
  // Refresh token is sent automatically as an httpOnly cookie — not read or
  // attached manually by the frontend.
  const { accessToken } = await ky
    .post(`${API_BASE}/auth/refresh/`, { credentials: "include" })
    .json<{ accessToken: string }>();
  return accessToken;
}
```

Refresh coordination (single in-flight refresh, coalesced across concurrent 401s) lives in the `ky` `afterResponse` hook — see `api-client.md`.

## Login Flow (with MFA)

```tsx
export function useLogin() {
  const setUser = useSessionStore((s) => s.setUser);

  return useMutation({
    mutationFn: authApi.login, // { email, password } -> LoginResult
    onSuccess: (result) => {
      if (result.status === "mfa_required") {
        navigate("/mfa-challenge", { state: { challengeId: result.challengeId } });
        return;
      }
      if (result.status === "trusted_device_verified") {
        // Backend recognized a trusted-device token — MFA step skipped
      }
      useSessionStore.getState().setAccessToken(result.accessToken);
      setUser(result.user);
      navigate(redirectTarget(), { replace: true });
    },
  });
}
```

1. Credentials submit → backend returns either a full session, or an `mfa_required` challenge.
2. If a **trusted device** cookie/token is present and valid, the backend may skip the MFA step entirely — the frontend doesn't decide this, it just reflects whatever the backend returns.
3. On `mfa_required`, route to the MFA challenge screen (TOTP code entry, with a "use a backup code instead" fallback).
4. On success, access token → memory (session store), user object → drives RBAC checks below.

## MFA Enrollment & Backup Codes

Enrollment (QR code + manual key entry + backup codes) lives in `modules/identity/pages/MfaSetupPage.tsx`. Two rules that are easy to get wrong:

- **Backup codes are shown exactly once.** The UI must force an explicit "I've saved these" checkbox/acknowledgment before the user can leave the screen — there is no "view backup codes again" affordance, matching the backend's one-time-display guarantee. Provide a copy-to-clipboard and a downloadable `.txt`, not just on-screen text.
- **Never log or send backup codes anywhere except the single verify-and-consume request.** No analytics events, no error-reporting breadcrumbs containing the code value.

## Trusted Devices

Account settings expose a list of trusted devices (from `06-security/trusted-devices.md`) with device name, last-seen, and a **Revoke** action per device, plus a "Revoke all other sessions" action. Revoking a device should be treated as a security-sensitive mutation: confirm via `ConfirmDialog` before firing, and invalidate the devices query on success so the list reflects it immediately.

## Route & UI Authorization (RBAC)

The Identity module's permissions are **module + action based** (e.g. `production.view_shot`, `organization.manage_department`). The frontend mirrors this exactly rather than inventing its own permission vocabulary:

```tsx
export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: JSX.Element;
}) {
  const hasPermission = useSessionStore((s) => s.user?.permissions.includes(permission));
  if (!hasPermission) return <Navigate to="/403" replace />;
  return children;
}
```

Used at both the **route** level (`routing.md`) and the **element** level (hiding a "Delete" button a user's role doesn't grant) — a hidden button is a UX nicety, not a security boundary; the backend enforces the real permission check on every request regardless. The frontend never assumes an action is safe just because a route was reachable.

## Logout

```ts
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout, // invalidates refresh token/cookie server-side
    onSettled: () => {
      useSessionStore.getState().logout();
      queryClient.clear(); // drop all cached server state — critical on shared/kiosk workstations
      navigate("/login");
    },
  });
}
```

Clearing the entire React Query cache on logout is deliberate: VFX studios frequently have shared review-room or front-desk workstations, and stale cached data (shot lists, review notes) must not be visible to the next person who logs in.

## Password Policy Feedback

Password fields surface live strength/rule feedback via a shared `usePasswordStrength` hook, mirroring the exact rules from `06-security/password-policy.md` — not a generic strength meter. If the backend rule set changes, this hook is the one place to update; forms consume it, they don't hardcode rules.

## Session Idle/Expiry UX

Given the enterprise/audit context (login auditing, soft-delete, audit models throughout the backend), the UI proactively warns before silent expiry rather than letting a user lose in-progress work (e.g. a long review-note edit) to an expired session: a lightweight idle-timer surfaces a "Your session will expire soon — stay signed in?" prompt before the access token's natural expiry, backed by the same refresh flow.

## Content Security Policy

CSP headers are set by the backend/Nginx (`06-security/*`, infra layer), but the frontend build must not violate them: no inline `<script>`, no `eval`/`new Function`, and Vite's production build should be configured without inline script injection (Vite's default output is CSP-friendly out of the box; avoid adding inline event handlers or `dangerouslySetInnerHTML` with unsanitized content). Any third-party script (analytics, error reporting) must be added to the CSP allowlist explicitly, not silently.

## What the Frontend Deliberately Does Not Do

- Does not store or trust a decoded JWT's claims for authorization decisions beyond display purposes (e.g. showing a name) — permissions and role checks always reflect what `/auth/me` or the login response returns, not a client-side JWT decode, since the backend is the only source of truth and tokens can expire between decode and use.
- Does not implement its own crypto, token generation, or MFA secret handling — all of that is backend-only; the frontend is a thin, faithful client of the Identity API.
