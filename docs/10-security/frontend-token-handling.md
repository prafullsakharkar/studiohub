# What the web client must do with tokens

The API issues bearer tokens in response bodies, so how a browser client stores and sends them decides how
much damage a script-injection bug could do (TPN review TM-020). The client is a separate repository and was
not reviewed; this is the checklist to review it against.

## Server behaviour the client can rely on

- Access tokens last 30 minutes; refresh tokens 7 days and rotate on every use (the previous one is
  rejected afterwards); a session ends 30 days after login whatever the activity, and after 120 minutes
  without an authenticated request (configurable). A client that is idle for longer must sign in again.
- A refresh token that is reused is treated as theft and the session ends.
- While a password change or MFA enrolment is owed, every call except `auth/me` and logout answers `403` with
  `password_change_required` or `mfa_enrollment_required`. Send the user to the matching screen.
- A narrowly scoped API key or token cannot act as the user beyond its scopes; never use one in a browser.

## Client requirements

1. Keep the access token in memory only, not in `localStorage`, `sessionStorage` or a non-HttpOnly cookie.
2. Keep the refresh token out of script-readable storage if at all possible. Preferred: the client's own
   server (a backend-for-frontend) holds it in an `HttpOnly; Secure; SameSite=Strict` cookie and calls the
   refresh endpoint. If it must live in the browser, keep it in memory and accept sign-in after a reload.
3. Serve the client with a Content-Security-Policy that forbids inline script and limits script sources to
   the client's own origin (`script-src 'self'`; no `unsafe-inline`, no `unsafe-eval`), plus `frame-ancestors
   'none'`, `object-src 'none'` and `base-uri 'self'`. This is what limits the damage of an injection bug;
   the API itself serves no documents, so it cannot provide it.
4. Never put tokens in URLs, logs, analytics events or error reports. Strip them from crash reports.
5. Sign out calls the logout endpoint (which ends the server session) and clears everything in memory.
6. Treat `401` as "refresh once, then sign in"; treat `403` with the two codes above as a required step.
7. Download links are signed and last five minutes: use them immediately; do not cache or store them.
8. Escape or sanitise anything rendered as HTML (comments, notes, names). Prefer text rendering.

## Evidence for an assessor

A short review of the client against items 1–8, with the CSP header from the deployed site and a note of
where each token is held, closes the open assumption in the threat register (front-end token storage).
