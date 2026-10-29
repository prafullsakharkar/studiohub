# StudioHub — Frontend Testing Strategy & AI QA Guide

Two things in one document: (1) the full set of testing types you actually need
for a product this size, with what each one catches and where it runs, and (2) how
to direct an AI agent to do what a human manual tester does — exploring the app,
noticing what's broken, and reporting it back — rather than just writing unit
tests in isolation.

---

## Part 1 — The testing types you need, and why

Ten types, roughly ordered from "cheapest to run constantly" to "most expensive,
run less often." A product isn't robust because one of these is excellent — it's
robust because all ten exist and each catches what the others structurally can't.

| # | Type | Catches | Tooling fit for your stack | Runs |
|---|---|---|---|---|
| 1 | **Unit tests** | Broken logic in isolated functions/hooks — a selector, a `parseDecimal()` utility, a date formatter | Vitest (fast, works natively with Vite) | Every commit, every PR |
| 2 | **Component tests** | A component renders wrong given certain props/state — e.g. `PermissionGate` hides content it shouldn't, `DataTable` mis-sorts | React Testing Library + Vitest | Every PR |
| 3 | **Integration tests** | Components + data layer wired together wrong — a page fetches via TanStack Query, MSW returns a fixture, does the page render correctly end to end within the mock boundary | React Testing Library + your existing MSW handlers (reuse them, don't build a second mock layer for tests) | Every PR |
| 4 | **Contract / schema tests** | Frontend TypeScript types silently drifting from the real backend response shape — exactly the class of bug found in the earlier schema-diff work | A CI check that diffs the OpenAPI schema against frontend types/MSW fixtures (see the model-diff-prompt from earlier in this project) | Every PR + scheduled (e.g. nightly against staging) |
| 5 | **End-to-end (E2E) tests** | Real user flows across multiple pages/screens — login → create project → assign task → log time, exactly as a user would click through it | Playwright (handles multi-tab, network interception, and can run headed for debugging) | Every PR (smoke subset) + full suite pre-release |
| 6 | **Permission/authorization tests** | A permission gate missed in one entry point but present in another — nav hides a feature but the route doesn't, or search leaks records a list view correctly hides | Playwright/RTL, driven by the test-matrix pattern from the platform-admin test cases (multiple entry points, same denial expected everywhere) | Every PR for the area touched + full sweep pre-release |
| 7 | **Visual regression tests** | Unintended UI changes — a CSS refactor that silently breaks a layout nobody was looking at | Playwright's built-in screenshot comparison, or Chromatic if you want hosted review | Every PR (flag diffs for human review, don't auto-fail on every pixel) |
| 8 | **Accessibility tests** | Missing labels, bad contrast, keyboard-navigation dead ends, screen-reader traps | `axe-core` (via `@axe-core/playwright` or `jest-axe`) run against key pages | Every PR (automated) + periodic manual pass with a screen reader for the highest-traffic flows |
| 9 | **Performance tests** | Slow initial load, layout shift, a page that re-renders excessively on a large `DataTable` | Lighthouse CI for page-level metrics; React DevTools Profiler or `why-did-you-render` for re-render investigation | Scheduled (nightly/weekly), not every PR — too noisy to gate merges on |
| 10 | **Exploratory / AI-driven QA sweeps** | Everything the other nine don't catch because nobody thought to write a test for it — the class of bug a human tester finds by "just poking around" | An AI agent with browser access, run against a checklist (Part 2 of this doc) | Before releases, after major features, or on a regular cadence (e.g. weekly) |

A rough allocation that works well in practice: types 1–4 should be fast enough to
run on every single PR without anyone noticing the wait. Types 5–8 run on PRs
touching the relevant area, plus a full pass before any release. Types 9–10 are
scheduled, not gate-blocking — they're how you catch the things a fast feedback
loop structurally can't.

---

## Part 2 — Getting an AI agent to do what manual QA does

Here's the actual gap: automated tests only check what someone remembered to
write a test for. A human tester's real value is different — they open the app
with no script, try things that seem plausible, and notice when something feels
wrong even if they can't articulate a formal assertion in advance. To get that
from an AI agent, you need to give it three things a normal test-writing prompt
doesn't include: **browser access** (not just code access), **a systematic
checklist so it covers breadth, not just whatever it thinks of first**, and **a
mandate to report findings as bugs, not just pass/fail a preset test**.

### What the agent needs access to
- A running instance of the app (both `VITE_API_MODE=mock` and `VITE_API_MODE=rest`
  against a test backend — bugs specific to one mode are real bugs).
- Browser automation — Playwright, or a browser-driving tool/extension if you're
  running this through an agent that has one (e.g. Claude Code with a Playwright
  MCP connector, or Claude in Chrome for a more interactive session).
- Visibility into console errors and network requests, not just the rendered page
  — a page that "looks fine" but is throwing console errors or making failed
  requests is a real bug a human tester would likely miss too, so this is actually
  an area where the AI agent can outperform a manual pass if you ask it to check.
- Read access to whatever defines "correct" — the acceptance criteria docs,
  the permission matrix, the earlier schema-diff findings — so it can flag a
  mismatch against spec, not just against its own assumptions about what should
  happen.

### The checklist structure (per page/feature)

Don't ask the agent to "test the app." That's too open-ended to get systematic
coverage — it'll wander toward whatever's most interesting and miss breadth. Give
it a checklist to run **per page or feature area**, structured like this:

1. **Functional pass** — every visible interactive element (button, link, form
   field, dropdown, tab) gets exercised at least once. Does it do what its label
   implies?
2. **Input boundary pass** — for every form: empty submission, obviously invalid
   input (wrong type, way too long, special characters), boundary values (0,
   negative numbers where they shouldn't be allowed, max-length strings).
3. **Permission pass** — load the page/feature as each relevant permission level
   (no access, view-only, full access) and confirm what's shown/hidden/enabled
   matches what it should be — this is where the multi-entry-point pattern from
   the platform-admin test cases applies generally, not just to that feature.
4. **State pass** — loading state, empty state (zero records), error state
   (force a failed request), and populated state all get looked at, not just the
   happy path with data already loaded.
5. **Responsive pass** — check at a few real breakpoints (mobile width, tablet,
   standard desktop, ultra-wide if the product supports it) — not just resize the
   window once and glance at it.
6. **Console/network pass** — check dev console for errors/warnings and the
   network tab for failed or unexpectedly slow requests, for every page visited
   in the above passes, not as a separate exercise.
7. **Spec cross-check** — where a permission matrix, acceptance criteria doc, or
   prior audit exists (like the platform-admin work), explicitly compare observed
   behavior against it and flag any mismatch by name.

### How the agent should report findings

Ask for a structured bug report per finding, not prose paragraphs:

```
Title: [short description]
Page/Feature: [where]
Steps to reproduce: [numbered]
Expected: [what should happen, cite spec/acceptance criteria if applicable]
Actual: [what happened]
Severity: [blocker / major / minor / cosmetic]
Console/network evidence: [if applicable]
Screenshot: [if the tool can capture one]
```

Then, critically: **ask the agent to separate one-off exploratory findings from
things that should become a permanent automated test.** A bug it found by chance
today can regress silently next month if nobody codifies it — so the output of
every exploratory sweep should include a short list of "convert to a permanent
[unit/component/integration/E2E] test" recommendations, not just a bug list that
gets fixed once and forgotten.

### A reusable prompt template

Copy this and fill in the bracketed parts for a real sweep:

```
You're doing exploratory QA on [feature/page/flow], acting as a thorough manual
tester, not just running existing test suites. You have browser access to the app
running at [URL], in [mock/rest] mode.

Work through this checklist for [feature/page]:
1. Functional — exercise every interactive element, confirm it does what it says.
2. Input boundaries — empty, invalid, and boundary-value inputs on every form.
3. Permissions — test as [list the permission levels relevant here], confirm
   visibility/access matches [link to permission matrix / acceptance criteria].
4. States — loading, empty, error (force a failure), and populated states.
5. Responsive — check at mobile, tablet, and desktop widths.
6. Console/network — note any errors, warnings, or failed/slow requests at every
   step above.
7. Spec cross-check — compare what you observe against [link to relevant spec/
   acceptance criteria doc] and flag any mismatch explicitly.

Report every finding as a structured bug report (title, steps, expected, actual,
severity, evidence). At the end, separate your findings into "fix now" items and
a short list of which findings should be turned into permanent automated tests so
they don't regress silently later.
```

---

## Part 3 — Putting it together: a robustness checklist

A product is reasonably robust on the frontend when all of the following are
true at once — treat this as the definition of "done," not the ten testing types
in isolation:

- [ ] Every PR runs unit + component + integration + contract tests automatically,
      fast enough that nobody skips them.
- [ ] Every permission-sensitive feature has multi-entry-point authorization tests
      (nav, direct URL, search, and any other access path checked together, not
      just the primary one) — this was the single biggest gap category found in
      the platform-admin test cases and generalizes to every permission-gated
      feature in the product.
- [ ] E2E smoke tests cover the core user journeys end to end, run on every PR;
      the full E2E suite runs before every release.
- [ ] Visual regression and accessibility checks run on every PR, with diffs
      surfaced for human review rather than silently auto-passing or
      auto-blocking on noise.
- [ ] Performance is checked on a schedule, with a known baseline so regressions
      are visible as a trend, not just a single pass/fail number.
- [ ] An AI-driven exploratory QA sweep runs before every release (or on a fixed
      cadence, e.g. weekly) against the checklist in Part 2, with findings
      triaged into immediate fixes and new permanent tests.
- [ ] Every bug found — whether by a human, an automated test, or an AI sweep —
      results in a new permanent test, not just a one-time fix. This is the
      difference between "we tested it once" and "it stays tested."
```

(End of file)
