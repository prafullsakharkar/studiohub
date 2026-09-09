# StudioHub Navigation & Routing Architecture

## 1. Routing Model
StudioHub uses React Router v6 configured for declarative route definitions, hierarchical authentication guards, role-based route gates, and persistent layouts.

---

## 2. Complete Route Map

| Route Path | Module | Access Level | Description |
|:---|:---|:---|:---|
| `/` | Dashboard | Protected | Global studio production overview & metrics |
| `/login` | Auth | Public / Guest | Studio user credentials login |
| `/forgot-password` | Auth | Public / Guest | Password reset recovery request |
| `/reset-password` | Auth | Public / Guest | Token-authenticated password reset |
| `/organizations` | Organization | Protected (`org:read`) | Studio tenant organizations list & detail |
| `/clients` | Organization | Protected (`client:read`) | Commissioning client studios & active shows |
| `/vendors` | Organization | Protected (`vendor:read`) | Outsourcing VFX vendor partners & security tiers |
| `/people` | Organization | Protected (`people:read`) | Global talent directory, seniority & skillsets |
| `/departments` | Organization | Protected (`dept:read`) | Discipline departments & weekly capacity |
| `/teams` | Organization | Protected (`team:read`) | Production squads & lead allocations |
| `/offices` | Organization | Protected (`office:read`) | Facility hubs, workstations & local timezones |
| `/productions` | Production | Protected (`project:read`) | Master projects & productions list |
| `/projects/:id` | Production | Protected (`project:read`) | Project dashboard, sequences & statistics |
| `/shots` | Production | Protected (`shot:read`) | Shot sequencer grid & cut frame tracker |
| `/assets` | Production | Protected (`asset:read`) | 3D OpenUSD asset catalog & stage layers |
| `/tasks` | Production | Protected (`task:read`) | Discipline task board, bids & assignee tracking |
| `/versions` | Production | Protected (`version:read`) | Published comps, renders, and USD stages |
| `/reviews` | Production | Protected (`review:read`) | Screening room & dailies playback suite |
| `/analytics` | Platform | Protected (`analytics:read`)| Production throughput, burn-down & milestones |
| `/billing` | Platform | Protected (`billing:admin`)| Compute farm hours, storage quota & tier invoices |
| `/settings` | Platform | Protected (`settings:manage`)| Pipeline settings, ACEScg, frame rates & SSO |
| `/audit` | Platform | Protected (`audit:read`) | Studio activity log & security compliance trace |
| `/testing` | Platform | Protected (All) | API Diagnostic & Test Suite (MSW & DRF tests) |
| `/401` | Core | Public | Unauthorized session screen |
| `/403` | Core | Public | Forbidden / Insufficient permissions screen |
| `/500` | Core | Public | Server error recovery screen |
| `*` | Core | Public | 404 Not Found error screen |

---

## 3. Deep Linking & URL State Serialization
StudioHub synchronizes view filters and search queries to the browser URL:
- `?project_id=proj-001`: Scopes any production view to a specific show.
- `?department=FX`: Filters tasks and people by discipline.
- `?search=NK_010`: Preserves search query across page refreshes.
- `?page=2&page_size=15`: Standard DRF pagination query parameters.
- `?entity_id=shot-001&drawer=open`: Deep links directly to the opened Inspector Drawer for a shot or task.
