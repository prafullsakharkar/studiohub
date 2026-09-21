# OpenCode Daily-Development Toolkit

How the five external capabilities installed in the OpenCode environment are discovered,
when to use each, and the StudioHub-specific restrictions. Installed 2026-09-20.
Environment: OpenCode **1.18.31 (V1 track)**, Node v26.8.1, pnpm 11.17.0, Python 3.9.25 (system) + uv-managed 3.13/3.14.

Authority hierarchy (never inverted):

```text
User request
    ↓
StudioHub project architecture/rules (AGENTS.md, backend/.ai/*, existing code)
    ↓
Current codebase implementation + existing tests/contracts
    ↓
Installed OpenCode skills/tools (this document)
    ↓
Repository recommendations
```

Backups of every config touched live in `/tmp/opencode/config-backup-20260920/`.

---

## 1. superpowers — primary engineering workflow (global)

- **Repo / version:** `obra/superpowers` @ git HEAD `5bf4e78` (plugin reports v6.4.1), cloned for inspection only to `/tmp/opencode/repo-inspect/superpowers` (not copied into any project).
- **Integration:** OpenCode-native **global plugin** (official V1 method): `"plugin": ["superpowers@git+https://github.com/obra/superpowers.git"]` in `~/.config/opencode/opencode.jsonc`, installed via `opencode plugin … --global`. Package cache: `~/.cache/opencode/packages/`. Pure JS, no dependencies.
- **Discovery:** `skill` tool → 14 skills: `using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `finishing-a-development-branch`, `using-git-worktrees`, `writing-skills`, `diagnosing-superpowers`.
- **Use for:** complex/architecture/multi-step work (backend+frontend features, refactoring, planning, testing strategy). Preferred flow: Understand → Inspect architecture → Plan → Break into tasks → Implement → Test → Review → Verify.
- **Do NOT use for:** trivial bug fixes (normal workflow, no sub-agents).
- **Verified:** headless `opencode run` session lists all 14 skills.
- **Update:** `opencode plugin "superpowers@git+https://github.com/obra/superpowers.git" --global --force` (or pin `#vX.Y.Z` in config for reproducibility).

## 2. geo-seo-claude — GEO/website audits only (global skills + `/geo` command)

- **Repo:** `zubair-trabzada/geo-seo-claude` (inspected at `/tmp/opencode/repo-inspect/geo-seo-claude`). Claude-Code-native; **adapted, not forked**.
- **Integration:** ran upstream `install.sh` from the local checkout (inspected first: plain `cp` + venv + pip, no exfiltration; deps are standard PyPI: bs4/requests/lxml/playwright/Pillow/flask/rich). Installed to `~/.claude/skills/geo` (+ 15 `geo-*` sub-skills), which OpenCode discovers natively. Venv: `~/.claude/skills/geo/.venv` (uv built it with managed Python 3.14.7; all deps import). Playwright browsers skipped (screenshots unavailable — optional).
- **Adaptation for OpenCode:** `/geo` is a Claude slash-command; OpenCode equivalent is global command `~/.config/opencode/commands/geo.md` (router over `$ARGUMENTS` → `skill` tool). `~/.claude/agents/geo-*.md` (5 files) are Claude-only and intentionally **not** wired into OpenCode — subagent fan-out uses OpenCode's Task tool instead.
- **Discovery:** `skill` tool → `geo` + 15 `geo-*` skills; `/geo` in any session.
- **Use for:** public website, product docs, landing pages, marketing content, AI-search discoverability (`/geo audit <url>` etc.). Primarily future StudioHub marketing/docs-site work.
- **Restriction:** never apply GEO recommendations to application code unless explicitly requested.
- **Verified:** all 16 skills listed by a headless session; venv imports deps; live `requests.get('https://example.com')` → HTTP 200.
- **Update:** re-run installer from a fresh clone (backs up nothing — skills are plain files).

## 3. code-review-graph — token-efficient reviews (project-local MCP)

- **Repo / version:** `tirth8205/code-review-graph` **2.3.9**, installed via `uv tool install code-review-graph` (isolated from system Python 3.9; uses uv-managed Python). Token-saving claims treated as unverified — use where it adds value, source always wins.
- **Integration (official `install --platform opencode`, dry-run reviewed first):**
  - StudioHub: MCP server `code-review-graph` (`uvx … serve --repo /srv/local/code/studiohub`) in `opencode.json`; additive marked section appended to root `AGENTS.md` (existing rules untouched); `.gitignore` += `.code-review-graph/`; user-level plugin `~/.config/opencode/plugins/crg-plugin.ts`.
  - studiohub-react: same, repo-pinned to `/srv/local/code/studiohub-react`; new untracked `AGENTS.md` holds only the marked section (repo has no tracked AGENTS.md; `CLAUDE.md` remains the guide there).
- **Graphs built:** studiohub — 1989 files / 10919 nodes / 55781 edges; studiohub-react — 972 files / 5147 nodes / 59104 edges.
- **Use for:** large changes, PR/architecture reviews, cross-module refactors, regressions. Start with graph tools (`detect_changes_tool`, `get_impact_radius_tool`, `query_graph_tool … tests_for`), then read source. Aim ~5 calls / 800 tokens per task; correctness over savings.
- **Verified:** MCP `initialize` handshake over stdio returns `code-review-graph/2.3.9`; `build` completed for both repos.
- **Known limitation (V1 API):** the installer also drops a user-level plugin at `~/.config/opencode/plugins/crg-plugin.ts` (auto-update on edit, session status, pre-commit analysis), but it targets a newer plugin API and fails to load on 1.18.31 (`app.on is not a function`, error every session start). It is **disabled** (renamed to `crg-plugin.ts.disabled`) — re-enable after upgrading OpenCode past the supported API. Graph freshness meanwhile is manual: run `code-review-graph update` (or `build`) per repo; MCP tools, skills section, and AGENTS.md guidance are unaffected.
- **Update:** `uv tool upgrade code-review-graph`; rebuild per repo (`code-review-graph build`); uninstall cleanly removes only CRG-owned sections (`uninstall --dry-run` previews).

## 4. ui-ux-pro-max — frontend design guidance (project skill)

- **Repo / version:** `nextlevelbuilder/ui-ux-pro-max-skill`, CLI **2.15.0**, via official `uipro init --ai opencode` (run with npx, no global install) in `/srv/local/code/studiohub-react`.
- **Integration:** project skill `.opencode/skills/ui-ux-pro-max/SKILL.md` (+ local `data/` CSVs, stdlib-only `scripts/search.py`). Coexists with pre-existing project skills (`brand`, `design`, `design-system`, `ui-styling`, …) — distinct names, nothing overwritten.
- **Use for:** org/client/vendor/people views, projects, workspace, dashboards, tables, filters, forms, navigation, responsive, a11y in the React/MUI frontend.
- **Restriction: StudioHub architecture always wins** — React + TypeScript + Vite + MUI/MUI X + TanStack Query + Zod + RHF + existing routing/workspace patterns. Never introduce a new UI framework because the skill suggests it.
- **Verified:** skill listed from studiohub-react cwd; `search.py --domain style` runs on system Python 3.9 and returns ranked results.
- **Update:** `npx -y ui-ux-pro-max-cli update` (project) — re-run `init --ai opencode` if templates change.

## 5. remotion — programmatic video (global skills, isolated)

- **Skills:** `remotion-dev/skills` bundle (12 skills, v4.0.526) installed globally via official `npx skills add … -g` to `~/.agents/skills/` (OpenCode discovery path). Start with `remotion-best-practices` (umbrella router), then `remotion-create` / `remotion-render`.
- **Isolation:** nothing added to StudioHub dependencies. Video work happens in standalone compositions outside `studiohub`/`studiohub-react` unless explicitly required.
- **Verified:** all 12 skills listed by a headless session.
- **Known limitation:** no `ffmpeg` on this machine — scaffolding/composition guidance works, but rendering needs the user to install ffmpeg. Node v26 satisfies Remotion 4's runtime.
- **Update:** `npx skills update` (global).

---

## When to use what (daily workflow)

| Task | Tools |
|---|---|
| Simple bug fix | normal workflow, none of the above |
| Large backend feature | superpowers (+ code-review-graph for review) |
| Frontend redesign / new view | ui-ux-pro-max (+ superpowers if multi-step) |
| Large refactoring | superpowers + code-review-graph |
| Website / docs GEO audit | `/geo audit <url>` (geo skills) |
| Product demo / tutorial video | remotion skills, isolated project |

## Maintenance

- Review upstream releases quarterly; update via each tool's documented command above.
- After any reinstall, re-run the corresponding verification (skill list via headless `opencode run`, or the tool-specific check in its section).
- Never commit secrets; none of these tools require API keys (superpowers/code-review-graph/ui-ux/remotion run fully local; geo needs none unless Playwright screenshots are enabled later).
