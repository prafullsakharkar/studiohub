# StudioHub Workspace Architecture

## 1. Concept: Non-Linear VFX Production Workspace
StudioHub rejects the paradigm of isolated, siloed CRUD pages. Instead, it implements a **unified, non-linear multi-view workspace** designed for high-density visual effects operations.

---

## 2. Core Workspace Capabilities

### 2.1 Workspace Topography & Context Retention
1. **Master Context Bar (Top HUD)**:
   - Displays active Studio Tenant, active Production Show (`NK99`), Global Search, Quick Personas, and System Diagnostics.
   - Preserves view filters (e.g. sequence filters, department view modes) across screen transitions.
2. **Contextual Navigation (Primary Sidebar)**:
   - Categorized by operational workflows: `Workspace`, `Organization Entities`, `Production Graph`, and `Platform Controls`.
   - Collapsible with keyboard shortcut `[` for maximal viewport real estate.
3. **Inspector Drawer (Right Flyout)**:
   - Deep inspection drawer for any selected entity (`Shot`, `Task`, `Asset`, `Person`, `Vendor`, `Client`).
   - Supports editing, history review, version comparison, and note logging without losing list position or sequencer scroll state.

### 2.2 Split Views & Multi-Pane Workspaces
- **Sequencer Split Grid**: View shot thumbnails on the left pane and shot tasks/versions in the right inspector.
- **Review Cinema Mode**: Side-by-side frame comparison (Wipe/Diff slider) with live synchronized video playback.
- **Workload Heatmap**: Dual-pane view of team member capacity vs project milestone deadlines.

### 2.3 Context Preservation During Navigation
The workspace ensures seamless state preservation during complex non-linear navigation flows:
```
Client Profile
   ↓ (Click Active Project)
Project Overview
   ↓ (Click Sequence)
Shot Sequencer
   ↓ (Click Assignee)
Artist Drawer
   ↓ (Click Team)
Team Capacity View
   ↓ (Browser Back or Breadcrumb)
Exact Shot Sequencer (Maintains Frame In/Out, Search Filter, and Selected Row)
```

---

## 3. Keyboard-First UX & Shortcuts
StudioHub supports full keyboard navigation for fast studio operations:
- `⌘ K` / `Ctrl K`: Open Global Command Palette
- `G P`: Go to Productions
- `G S`: Go to Shots & Sequencer
- `G A`: Go to Assets
- `G T`: Go to Tasks
- `G R`: Go to Reviews & Screening Room
- `G O`: Go to Organizations & Facilities
- `G T S`: Open API & Test Suite
- `[`: Toggle Sidebar Collapse
- `ESC`: Close active Drawer / Modal / Palette
- `J` / `K`: Navigate records up/down in active table
- `Space`: Quick-play video preview or open entity Quick Peek
