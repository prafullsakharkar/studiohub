# OpenCode Daily-Development Toolkit

How the five external capabilities installed in the OpenCode environment are discovered,
when to use each, and the StudioHub-specific restrictions. Last updated 2026-09-21.
Environment: OpenCode **1.18.31 (V1 track)**, Node v24.18.0, npm 11.16.0, pnpm 10.12.1,
Python 3.9.25 (system) + uv 0.11.25. Repo root: `/home/prafull.sakharkar/Repository/github/studiohub`.

> Note: an earlier copy of this file documented a different machine (`/srv/local/code/`,
> Node v26.8.1). It was rewritten 2026-09-21 to reflect the actual state of **this** machine.

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

## OpenCode skill discovery (verified from the binary)

OpenCode reads skills from these locations (project > global > external):

```text
Project  skills | .opencode/skill(s)/<name>/SKILL.md
Global   skills | ~/.config/opencode/skill(s)/<name>/SKILL.md
External skills | ~/.claude/skills/<name>/SKILL.md, ~/.agents/skills/<name>/SKILL.md
```

`skills.paths` in `opencode.json` can add more directories. Restart OpenCode after any install.

---

## 1. superpowers — primary engineering workflow (global plugin)

- **Repo / version:** `obra/superpowers` (plugin reports v6.4.1), cloned for inspection to `/tmp/opencode/inspect/superpowers`.
- **Integration:** OpenCode-native **global plugin** (official V1 method): `"plugin": ["superpowers@git+https://github.com/obra/superpowers.git"]` in `~/.config/opencode/opencode.json`. Package auto-fetched to `~/.cache/opencode/packages/superpowers@git+https:/github.com/obra/superpowers.git/node_modules/superpowers/` (entry `.opencode/plugins/superpowers.js`, 15 skills).
- **Discovery:** `skill` tool → `using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `finishing-a-development-branch`, `using-git-worktrees`, `writing-skills`, `diagnosing-superpowers`.
- **Use for:** complex/architecture/multi-step work (backend+frontend features, refactoring, planning, testing strategy). Preferred flow: Understand → Inspect architecture → Plan → Break into tasks → Implement → Test → Review → Verify.
- **Do NOT use for:** trivial bug fixes (normal workflow, no sub-agents).
- **Note:** activation requires a restart. A headless `opencode run` verification can time out purely from local-model inference (llama.cpp) and is not a plugin failure.
- **Update:** `opencode plugin "superpowers@git+https://github.com/obra/superpowers.git" --global --force`.

## 2. geo-seo-claude — GEO/website audits only (external skills + `/geo` command)

- **Repo:** `zubair-trabzada/geo-seo-claude` (inspected at `/tmp/opencode/inspect/geo-seo-claude`).
- **Integration:** ran upstream `install.sh` from the local checkout (inspected first: plain `cp` + venv + pip, no exfiltration; deps standard PyPI: bs4/requests/lxml). Installed to `~/.claude/skills/geo` (+ 15 `geo-*` sub-skills), which OpenCode discovers natively. Venv: `~/.claude/skills/geo/.venv` (deps import OK). Playwright browsers skipped (screenshots unavailable — optional).
- **Discovery:** `skill` tool → `geo` + 15 `geo-*` skills.
- **Use for:** public website, product docs, landing pages, marketing content, AI-search discoverability. Primarily future StudioHub marketing/docs-site work.
- **Restriction:** never apply GEO recommendations to application code unless explicitly requested.
- **Limitation:** `~/.claude/agents/geo-*.md` (5 files) are Claude-only and not wired into OpenCode — use OpenCode's Task tool for subagent fan-out.
- **Update:** re-run installer from a fresh clone (skills are plain files).

## 3. code-review-graph — token-efficient reviews (project-local MCP)

- **Repo / version:** `tirth8205/code-review-graph`, run via `uvx code-review-graph serve --repo <path>`.
- **Integration:** MCP server `code-review-graph` in `~/.config/opencode/opencode.json`.
  - **Fix applied 2026-09-21:** the configured `--repo` pointed at a stale path (`/srv/local/code/studiohub`) that does not exist on this machine. Corrected to `/home/prafull.sakharkar/Repository/github/studiohub` and added `"enabled": true`. Takes effect on restart (current session's server stays bound to the old path until then).
- **Graph built:** 1989 files / 10919 nodes / 55781 edges (branch develop).
- **Use for:** large changes, PR/architecture reviews, cross-module refactors, regressions. Start with graph tools (`detect_changes_tool`, `get_impact_radius_tool`, `query_graph_tool … tests_for`), then read source. Source always wins over graph output.
- **Update:** `uv tool upgrade code-review-graph`; rebuild per repo.

## 4. ui-ux-pro-max — frontend design guidance (global skills)

- **Repo / version:** `nextlevelbuilder/ui-ux-pro-max-skill`, CLI **2.15.0**, via `npm install -g ui-ux-pro-max-cli` then `uipro init --ai opencode --global`.
- **Integration:** installed to `~/.opencode/skills/` (7 skills: `ui-ux-pro-max`, `banner-design`, `brand`, `design`, `design-system`, `slides`, `ui-styling`).
  - **Symlink fix applied 2026-09-21:** OpenCode reads **global skills from `~/.config/opencode/skills/`**, but `uipro --global` writes to `~/.opencode/skills/` (not a recognized global path). Created `~/.config/opencode/skills -> ~/.opencode/skills` so OpenCode discovers them and `uipro update` keeps working.
- **Use for:** frontend design work — pages, components, design systems, tables, filters, forms, navigation, responsive, a11y, color/typography.
- **Restriction: StudioHub architecture always wins** — React + TypeScript + Vite + MUI + TanStack Query + Zod + RHF + existing routing/workspace patterns. Never introduce a new UI framework because the skill suggests it.
- **Update:** `uipro update --global` (re-runs `init --ai opencode --global`).

## 5. remotion — programmatic video (external skills, isolated)

- **Skills:** `remotion-dev/skills` bundle (12 skills) installed globally via `npx -y skills add remotion-dev/skills -g -y --agent '*'` → `~/.agents/skills/` (OpenCode discovery path). Start with `remotion-best-practices` (umbrella router), then `remotion-create` / `remotion-render`.
- **Isolation:** nothing added to StudioHub dependencies. Video work happens in standalone compositions outside `studiohub` unless explicitly required.
- **Known limitation:** no `ffmpeg` on this machine — scaffolding/composition guidance works, but rendering needs the user to install ffmpeg. Node v24 satisfies Remotion 4's runtime.
- **Update:** `npx -y skills update`.

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
