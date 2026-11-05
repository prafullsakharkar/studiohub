/**
 * The kit's two colour roles for controls (docs/frontend/DESIGN_SYSTEM.md §1), as class strings, so every selected
 * item and every primary action looks the same wherever it is drawn.
 */

/**
 * A selected item: a tab, a segment, the current page, a chosen row. The sidebar's active item draws the same.
 * The outline is an inset ring, so a selected item is exactly the size of an unselected one.
 */
export const SELECTED =
  'bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200 font-semibold dark:bg-cyan-950/40 dark:text-cyan-300 dark:ring-cyan-500/30';

/** A selected underline tab (the underline is the tab's own `border-b-2`). */
export const SELECTED_UNDERLINE = 'border-cyan-400 text-cyan-700 font-semibold dark:text-cyan-300';

/** The fill of the one primary action of a view: `Button` `primary`, and the few links drawn as that button. */
export const PRIMARY_FILL =
  'accent-gradient-primary text-white shadow-md shadow-cyan-500/20 border border-white/20';
