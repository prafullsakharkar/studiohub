# StudioHub Testing Architecture & Verification Protocols

## 1. Testing Strategy

StudioHub employs a multi-tiered validation architecture ensuring complete end-to-end integrity across all production workflows, DRF API contracts, and security boundaries.

```
┌────────────────────────────────────────────────────────────┐
│ 1. Interactive Diagnostic Suite (`/testing`)              │
│    - In-browser real-time execution engine                 │
│    - Live MSW request/response inspection                  │
│    - HTTP error code simulator (400, 401, 403, 404, 429,   │
│      500, 502, 503, Offline)                               │
├────────────────────────────────────────────────────────────┤
│ 2. Automated Test Suites (TestRunnerEngine)                │
│    - Suite 1: Full CRUD Lifecycle for Projects, Shots,     │
│      Tasks, and Entities                                   │
│    - Suite 2: Relationship Graph & Hierarchy Integrity     │
│    - Suite 3: Multi-Tenant Scoping & Header Isolation      │
│    - Suite 4: RBAC Permissions & Supervisor Gating         │
│    - Suite 5: DRF Search, Filters, Sorting & Pagination    │
│    - Suite 6: Error Trapping & Field Validation Mapping    │
│    - Suite 7: 11-Step Critical Production E2E Navigation   │
├────────────────────────────────────────────────────────────┤
│ 3. Build & Static Analysis Checks                          │
│    - TypeScript `tsc --noEmit` strict type checking        │
│    - Production bundle compilation via Vite & esbuild      │
└────────────────────────────────────────────────────────────┘
```

---

## 2. Test Suites Detailed Breakdown

### Suite 1: CRUD Operations
- **Project Lifecycle**: Validates creation with custom codes, retrieval by ID, patch updates for budget/status, and deletion.
- **Shot Lifecycle**: Validates sequence association, cut frame ranges (`1001-1120`), and status transitions.
- **Task Lifecycle**: Validates artist assignment, bid tracking, and progress percentage updates.

### Suite 2: Relationships & Hierarchy
- **Project Hierarchy**: Queries all shots and 3D assets linked to project `proj-001`.
- **Department Allocation**: Queries crew member distribution across departments and squads.

### Suite 3: Multi-Tenant Organization Scoping
- **Tenant Header**: Sends requests with distinct `X-Organization-Id` headers and verifies that data sets for Apex Studio (`org-apex-01`) and Vanguard VFX (`org-vanguard-02`) remain strictly isolated without cross-tenant leakage.

### Suite 4: RBAC & Permissions Enforcement
- **Role Gating**: Verifies that destructive actions (project deletion, client removal) are restricted to Supervisor / Admin roles, while artists are restricted to task updates and version publishing.

### Suite 5: Search, Filter, Sort & DRF Pagination
- **Multi-Field Global Search**: Tests fuzzy query matching across code, name, and notes.
- **DRF Pagination Contract**: Verifies that `{ count, next, previous, results }` contract is maintained across all entity list endpoints.

### Suite 6: Error Handling & HTTP Status Simulation
- **Validation 400**: Confirms field-level error mapping to `<FormFieldError />`.
- **404 Not Found**: Confirms graceful 404 trapping.
- **Network / Offline**: Confirms status 0 offline mapping and timeout resiliency.

### Suite 7: Critical 11-Step E2E Production Workflow
Validates the complete non-linear production journey while preserving workspace filter state and deep context:
1. Authenticate session as Supervisor
2. Switch Organization to Apex Studio
3. Open Client Studio Profile
4. Navigate to Project Show (NK99)
5. Inspect Outsourcing Vendor Partner
6. Inspect Vendor Technical Lead
7. Return to Project with active workspace preserved
8. Select Shot in Sequencer
9. Open Task in Inspector Drawer
10. Open Artist Profile in Quick Peek
11. Return to Shot with original frame range and sequencer scroll intact.
