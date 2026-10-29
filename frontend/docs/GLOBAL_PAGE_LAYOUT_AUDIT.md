# StudioHub — Global Page Layout Control & Canonical Layout System Audit

*Generated: 2026-09-10*

---

## 1. Executive Summary

This audit fulfills **Section 1 (Audit Before Changing)** of the StudioHub Global Page Layout Control refactor specification.

Currently, layout configuration and view modes are fragmented across individual pages, workspace tabs, and settings pages:
- **Global Toolbar (`src/layouts/Header.tsx`)**: Lacks a canonical Page Layout button.
- **Scattered Density Controls**: `LayoutDensityControl` is mounted only on `SettingsPage`, `RolesSecurityPage`, and `AccessWorkspacePage`.
- **Duplicate View Mode Selectors**: At least 12 distinct pages and tabs implement ad-hoc, localized view toggles (`grid`, `table`, `board`, `timeline`, `calendar`, `hierarchy`, `gallery`, `filmstrip`, `compare`, `tabular`, `cards`).
- **Disconnected Tables & Workspaces**: `TableView` and `DataTable` use hardcoded cell paddings (`py-2.5 px-3`) rather than adapting to the user's selected layout density (`compact`, `comfortable`, `spacious`).
- **Ephemeral State**: Most pages store view mode in local React `useState`, losing user preferences on navigation.

---

## 2. Comprehensive Inventory of Layout & View Controls

### A. Global Toolbar & Header Layout
| Component | Location | Current State | Refactor Target |
|---|---|---|---|
| **Global Application Toolbar** | `src/layouts/Header.tsx` | Contains Project Switcher, Org Switcher, Search (⌘K), DB Inspector, Theme Toggle, Notifications, User Menu. **Missing Global Page Layout button**. | Add **Canonical Page Layout Button** to toolbar with popover menu for Density, Container Width, View Mode, Header Sticky, and Reset. |
| **Global Page Layout Store** | `src/core/layout/usePageLayoutStore.ts` | Manages `density` (`compact` \| `comfortable` \| `spacious`), `containerWidth` (`full` \| `contained`), `headerSticky` (boolean). Key: `studio_page_layout_default`. | Extend store to serve as single source of truth for canonical layout, active view modes, and table density styling. |

---

### B. Scattered Layout & Density Controls
| Component / Control | Location | Current Usage | Action Required |
|---|---|---|---|
| `LayoutDensityControl` | `src/shared/layouts/LayoutDensityControl.tsx` | Dropdown with Spacing Density (Compact/Comfortable/Spacious), Container Width (Full/Contained), Reset. | Promote to canonical component exported via `@/components`. Mount in `Header.tsx` as the single authoritative global control. |
| Settings Density Call | `src/modules/settings/pages/SettingsPage.tsx:156` | `<LayoutDensityControl />` in page header actions. | Consolidate: Keep settings section for deep configuration; remove redundant header button if preferred or delegate to canonical store. |
| Roles & Security Density Call | `src/modules/settings/pages/RolesSecurityPage.tsx:63` | `<LayoutDensityControl />` in page header actions. | Remove duplicate local header button in favor of global toolbar control. |
| Access Workspace Density Call | `src/modules/access/pages/AccessWorkspacePage.tsx:126` | `<LayoutDensityControl />` in page header actions. | Remove duplicate local header button in favor of global toolbar control. |
| Layout Settings Section | `src/modules/settings/components/LayoutSettingsSection.tsx` | Full-page settings panel for density, width, sticky header, persistence. | Keep as detailed settings inspector consuming `usePageLayoutStore`. |

---

### C. Disparate View / Layout Selectors Across Pages & Workspaces

| Page / Component | File Path | View Modes Implemented | Current Implementation | Proposed Consolidation |
|---|---|---|---|---|
| **Tasks Page** | `src/modules/tasks/pages/TasksPage.tsx:234-275` | `table` \| `board` \| `calendar` \| `timeline` | Local `useState<TaskViewMode>` + 4 buttons in header | Consume canonical layout store / global view preference |
| **Assets Page** | `src/modules/assets/pages/AssetsPage.tsx:207-252` | `grid` \| `table` \| `gallery` \| `hierarchy` | Local `useState` + 4 icon buttons in header | Consume canonical layout store / global view preference |
| **Shots Page** | `src/modules/shots/pages/ShotsPage.tsx:448-484` | `grid` \| `table` \| `filmstrip` | Local `useState` + 3 buttons in filter toolbar | Consume canonical layout store / global view preference |
| **Publishing Page** | `src/modules/publishing/pages/PublishingPage.tsx:278-293` | `grid` \| `table` | Local `useState` + 2 icon buttons in filter bar | Consume canonical layout store / global view preference |
| **Deliveries Page** | `src/modules/deliveries/pages/DeliveriesPage.tsx:248-263` | `grid` \| `table` | Local `useState` + 2 icon buttons in filter bar | Consume canonical layout store / global view preference |
| **Project Tasks Tab** | `src/modules/production/components/project-tabs/ProjectTasksTab.tsx:277-296` | `board` \| `table` | Local `useState` + 2 icon buttons in tab toolbar | Synchronize with global view preference |
| **Project Shots Tab** | `src/modules/production/components/project-tabs/ProjectShotsTab.tsx:257-276` | `grid` \| `table` | Local `useState` + 2 icon buttons in tab toolbar | Synchronize with global view preference |
| **Project Assets Tab** | `src/modules/production/components/project-tabs/ProjectAssetsTab.tsx:251-270` | `grid` \| `table` | Local `useState` + 2 icon buttons in tab toolbar | Synchronize with global view preference |
| **People Page** | `src/modules/organization/pages/PeoplePage.tsx:206-223` | `cards` \| `table` | Local `useState` + 2 text buttons in filter bar | Synchronize with global view preference |
| **Organizations Page** | `src/modules/organization/pages/OrganizationsPage.tsx:342-363` | `grid` \| `table` | Local `useState` + 2 icon buttons in search bar | Synchronize with global view preference |
| **Audit Logs Page** | `src/modules/audit/pages/AuditLogsPage.tsx:155-178` | `timeline` \| `tabular` | Local `useState` + 2 tab buttons | Synchronize with global view preference |
| **Versions List Page** | `src/modules/versions/pages/VersionsListPage.tsx:268-295` | `grid` \| `table` \| `compare` | Local `useState` + 3 icon buttons in toolbar | Synchronize with global view preference |
| **Asset Dependencies** | `src/modules/assets/components/AssetDependenciesTab.tsx:98-115` | `hierarchy` \| `graph` | Local `useState` + 2 tab buttons | Contextual tab view (specialized) |
| **Saved Views Bar** | `src/shared/views/SavedViewsBar.tsx:278-298` | `table` \| `grid` \| `board` \| `timeline` \| `calendar` \| `hierarchy` \| `gallery` | 7 icon buttons in saved views strip | Synchronize with canonical layout store |
| **Production View** | `src/shared/views/ProductionView.tsx:73` | All 7 `DataViewMode` variants | Coordinates view rendering via `SavedViewsBar` | Standard template for canonical views |

---

### D. Table Layout & Density Integration
| Component | File Path | Current State | Refactor Target |
|---|---|---|---|
| **TableView** | `src/shared/views/views/TableView.tsx` | Fixed header `py-3 px-3` and row `py-2.5 px-3` cells. No layout store awareness. | Read `usePageLayoutStore.density` to apply dynamic padding: Compact (`py-1.5 px-2.5`), Comfortable (`py-2.5 px-3`), Spacious (`py-3.5 px-4`). |
| **DataTable** | `src/components/data/DataTable.tsx` | Configuration-driven wrapper around `TableView`. | Pass through or inherit density from layout store. |
| **FilterBar** | `src/components/data/FilterBar.tsx` | Displays view mode toggle if `viewMode` and `onViewModeChange` are supplied. | Can connect to canonical layout store for unified view switching. |
| **PageLayout.Body** | `src/shared/layouts/PageLayout.tsx` | Reads `density` from `usePageLayoutStore` to apply `bodyCompact`, `bodyComfortable`, or `bodySpacious`. | Already implements canonical layout density! Serves as gold standard. |

---

### E. Split-View & Panel Layout Controls
| Component | Location | Role | Architecture Alignment |
|---|---|---|---|
| `SplitView` | `src/shared/workspace/SplitView.tsx` | Resizable multi-pane split layout. | Aligns with workspace layout system. |
| `InspectorDrawer` | `src/shared/components/InspectorDrawer.tsx` | Global right-hand inspector panel managed by `useInspectorStore`. Mounted globally in `AppLayout.tsx`. | Respects global chrome hierarchy. |
| `EntityDrawer` | `src/shared/workspace/EntityDrawer.tsx` | Slide-out entity drawer. | Local to workspace context. |
| `PeekPanel` | `src/shared/workspace/PeekPanel.tsx` | Quick peek inspector drawer. | Local to workspace context. |
| `Sidebar` | `src/layouts/Sidebar.tsx` | Left rail navigation controlled by `useSidebarStore`. | Managed globally; responsive to mobile toggles. |

---

## 3. Architecture of the Canonical Global Page Layout System

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      Global Application Toolbar                         │
│                    (src/layouts/Header.tsx)                             │
│                                                                         │
│  [Org Switcher] [Project Switcher] ... [Page Layout Button] [Theme] ... │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ User configures density/width/view
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Centralized Layout Store                             │
│              (src/core/layout/usePageLayoutStore.ts)                    │
│                                                                         │
│  • density: 'compact' | 'comfortable' | 'spacious'                      │
│  • containerWidth: 'full' | 'contained'                                 │
│  • headerSticky: boolean                                                │
│  • viewMode: 'table' | 'grid' | 'board' | 'timeline' | 'calendar' ...   │
│  • LocalStorage Persistence: 'studio_page_layout_default'               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Reactive subscription
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Current Page / Workspace                          │
│                                                                         │
│  ┌───────────────────────┐  ┌────────────────────┐  ┌────────────────┐ │
│  │    PageLayout.Body    │  │     TableView      │  │  View Toggles  │ │
│  │   (Spacing & Width)   │  │   (Row Density)    │  │ (Sync to Store)│ │
│  └───────────────────────┘  └────────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Roadmap

1. **Step 1: Enhance `usePageLayoutStore.ts`**:
   - Add global view mode preferences (`activeViewMode`, `setViewMode`).
   - Add helper functions/hooks for table row density classes (`getTableRowDensityClass()`, `getTableHeaderDensityClass()`).
   - Maintain backward compatibility with existing storage keys.

2. **Step 2: Canonical `GlobalPageLayoutButton` in `Header.tsx`**:
   - Create a clean, elegant toolbar button and dropdown in `src/layouts/Header.tsx` (next to Theme Toggle / DB Inspector).
   - Display active density icon & label, container width status, and quick view mode switchers.
   - Allow user to toggle Spacing Density, Container Width, Sticky Header, and Reset.

3. **Step 3: Connect `TableView` & `DataTable` to Centralized Density**:
   - Update `src/shared/views/views/TableView.tsx` so table rows and headers automatically scale based on the centralized `density` state (`compact`, `comfortable`, `spacious`).

4. **Step 4: Consolidate / Synchronize Disparate Page Layout Selectors**:
   - Connect page-level view mode selectors (Tasks, Assets, Shots, Publishing, Deliveries, People, Organizations, Versions) to synchronize with the centralized layout store.
   - Remove redundant local `LayoutDensityControl` buttons from `SettingsPage`, `RolesSecurityPage`, and `AccessWorkspacePage` since the control is now available universally in the global toolbar.

5. **Step 5: Verification & Quality Assurance**:
   - Validate with `compile_applet`.
   - Verify responsive behavior across mobile, laptop, and ultra-wide viewports.
   - Ensure visual fidelity strictly adheres to StudioHub's MUI and Tailwind dark theme.
