# Frontend Canonical Components Refactor (Sep 2026)

## State
- `frontend/` was rebuilt in a previous session (old dir deleted in working tree, new untracked dir with ~778 files). Work is UNCOMMITTED on `develop`.
- Old frontend recoverable via `git checkout -- frontend/` (tracked in HEAD) if ever needed.

## Architecture
- Canonical barrel: `frontend/src/components/index.ts` re-exports `ui/data/workspace/entity/forms/navigation/system`.
- `components/ui/index.ts` re-exports shared primitives (Button, Badge, StatusBadge, Card, Input, SearchInput, Pagination, Modal) + owns Dialog.tsx / Drawer.tsx.
- `components/workspace/index.ts` and `components/navigation/index.ts` are EMPTY stubs (populate later).
- Two repository interface layers exist: `src/api/repositories/interfaces/` (used by factory + Proxy-based `api/repositories/index.ts`) AND `src/modules/production/repositories/IProjectRepository.ts`. Both must keep identical member shapes (structural typing bridges them). `ProjectRepository` class in modules/ is vestigial — it delegates getStatistics to the centralized repo.

## Quality Gates (all passing as of this session)
- `pnpm typecheck` (tsc --noEmit): 0 errors (was 73)
- `pnpm test` (vitest run): 104/104 pass, 10 files
- `pnpm build` (vite + esbuild server): passes; chunk-size warning only (~4.9MB bundle)
- Runtime smoke via headless chromium (@sparticuz/chromium + playwright-core): app boots, /login works with supervisor@studiohub.vfx / password123 (mock auth hint: password123), /dashboard /projects /tasks /organizations /publishing /reviews + detail workspaces render, zero page errors. External image CDN fetches fail in sandbox (ERR_NETWORK_CHANGED) — not app errors.

## Environment gotchas
- Playwright MCP server requires chrome channel; chrome not installed; CDN downloads blocked; system firefox incompatible with playwright juggler. Workaround: `npm i playwright-core @sparticuz/chromium` in /tmp/opencode/browser and launch chromium from npm package.
- `pkill -f "server.ts"` kills the bash tool's own shell (pattern self-match). Kill dev server with `fuser -k 3000/tcp`.
- pnpm blocks postinstall scripts by default: run `pnpm approve-builds --all` then `pnpm install`.
- vite/vitest printed stale `/srv/local/code/studiohub-react` paths from cache; cleared node_modules/.vite + tsconfig.tsbuildinfo.

## Type-fix convention (API contract stays honest)
Optional entity fields are fixed at usage sites, NOT by loosening types:
- display fallback chains: `media.title ?? media.file_name ?? media.code`
- timestamps: `new Date(x.created_at ?? Date.now())`, sort keys `?? 0`
- numeric guards: `(seq.shot_count ?? 0) > 0 ? ... / (seq.shot_count ?? 1)`
- optional arrays before spread/map: `...(item.activity || [])`, `(item.validation_rules || []).map(...)`

## Docs
- Registry written: `frontend/docs/frontend/CANONICAL_COMPONENTS.md`
- `frontend/CLAUDE.md` updated: components tree + Canonical Component Rule section.

## Remaining work
- Populate components/workspace and components/navigation barrels as chrome/switchers migrate.
- Sweep feature code for direct `@/shared/components` imports -> convert to `@/components`.
- Remove module-local duplicates of canonical patterns (e.g. pages/ error screens vs system states).
- Everything uncommitted — commit decision belongs to user.