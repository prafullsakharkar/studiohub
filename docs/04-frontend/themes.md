# Themes

Theming is built on **MUI's theme system** (`@mui/material`, `@emotion/react`/`styled`), not Tailwind — `@tailwindcss/vite` is present in `package.json` but is scoped to layout utilities only (spacing/flex/grid), while colors, typography, and component variants are owned entirely by the MUI theme object. Mixing "who owns color" between Tailwind and MUI is the most common source of drift in a stack like this, so the rule is explicit: **MUI owns design tokens, Tailwind owns layout utilities.**

## Design Tokens as a Theme Object

```ts
// src/styles/theme.ts
import { createTheme } from "@mui/material/styles";

const tokens = {
  light: {
    primary: { main: "#2563EB" },
    background: { default: "#F8FAFC", paper: "#FFFFFF" },
    text: { primary: "#0F172A", secondary: "#64748B" },
    divider: "#E2E8F0",
  },
  dark: {
    primary: { main: "#3B82F6" },
    background: { default: "#0F172A", paper: "#1E293B" },
    text: { primary: "#F1F5F9", secondary: "#94A3B8" },
    divider: "#334155",
  },
};

export function buildTheme(mode: "light" | "dark", direction: "ltr" | "rtl") {
  return createTheme({
    direction,
    palette: { mode, ...tokens[mode] },
    typography: {
      fontFamily: '"Inter", "Roboto", system-ui, sans-serif',
    },
    shape: { borderRadius: 8 },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiTextField: { defaultProps: { size: "small" } },
    },
  });
}
```

## RTL Support

`stylis-plugin-rtl` and `@popperjs/core`/`react-popper` in `package.json`, combined with `i18next`/`react-i18next`, indicate this app needs to support right-to-left locales. This requires **two** coordinated pieces, not just the MUI `direction` prop:

1. **MUI theme direction** — `createTheme({ direction: "rtl" })`, as above.
2. **Emotion's RTL cache** — MUI's `direction` prop alone does not flip CSS; Emotion needs the `stylis-plugin-rtl` cache to actually transform the generated styles:

```tsx
// src/app/providers.tsx
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import rtlPlugin from "stylis-plugin-rtl";
import { prefixer } from "stylis";

const rtlCache = createCache({ key: "muirtl", stylisPlugins: [prefixer, rtlPlugin] });
const ltrCache = createCache({ key: "mui" });

export function AppProviders({ children }: { children: React.ReactNode }) {
  const direction = useUiStore((s) => s.direction);
  const theme = useMemo(() => buildTheme(useUiStore.getState().theme, direction), [direction]);

  return (
    <CacheProvider value={direction === "rtl" ? rtlCache : ltrCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
```

3. `document.documentElement.dir` is also set to match (`"rtl"`/`"ltr"`) for native browser behavior (scrollbars, form controls) that CSS alone doesn't cover.

Direction is driven by the active `i18next` locale (e.g. Arabic/Hebrew → `rtl`), not a manual user toggle — set it once when the locale changes, in the same place `i18next`'s `languageChanged` event is handled.

## Dark Mode

Theme mode (`light`/`dark`/`system`) lives in `useUiStore` (Zustand, persisted — see `state-management.md`), resolved against `prefers-color-scheme` when set to `system`, and applied by rebuilding the MUI theme object (as in `buildTheme` above) rather than CSS variables — this keeps the theme fully typed and lets MUI's own components (which read `theme.palette.*` internally) stay consistent without a separate CSS-variable bridge.

To avoid a flash of the wrong theme on load, resolve and apply the theme mode from persisted storage before first paint (a small inline check in `index.html`, or resolving it synchronously in `AppProviders` before the first render — not in a `useEffect`, which would paint once with the wrong theme first).

## Component Variant Consistency

Rather than styling MUI components ad hoc per usage, shared variants are registered once via `components.MuiX.defaultProps`/`styleOverrides` in the theme object (as shown for `MuiButton`/`MuiTextField` above). A module component reaches for `<Button variant="contained">`, not a one-off `sx` prop reinventing spacing/color — `sx` is reserved for genuine one-off layout tweaks, not for redefining a component's look.

## Density

MUI's `size="small"` default (set globally above) keeps the UI dense and data-forward, appropriate for a production-tracking tool where users are scanning tables/lists most of the day — consistent with Material React Table's density toggle in `tables.md`, which lets individual users loosen it back up if they prefer.
