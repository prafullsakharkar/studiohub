# Components

## Three Tiers

We organize components into three tiers, matching where they live in `project-structure.md`. Unlike a from-scratch design system, **tier 1 here is MUI itself** — we don't rebuild Button/Input/Select on top of MUI, we configure MUI's defaults once in the theme (`themes.md`) and use its components directly.

1. **MUI primitives** (`@mui/material`, used directly) — `Button`, `TextField`, `Select`, `Checkbox`, `Dialog`, `Tooltip`, `Chip`. Styled via the theme object's `components` overrides, not per-usage `sx` overrides for anything that should be consistent app-wide.
2. **Composite shared components** (`shared/components/`) — `PageHeader`, `EmptyState`, `ConfirmDialog`, `StatusChip`, form field wrappers (`RHFTextField`, `RHFSelect` bridging React Hook Form to MUI inputs), `ShotsTable`-style table shells. Built from MUI primitives, still domain-agnostic.
3. **Module components** (`modules/<module>/components/`) — domain-aware components like `DepartmentForm`, `ShotsTable`, `ReviewNoteCard`. These compose tiers 1 and 2 and are the only tier allowed to know about business concepts.

A component should never "skip down" — a module component shouldn't reimplement what a shared composite already provides, and a shared composite shouldn't hardcode one-off colors/spacing that belong in the theme.

## Conventions

- **Function components + hooks only.** No class components.
- **Props typed explicitly**, no `React.FC` (it adds an implicit `children` and complicates generics). Prefer:
  ```tsx
  interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    isLoading?: boolean;
  }

  export function Button({ variant = "primary", isLoading, children, ...rest }: ButtonProps) {
    /* ... */
  }
  ```
- **Composition over configuration.** Prefer children/slots over an ever-growing prop list. A `Modal` takes `<Modal.Header>`/`<Modal.Body>`/`<Modal.Footer>` children rather than `headerText`/`bodyText` string props.
- **Colocation.** A component's test, styles (if any beyond Tailwind classes), and Storybook story (if present) live next to it, not in parallel folders.
- **No prop drilling past two levels.** If a value needs to pass through more than two component layers, it belongs in context, a store, or the value should be composed via children instead.

## State Inside Components

- Presentational/dumb components receive data and callbacks via props and hold no server state.
- "Container" components (typically the `pages/` level) own the React Query hooks and pass resolved data down. This keeps primitives and composites trivially testable with static props.

## Accessibility

- MUI's components ship with solid accessibility defaults (focus trapping in `Dialog`, correct ARIA roles in `Select`/`Autocomplete`, keyboard navigation) — we rely on these rather than reimplementing them, and avoid replacing MUI primitives with raw `<div>`-based custom controls that would lose this for free.
- Every form field has an associated `<label>` (via the shared RHF-bridging field wrappers in `forms.md`, using MUI's `TextField`/`FormControl` labeling).
- Custom composites (e.g. `ConfirmDialog` built on MUI's `Dialog`) inherit MUI's focus-trap/restore behavior rather than reimplementing it — verify this isn't accidentally broken when wrapping a MUI primitive.

## Testing

Components are tested with React Testing Library, asserting on behavior/accessibility roles rather than implementation details (`getByRole`, `getByLabelText` over `getByTestId` where possible). Module components mock their API/hook layer; primitives are tested in isolation with plain props.

## Storybook (optional, module-by-module adoption)

Primitives and shared composites are the priority for Storybook coverage, since they define the design system contract. Module components are added to Storybook opportunistically, mainly for complex ones (e.g. multi-step forms, rich cards).
