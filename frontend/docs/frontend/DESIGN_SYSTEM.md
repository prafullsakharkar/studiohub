# StudioHub Design System

StudioHub is used by artists, coordinators and producers on dense, often multi-display, colour-critical desks. The
interface is dark by default, compact, and keeps colour for meaning.

The rules below are the component kit's (`spikes/mockups/`, the design canvas), the reference for new screens.
Where the code does not follow them yet, the difference is listed in `docs/frontend/component-migration-plan.md`
(on `design/component-kit`) and is being closed one branch at a time; the values given for components (`Button`,
`StatusBadge`, `Modal`) are what the code does.
The shared components themselves are listed in [`CANONICAL_COMPONENTS.md`](CANONICAL_COMPONENTS.md).

## 1. Colour

The theme is Tailwind's slate scale with a cyan → blue accent. The studio's default theme
(`/settings/system/themes`) can replace the accent and the font: `ThemeProvider.applyStudioTheme` sets
`--studio-accent-cyan`, `--studio-accent-blue` and `--studio-font-family`.

| Role | Dark | Light |
|---|---|---|
| Page background | slate-950 | slate-50 |
| Surfaces (cards, panels) | slate-900 | white |
| Borders | slate-800 | slate-200 |
| Text | slate-100, muted slate-400, micro slate-500 | slate-900 |

How colour is used:

- **Cyan** marks what is active or selected: the current tab, the chosen page, a selected row, focus rings. Use
  `SELECTED` / `SELECTED_UNDERLINE` from `shared/utils/kitStyles.ts`.
- **The primary gradient** (`PRIMARY_FILL`, cyan → blue) is the `Button` `primary` variant: the one main
  action of a view. Use it once per view; other actions are `secondary`, `outline` or `ghost`.
- **Indigo** is the brand (the logo tile, the product mark, project codes). It does not mean "selected" or
  "primary action"; a test fails on a solid `bg-indigo-600` outside `layouts/`.
- **Status colours** come only from `StatusBadge` (below); do not colour a status by hand.
- `danger` (rose) and `warning` (amber) buttons are for destructive or risky actions only.

## 2. Type

The font is the studio theme's (`--studio-font-family`), falling back to Tailwind's sans stack. Codes, frame ranges,
versions and timecodes use the mono stack (`font-mono`).

| Size | Use |
|---|---|
| 11px | micro labels, badges, the text of an `xs` button |
| 12px | dense table cells, `sm` buttons, captions |
| 13px | body text in panels, `md` buttons, inputs |
| 16px | section headings |
| 20px | page titles |

## 3. Shape

Radii: 6px (badges, chips; `rounded-md`), 8px (buttons, inputs; `rounded-lg`), 12px (cards, dialogs; `rounded-xl`),
full (avatars, dots, pills).

## 4. Controls

Every control on one row has the same height:

| Height | Where | `Button` size |
|---|---|---|
| 28px | grids, table rows, toolbars, filter bars | `sm` (12px text); `xs` is the same height with 11px text, for actions inside a table row |
| 32px | the default | `md` (13px text) |
| 36px | forms and dialogs | `lg` (14px text) |

`Button` sets the height itself (`h-7` / `h-8` / `h-9`); do not add vertical padding or a height in `className`.
It renders an `id` only when one is passed.

## 5. Status badges (`StatusBadge`)

`shared/components/StatusBadge` is the only place a status gets a colour: a tinted fill, a matching border and a
dot, in both themes. The colour follows what the status means, not which record it belongs to, so "Rejected" looks
the same on a delivery, a review and a leave request. The text is the status as the API sends it (or `label`, e.g.
"Comp: Approved" on a shot's pipeline). Case, `_` and `-` do not matter (`in_progress` is In Progress).

| Tone | Colour | Statuses |
|---|---|---|
| done | emerald | Approved, Completed, Delivered, Active, Enabled, Exported, Registered, Verified, Pass, Success, Available, Resolved, Conformed, Published, Final, Done |
| running | sky | In Progress, Started, Running, Validating, Exporting, In Review, Booked, Scheduled, WIP |
| ready | indigo | Ready, Validated |
| waiting | amber | Pending, Pending Review, Internal Review, Submitted, Queued, Open, On Leave, Postponed, Deprecated |
| failed | rose | Rejected, Retake, Failed, Fail, Revoked, Mismatch, Missing, Overbooked, Blocking |
| held | orange | On Hold |
| idle | slate | Not Started, Draft, Archived, Closed, Inactive, Disabled, Blocked, Cancelled, Expired, Terminated, Unavailable, Muted, Paused, Declared, Not Checked, and any status not listed |
| omitted | zinc | Omitted |
| (stage) | blue / violet / purple / cyan | Bidding / Pre-Production / Signed Off, Supervisor Review / Client Review |

A test (`StatusBadge.test.tsx`) reads every status enum in `openapi.ts` and fails on one that is not listed, so a
new backend status gets a colour on purpose. Tags that are not statuses (Default, System, Primary, a type, a count)
use `Badge`.

`PriorityBadge` (same file) maps Critical (rose), Urgent (orange), High (amber), Medium (blue) and Low (slate).

## 6. Tables

- Sticky headers, fixed column widths, row hover.
- Dense rows (`py-2 px-3`), about 20 rows on a 1080p screen.
- Row actions are `xs` or `sm` buttons, or icon buttons of the same height.

## 7. Dialogs and drawers

- Dialogs use `Modal` (`shared/components/Modal`): centred, a `slate-950/80` backdrop with blur, 12px corners, a
  name, Escape to close, focus trapped and returned. Do not draw a `fixed inset-0` overlay by hand.
- Inspector drawers slide from the right (`w-[480px]` or `w-[600px]`).
