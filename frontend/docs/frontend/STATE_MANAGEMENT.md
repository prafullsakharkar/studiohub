# StudioHub State Management Architecture

## 1. State Tiering Strategy

StudioHub separates state across 4 distinct architectural tiers to prevent re-render cascades and state desynchronization:

```
┌────────────────────────────────────────────────────────────┐
│ 1. Server State (TanStack Query v5)                        │
│    - Remote database entity caches                         │
│    - Pagination, filtering & search caches                 │
│    - Optimistic mutations & cache invalidation             │
├────────────────────────────────────────────────────────────┤
│ 2. Context State (React Context)                           │
│    - AuthContext (JWT tokens, user credentials, active     │
│      role & persona)                                       │
├────────────────────────────────────────────────────────────┤
│ 3. Global UI State (Zustand Stores)                        │
│    - Sidebar collapse & navigation status                  │
│    - Notification center & toasts                          │
│    - Inspector drawer active entity                        │
│    - Command palette open/closed state                     │
├────────────────────────────────────────────────────────────┤
│ 4. Local Component State (React Hooks)                     │
│    - Active form inputs, modals, video scrub positions     │
│    - Column width resizers & temporary table sort orders   │
└────────────────────────────────────────────────────────────┘
```

---

## 2. TanStack Query Cache Key Conventions

Query keys follow a structured hierarchical tuple format (org-free — no tenant prefix):
- `['clients', { search }]`: Client query
- `['vendors', { specialization }]`: Vendor query
- `['people', { departmentId }]`: Talent query
- `['projects', { status }]`: Projects query
- `['projects', projectId]`: Project workspace data (membership-scoped)
- `['shots', { projectId, sequence }]`: Shots list query
- `['tasks', { entityId, entityType }]`: Tasks query
- `['versions', { entityCode }]`: Published versions query
- `['reviews', { projectId }]`: Review sessions query

---

## 3. Cache Invalidation Patterns
Mutations target exact query invalidation keys:
```typescript
// Example: Creating a new Shot
onSuccess: (newShot) => {
  queryClient.invalidateQueries({ queryKey: ['shots'] });
  queryClient.invalidateQueries({ queryKey: ['projects', newShot.project_id] });
  queryClient.setQueryData(['shots', newShot.id], newShot);
}
```
