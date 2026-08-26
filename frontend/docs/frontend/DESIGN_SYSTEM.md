# StudioHub VFX Design System & UI Specifications

## 1. Design Philosophy
StudioHub is designed for professional VFX artists, technical directors, and production managers who work in color-critical, high-density, multi-display studio environments.

---

## 2. Color Palette & Theming

### 2.1 Dark / High-Density Theme (Default)
- **Backgrounds**: Slate-950 (`#020617`), Slate-900 (`#0f172a`), Slate-800 (`#1e293b`)
- **Borders & Dividers**: Slate-800 (`#1e293b`), Slate-700/50 (`rgba(51, 65, 85, 0.5)`)
- **Typography**:
  - Primary Text: Slate-100 / White (`#f8fafc`)
  - Muted Text: Slate-400 (`#94a3b8`)
  - Micro Text: Slate-500 (`#64748b`)
- **Accents**:
  - Indigo / Blurple (`#6366f1`): Active selection, primary CTA
  - Emerald (`#10b981`): Approved, Delivered, Online, Greenlight
  - Amber (`#f59e0b`): In Progress, Pending Review, Farm Warning
  - Rose (`#f43f5e`): Retake, Omitted, High Severity, Error
  - Cyan (`#06b6d4`): OpenUSD Asset, USD Stage Layer, Technical Specs

---

## 3. Typography & Mathematical Scale
- **Display & Headings**: Inter / Plus Jakarta Sans font pairing with Major Second (1.125) ratio for dense UI control.
- **Monospace Elements**: JetBrains Mono / SF Mono for frame numbers (`1001-1120`), version codes (`v004`), color space tags (`ACEScg`), and timecodes (`01:14:22:18`).
- **Baseline Readability**: Minimum font size 12px for dense data cells, 14px for body text, 16px-24px for headings.

---

## 4. Component Standards

### 4.1 Status Badges (`<StatusBadge />`)
Standardized visual tokens for all production lifecycle states:
- `Approved` → Emerald filled badge with checkmark icon
- `In Progress` → Amber filled badge with clock/pulse
- `Pending Review` → Indigo filled badge
- `Ready to Start` → Sky blue badge
- `Retake / Hold` → Rose badge with alert icon

### 4.2 Data Grids & Tables
- Sticky headers with fixed column widths.
- Row-level hover states with keyboard up/down selection.
- Dense padding (`py-2 px-3`) allowing 20+ rows per 1080p screen.
- Inline status pickers and assignee avatars.

### 4.3 Modal & Drawer Standards
- Modals centered with backdrop blur (`backdrop-blur-sm bg-black/60`).
- Inspector Drawers slide from the right (`w-[480px]` or `w-[600px]`).
- All drawers and modals respond to `ESC` and trap keyboard focus.
