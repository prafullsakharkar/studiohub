# Phase 28: the studio's default localization and theme are applied: verification

Branch `sync/phase-28-default-theme-locale` (from `develop` at `6abe3961`, the same tree as `main`), **not pushed, not merged**. **No backend file was touched.**

The owner chose it ("Go with your suggestion, Phase 28"). Since Phase 11 the Settings screens could store a theme and a localization and, since Q-22, mark one of each as **the default**, but nothing in the application read it.

**A correction to my own earlier reports.** Phases 20 to 27 listed "applying the chosen theme and locale" as blocked on Q-22 and on `/auth/me` returning `timezone` and `language`. Q-22 had been applied (the `is_default` field, `set-default`, and `GET /themes/default/` and `GET /localizations/default/`), so the studio-wide part was never blocked. Only a per-user language or time zone still needs `/auth/me` (a backend change); it is not part of this phase.

## 1. What the server gives (captured, `samples/settings/_flow.json`)

| Fact | Evidence |
|---|---|
| `GET settings/themes/default/` and `settings/localizations/default/` answer the one default | `themes_default`, `locales_default` (200) |
| An artist, who may not manage settings, may read them | `themes_default_artist`, `locales_default_artist` (200); `set-default` is 403 for the same artist |
| 404 until a default exists | `themes_default_none`, `locales_default_none` ("No theme is the default yet.") |
| The default is always active and cannot be deactivated or deleted | `themes_deactivate_default`, `themes_delete_new_default` (400) |
| Localization fields | `date_format` is one of six (`YYYY-MM-DD`, `DD-MM-YYYY`, `MM-DD-YYYY` and the same with `/`), `time_format` `24H` or `12H`, `number_format` `dot` (1,234.56) or `comma` (1.234,56), `week_start` 0 (Sunday) or 1 (Monday) |
| Theme fields | `theme_type` light, dark or custom; `primary_color`, `secondary_color` (hex); `font_family` sans, serif or mono; the seeded defaults are Studio dark (`#06b6d4`, `#10B981`, sans) and Studio light |

## 2. What it does

`useStudioDefaults()` (`core/locale/StudioDefaults.tsx`) runs in `AppLayout`, so it applies to every signed-in screen. It reads both defaults (5-minute cache, no retry) and holds the page back until both reads have finished (answered, 404, or failed), so a screen renders once with the final formats instead of switching after its first paint.

**Localization** (`core/locale/studioLocale.ts`, one store and five formatters):
- `formatDate` (03/11/2026), `formatTime` (14:07 or 2:07 PM, with midnight 12:05 AM and noon 12:00 PM), `formatDateTime`, `formatNumber` (the studio's separators).
- 23 formatting calls (in 17 files) now use them: record histories, audit rows, review comments and activity, version dates, status history, delivery moments and days, account dates, a team's created date, the soft-delete recovery list, the dashboard's activity time, the export row counts, and the scheduling clock (grid, events, ranges).
- `week_start` decides the first column of the scheduling calendar: the month grid, the week view, the timeline's two weeks, and the headings (`weekOf(day, weekStart)`, `monthGrid(y, m, weekStart)`, both defaulting to Monday).
- Without a default (404), a failed read, or a body that is not a localization (`toStudioLocale` checks the formats), every helper does exactly what it did before: the browser's own formats.

**Theme** (`ThemeProvider.applyStudioTheme`):
- `theme_type` light or dark becomes the starting mode, and `primary_color` / `secondary_color` the two accent colours, **only for someone who has chosen nothing**: what a person picks is kept in their browser and always wins, and a studio default is never written to the browser.
- `font_family`: serif and mono set a font stack on the application root for everyone; sans (the application's own) removes it.

## 3. What it does not do, stated plainly

- **The studio's time zone is not applied.** Times are shown in the browser's zone. The calendar groups and windows days in browser time, so clock times in another zone would put an event in a different column than its day.
- **Theme surface and text colours, radius, spacing and font size are not applied.** The screens use a fixed Tailwind palette and scale (`slate-900`, `rounded-lg`, `text-sm`), not variables; the only variables in use are the two accents and now the font. Applying the rest means redesigning how every screen is styled. The Themes screen still stores them.
- **`custom` themes** do not set the mode (they have no light or dark).
- **Language** has no effect: there is no translation layer. **Currency** is not applied: the money fields are USD by name (`hourly_rate_usd`).
- **Sidebar collapsed / navbar fixed** are not applied (the sidebar has no stored state to default).
- **Long-form day labels** (month and weekday names, the dashboard's "Mon, Nov 3") stay the browser's; so does the API-health page's time with seconds.
- **The login page** is outside it: the defaults are read after sign-in (the routes need a signed-in user).
- **A default changed later** shows after the cache expires (5 minutes) or the next load; components that call the plain helpers refresh when they next render.

## 4. A harness fault found on the way (Vitest 5.0.5)

After the grouped frontend update, a **second live run called the first run's backend** ("Network connection failure", port gone). The backend's port is baked into modules through `define` and changes every run, and vitest 5.0.5 reuses its on-disk transform cache (`node_modules/.vitest-cache`) across runs; I found the old port in that cache. `vitest.live.config.ts` now sets `fsModuleCache: false`. Separately, starting a live run less than about a minute after the previous one fails with "User with this email already exists" because the previous backend has not finished flushing; wait for it, or run one small transactional backend test to flush (already in the notes).

## 5. Evidence

| Check | Result |
|---|---|
| Unit tests | **33 new**: formatters 14 (every date format, 12/24-hour with midnight and noon, number separators, invalid values, the browser fallback, the response check); defaults provider 11 (gating, 404, bad body, server failure, cleared on leaving, both routes asked once, the theme waited for, mode and accents from the theme, a person's own choice kept, custom and non-hex ignored, serif and sans); screen helpers 4; calendar 4 (Sunday-first grid, week, headings, the week asked of the server) |
| Mutations | **28 run, 25 caught at once, 3 survivors**, all fixed by a stronger test and then caught: a stored accent overridden and a non-hex colour accepted (both asserted before the effect ran, so the new tests flush effects first), and "does not wait for the theme" (the two mocks resolved together; a delayed theme now proves it) |
| Live (real backend, fresh seed), `studioDefaults.live` | **2 of 2**: an administrator makes a localization (MM/DD/YYYY, 12-hour, comma, Sunday first) and a light serif theme the defaults; an **artist** signs in, reads them (open to anyone signed in) and the application formats `11/03/2026 2:07 PM`, starts light with the theme's accents and the serif stack; with the artist's own mode and accents stored, theirs win. **Live mutation caught:** with the locale never applied the real run fails (`11/3/2026, 2:07:00 PM`). The seed is put back as found |
| Gates | `tsc` 0; **111 files / 1,133 tests** (+3 files, +33); build OK; Biome **0 errors, 803 warnings** (Biome 2.6's count, unchanged); nothing new unreachable |
| Role smoke | **7 of 7** (§6) |

## 6. Smoke

**7 of 7 pass** (24.9 minutes). Four route reloads, each blank with `net::ERR_NETWORK_CHANGED` and each recovered at the first reload (manager `/settings/system/definitions`, producer `/scheduling/milestones` and `/audit`, self-MFA `/login-history`); no sign-in reload was needed. The smoke signs in as each role against a seeded backend and visits every route, so it exercises the new `AppLayout` gate (both defaults read before the page renders) on all of them; with no default chosen in that seed it shows the browser-format fallback path, and the studio formats are proven by the unit and live tests in §5.

## 7. Questions for the owner

1. **Merge** `sync/phase-28-default-theme-locale` into `develop` and push, then `main`?
2. **Apply the studio time zone?** It is the biggest remaining piece of the localization and the riskiest: it means moving the calendar's day grouping, the booking forms' time fields and the server windows to that zone. I would not do it without a decision.
3. **More of the theme?** Radius, surface and text colours would need the screens restyled onto variables first (a design task of its own).
4. Still open and unchanged: drag-to-move on the scheduling grid, and whether re-adding a project member should stop reactivating them (a change request).
