# Client Portal Security & Review Isolation

The Client Portal provides a high-security, compartmentalized review environment for studio executives, distributors, and external clients.

---

## 1. Client Visibility Rules

1. **Client Isolation Barrier**: A client user only has access to projects where their `client_id` is linked.
2. **Explicit Client Flagging (`is_client_visible: true`)**:
   - Versions and reviews in `Internal Review`, `WIP`, or `Supervisor Pending` states are completely invisible to clients.
   - Only media explicitly published or promoted to `Client Review` / `Client Approved` with `is_client_visible: true` are returned by the API.
3. **Role Mutation Boundaries**:
   - **Client Producer / Reviewer**: Can post review comments and trigger `approve_client` or `reject_client` workflow transitions.
   - **Client Viewer**: Strictly read-only streaming; all mutation endpoints (`POST`, `PATCH`, `DELETE`) return `403 Forbidden`.
4. **Internal Asset Concealment**:
   - Internal task breakdowns, raw asset scene files, internal crew assignments, and budget calculations are never exposed in the client portal.
