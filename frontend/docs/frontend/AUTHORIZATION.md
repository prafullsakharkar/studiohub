# Enterprise Authorization Engine Specification

StudioHub's Authorization Engine provides unified decision logic across frontend routing, UI component gating, resource-level actions, workflow state transitions, field-level data masking, and API gateway requests.

---

## 1. Decision Flow Pipeline

```text
Request (Action + Resource + Context)
  │
  ▼
1. Is User Authenticated? ──(No)──► HTTP 401 Unauthorized
  │ (Yes)
  ▼
2. Platform Superuser / Global Admin? ──(Yes)──► ALLOW (Global Access)
  │ (No)
  ▼
3. Project Context Check (if applicable):
   - Is User a Member of the Project? ──(No)──► HTTP 403 Forbidden (no data leak)
  │ (Yes)
  ▼
4. Role & Permission Evaluation:
   - Does User possess `<resource>.<action>`? ──(No)──► DENY (Missing Permission)
  │ (Yes)
  ▼
5. Scope Engine Boundary Check:
   - Is Resource Entity within User Scope (`GLOBAL`, `PROJECT`, `DEPT`, `VENDOR`, `CLIENT`, `ASSIGNED`)?
   ──(No)──► DENY (Out of Scope Boundary)
  │ (Yes)
  ▼
6. Workflow State Transition Rules (if status change):
   - Is transition from `currentStatus` to `targetStatus` permitted for this role?
   ──(No)──► DENY (Invalid Workflow Step)
  │ (Yes)
  ▼
7. Field-Level Masking & Response Sanitization:
   - Mask internal bids, day rates, security credentials, internal notes.
  │
  ▼
ALLOW (Authorized Payload)
```

---

## 2. API Authorization Helper (`authorizeApiRequest`)

All API interactions pass through `authorizeApiRequest`:

```typescript
const decision = authorizeApiRequest(user, {
  action: 'approve',
  resourceType: 'shot',
  entity: targetShot,
  projectId: 'proj-001',
});

if (!decision.ok) {
  return HttpResponse.json({ detail: decision.message }, { status: decision.status });
}
```

---

## 3. UI Decision Affordances

- `<Can action="shot.approve" entity={shot}>`: Conditionally renders actionable controls.
- `<HasPermission permission="project.create">`: Protects route buttons and modal triggers.
- `<ProtectedComponent>`: Wraps higher-order pages with fallback screens for `403` and `404` errors.
- `usePermissions()`: React hook exposing granular evaluator methods and current role metadata.
