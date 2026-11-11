# Phase 29: the workflow chart board is back: verification

Branch `sync/phase-29-workflow-board` (from `develop` at `45a18e48`), **not committed, not pushed, not merged**. **No backend file was touched.**

The owner asked for it ("previously workflow is in chart board", then "Restore the board too"). The legacy board (`WorkflowCanvas`, `NodeCard`, `ConnectionEdge`, `NodePalette`, `WorkflowStudio`) was deleted in `2f78700a` as unreachable code, and its `NodeConfigDrawer` and `TransitionConfigModal` had been gone since an earlier commit, so the old files could not be restored as they stood. This phase writes a smaller board on the current typed API, with the old look (node type colours and icons, true/false ports, the 340 by 200 grid).

## 1. The contract

The backend stores `nodes` and `transitions` as free JSON and evaluates none of it (`WorkflowSimulation` is a stub; `docs/sync/samples/production/_review_flow.json`). The shape is therefore the frontend's own, and two shapes exist in stored data:

| | Captured sample (`workflows_detail`) | Board shape (the seeded workflows) |
|---|---|---|
| node | `id`, `label`, `type` | `id`, `type`, `title`, `description`, `department`, `position {x, y}`, `config` |
| transition | `from`, `to` | `id`, `source_node_id`, `target_node_id`, `source_port` (`out`, `true`, `false`), `label` |

`readGraph` accepts both. `writeGraph` keeps every key it does not own and writes **both** spellings of a transition's ends and both `title` and `label` on a node, so the existing node and transition lists and the board agree. A node without a position is laid out by depth from the start nodes (one column per step).

## 2. What it does

`modules/production/review/workflowBoard/`:
- `workflowGraph.ts`: the pure part (read, write, auto layout, add, remove, connect, move, update). A self loop and a repeated connection are refused; removing a node removes its transitions; node ids never repeat.
- `WorkflowBoard.tsx`: pan (drag the background), zoom (buttons, 40% to 160%), reset; nine node types; curved transitions with arrows, labels, and green/red for a condition's true/false; select a node or a transition for its details. With a way to save (`workflow.update`) there is **Edit board**: drag nodes by their header, add a node (select), connect from an output port to a node's input port, edit title, description, department and type, delete a node or a transition, **Save board** (disabled until something changed) or **Discard**.
- `WorkflowWorkspace.tsx`: the board sits above the existing Nodes and Transitions lists, which now read both shapes. Saving is `PATCH /workflows/{id}/` with `nodes` and `transitions` through `workflowsApi.update`; the board remounts on the new `updated_at`.

## 3. Data

The three workflows seeded on project `TST` (`TST_WF_SHOT`, `TST_WF_ASSET`, `STUDIO_WF_REVIEW`) were rewritten in the board shape (9, 7 and 5 nodes; a retake loop and a condition split in the shot pipeline). This was a data change in the development database only.

## 4. Gates

`pnpm typecheck` clean; `pnpm exec biome check src --diagnostic-level=error` clean (0 errors); `pnpm test` 139 files, 1447 tests (10 new in `workflowBoard.test.tsx`); `pnpm build` clean. `unreachable.mjs` lists only tests, `*RowKeys.ts` and test helpers.

Mutation checks: removing the self-loop guard in `connect` fails the graph test; removing `from` from the written transition fails the board's save test.

## 5. Not verified, and limits

- **Not looked at in a browser.** The board was exercised only in jsdom. Dragging, panning, zoom and the curve geometry were not seen on screen, and no live-backend run (`run_role_smoke.sh`) was done for this phase.
- A transition to a node that is not in the list cannot be drawn. The Transitions list no longer shows such a transition either (before, it showed `—`); it stays in the stored data until a board save drops it.
- No simulator, automation builder or create-workflow dialog came back: the dry run is the existing stub button, and workflows are still created from the form.
- The nodes' `config` (DCC, approval type, publish target, delivery protocol, condition field) is kept on save but not editable on the board.
- Warnings added: 3 `a11y` hints on the board (the transition hit area and the node group), 2 `noArrayIndexKey` already present before. Biome's baseline of 0 errors holds.
