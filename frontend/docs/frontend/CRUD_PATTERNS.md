# StudioHub Unified CRUD & Mutation Patterns

## 1. Clean Architecture Repository Pattern
All server interactions strictly follow the **Clean Architecture Repository Pattern**, decoupling React components from HTTP details.

```
React Component / Page View
         ↓
TanStack Query Hook (`useOrganizationMutations`, `useProjectMutations`)
         ↓
Domain Service (`organizationService`, `productionService`)
         ↓
Domain Repository (`organizationRepository`, `projectRepository`)
         ↓
Typed ApiClient (`ky` with JWT & X-Organization-Id interceptors)
         ↓
Django REST Framework API / MSW Handlers
```

---

## 2. Standardized Mutation Lifecycle

1. **Optimistic Updates**: Immediate UI feedback on user action (e.g. status badge change, task progress update).
2. **Server Confirmation**: Background HTTP request using `POST`, `PATCH`, or `DELETE`.
3. **Rollback on Failure**: Automatic query cache rollback and user error notification if the API returns non-2xx.
4. **Cache Invalidation**: Target query key invalidation (`['projects']`, `['shots']`, `['clients']`, etc.) ensures cross-view freshness.
5. **Toast & Activity Dispatch**: Global toast notification dispatched via `useNotificationStore`.

---

## 3. Form Validation & Server Error Handling
- **Client Validation**: Quick synchronous checks for mandatory fields and format requirements before dispatch.
- **Server Validation (<FormFieldError />)**: When DRF returns `400 Bad Request` with structured field errors (`{ "code": ["Already in use"] }`), errors are automatically mapped to input fields using the `<FormFieldError error={err} field="code" />` component.
