# StudioHub Responsive Design & Density Guidelines

## 1. Multi-Display & Viewport Strategy
StudioHub is designed for professional VFX production environments ranging from ultra-wide dual 4K editing monitors to mobile on-set supervisor tablets.

---

## 2. Breakpoint Matrix

| Breakpoint | Dimensions | Target Device / Setup | Layout Adaptations |
|:---|:---|:---|:---|
| **Mobile (`< 640px`)** | `375px - 639px` | On-Set Smartphones | Sidebar converts to slide-out sheet; tables switch to compact stacked card view; bottom action bar. |
| **Tablet (`640px - 1023px`)** | `640px - 1023px` | Production Coordinator iPads | Collapsible sidebar; 2-column bento grids; sticky table headers. |
| **Desktop (`1024px - 1439px`)**| `1024px - 1439px`| Standard Studio Workstations | Full sidebar; multi-column data grids; flyout inspector drawers. |
| **Ultra-Wide (`≥ 1440px`)** | `1440px - 3840px`| Dual-Monitor / Dailies Suites | Multi-pane split views (Sequencer Grid + Video Player + Metadata Drawer side-by-side simultaneously). |

---

## 3. High-Density UX Rules
1. **Vertical Space Optimization**: Table header padding is capped at `py-2.5`, row height at `44px` to display 18+ shots above the fold on a 1080p display.
2. **Text Truncation & Tooltips**: Critical codes (`NK_010_010`) are preserved without truncation; descriptions and long file paths use CSS `truncate` with instant tooltip preview on hover.
3. **Touch Targets**: All clickable action buttons maintain at least `44x44px` touch hit area on mobile/tablet devices.
