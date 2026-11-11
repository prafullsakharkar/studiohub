# Phase 30: a card view for the list screens: verification

Same branch as Phase 29 (`sync/phase-29-workflow-board`), **uncommitted, not pushed, not merged**; the two phases can be split when committing (this one touches `modules/directory/` only). **No backend file was touched.**

The owner asked for the card view back "wherever needed" and chose the generic switch over purpose-built cards. The old frontend had card and grid views (`DeliveryCard`, `PublishCard`, `MediaGrid`, `ResourceGridView`, and the generic `GridView` with a table/grid switch); they were deleted as unreachable (`9435f243`, `45a64c8a`, `67d78cd6`, `2f78700a`, `9fc1bb90`). Every list screen is now a table on one shared page, so the switch is added there.

## 1. What it does

`DirectoryListPage` gets a **Table view / Card view** switch in its header (`aria-pressed` buttons).
- **Cards**: one card per row. The first column is the card's title and link (the same link, or none, as in the table); the other columns are labelled values; Restore, the row's own actions, Edit and Delete sit in the card footer. The row controls are one shared function, so a table row and a card cannot drift apart, and the same permission gates apply (`canManage`, `canEdit`, `canRemove`, `canDelete`).
- **Selection** (bulk actions): a checkbox on each card and **Select all on this page**; the bulk toolbar is the same.
- **Sorting**: the table headers are not there, so cards get a **Sort by** select (the columns that have a `sortField`, plus Default order) and an ascending/descending button. Both use the server's `ordering` parameter.
- Search, filters, the Active/Archived switch, export, paging and the empty and error states are shared and unchanged.
- The choice is remembered per screen in this browser (`studiohub.listView:<basePath>`, `listViewMode.ts`); a blocked store means the table. It is a convenience only.

## 2. Where

The switch is on every screen built on `DirectoryListPage`: 36 files, covering shots, assets, tasks, time logs, task templates, versions, reviews, playlists, media, workflows, deliveries, publishing, scheduling (resources, events, milestones, leave), projects, structure, teams, people, clients, vendors, offices, positions and the project tabs. A project tab and its global screen share one choice because they share a `basePath`.

Not changed: the tables that are not list screens (record histories, the shot status matrix, the API health table, the capacity and calendar views, the panels inside a workspace).

## 2b. The five screens' own cards (from `studiohub-react`)

The owner pointed at the sibling `studiohub-react` repo for the look. Its cards (`DeliveryCard`, `PublishCard`, the Versions grid, the Reviews grid, `MediaGrid`) share one layout: a 16:9 top with badges laid over it (code or number and status above, shot and size or frame range below), a title with a small mono sub-line, a facts box, and an action footer. That layout is one component, `modules/directory/ListCard.tsx` (`ListCard`, `CardChip`, `CardFacts`), and a list config opts in with `renderCard` (and `cardGrid` for four columns). A list without `renderCard` keeps the generic card of section 1.

| Screen | Top | Over it | Body | Footer |
|---|---|---|---|---|
| Versions (`versionCard.tsx`) | thumbnail | number, Hero / status / shot, frame range | code, department and project, resolution and colour space | artist, Published, Edit / Archive |
| Reviews (`reviewCard.tsx`) | thumbnail | code / status / shot | title, lead reviewer, description, verdict once decided | client, version and comment counts |
| Media (`mediaCard.tsx`) | thumbnail | type / format / resolution, size | name, what it is on, category, storage tier | Edit / Archive |
| Deliveries (`deliveryCard.tsx`) | band (no picture exists) | code / status / version count, size | name, project, client, method, due (red when expired), the client's answer once given | Edit / Delete as the table allows |
| Publishing (`publishCard.tsx`) | band (no picture exists) | tool and version coloured by tool / status / shot or asset, format | name, code, what it is for, project, retries, a failed notice | Edit / Delete as the table allows |

Pictures come from the record's `thumbnail_url` through `SmartImg`, after `safeWebUrl` (a `javascript:` or `data:` address shows the placeholder). The cards take the same link, selection box and row controls as the table row (`CardContext`), so permissions, `canEdit`/`canRemove` (a sent delivery has no Edit or Delete), bulk selection and Archive are one implementation.

**Differences from the old cards, all because the real API differs:** deliveries and export jobs have no thumbnail (the old cards showed a stock photo), the job list row carries no error text (so a failed job says so and points to the job), a delivery row has no rejection reason or transfer progress, the review row has no project code, department or frame count, and the old Reviews card's play mark on hover is not drawn. The Submit / Approve / Reject / Prepare / Retry buttons of the old Delivery card are not on the card: those lifecycle actions are on the delivery's workspace (the table has none either). The version card shows the status as a badge; changing it inline is still the table's status menu.

## 2c. The task board, in the old board's look, as a third view of the same page

A task board already existed as its own page (`/tasks?view=board` and a project's Tasks tab, Phase 9, with its own project, search and Mine controls). The owner pointed at `studiohub-react` (`TaskBoardView.tsx`) for the look and then asked for it **on the same page, like Table / Card**. It is now the third choice of the switch: **Table view, Card view, Board view**.

**How:** a list config may define `board: { render, limit, ordering }` (`DirectoryListConfig`). `DirectoryListPage` then shows the third button and, in Board view, renders `board.render(rows)` in place of the table or cards, under the **same header, search, filters, Active/Archived switch and Export / New buttons**. The rows come from a second query with the page's own params (search, filters, project scope) at `page=1`, `page_size=500` and the config's ordering; the table's 25-row query is switched off while the board is shown (`usePaginatedList` `enabled`). The board has no pager and no bulk selection; if there are more matches than 500 it says "Showing the first N of M tasks. Narrow with the filters, or use the table." The archived view has no board: the button is hidden there and the table shows, and a saved "board" on a list that defines none is the table. The choice is remembered per screen like the other two (`studiohub.listView:<basePath>`).

**Tasks:** `useTasksListConfig` defines the board (`TaskBoardLanes`, 500, `code`). Because it is part of the list config, a project's Tasks tab gets it too. The old separate page, its Board / List buttons and the tab's own switcher are removed; the project, search and Mine controls it carried are the list's own project, search and Assignee (Me) filters, which already existed. `/tasks?view=board` no longer means anything (the page opens in the saved view); it was only used by the manual live test, which now clicks Board view. `TaskTimeCell` moved to its own file (`TaskTimeCell.tsx`, still exported from `tasks.tsx`) to avoid an import cycle.

**The look:** lanes 280 px wide, scrolling sideways, each with its own border colour and a count pill, an empty lane saying "No tasks"; cards with the code link and a priority badge, the title (two lines), a shot / asset / General chip with an icon, the task type (else the department) and the project code, the assignee and logged / estimated hours, the due date in the studio's date format (red with an alert mark when past due and not approved), back and forward arrows (one step along Not Started, In Progress, Pending Review, Approved; a retake goes forward), then Log time, Start timer and the status menu. The arrows show only with `task.update` and only for a move `statusFlow.ts` allows; drag and drop, the status menu and the server's refusals work as before.

**Not brought back:** the old On Hold lane (the server's task status table has none; shots have it), the old lane order (Approved before Retake), and the old play / pause icon button (the existing Log time / Start timer text pair works with the timer store).

**Tests** (`board.test.tsx` 15, rewritten for the list page, plus 1 in `listViewMode.test.tsx`): the switch has the three buttons and the board replaces and then gives back the table; the table page is requested only while the table is shown (and not at all when the board is the saved view), the board set only while the board is; the board request carries the project scope, assignee and search filters at 500 in code order; the choice is remembered and the bulk tools and pager are absent on the board; the archived view falls back to the table and comes back to the board; a list without a board has no third button; the card facts, overdue (not for an approved task), the arrows and their absence for a viewer; drag and drop, the paging notice and the read-only card as before. Mutation checks: switching the table query on in board mode fails the "started on the board" test, offering the board in the archived view fails the archived test, arrows without `task.update` and counting an approved task as overdue each fail theirs.

**Looked at once** on a throwaway page (deleted afterwards) rendering the real `TasksPage` with `fetch` stubbed to captured-shape tasks, dark theme, 1500 px: the header with search and the five filters, the three-icon switch with Board active, Export / Templates / New task, and the lanes and cards below. It also exposed, earlier, the status menu overflowing a card, now fixed by letting that row wrap. Not run in the signed-in app against a backend, not seen at phone width, and the live test was edited but not run.

## 3. Gates

`pnpm typecheck` clean; `pnpm exec biome check src --diagnostic-level=error` clean; `pnpm test` 141 files, 1474 tests (6 new in `listViewMode.test.tsx` on captured team samples, 11 in `listCards.test.tsx` on captured version, review, media, delivery and job lists, 15 in `board.test.tsx`); `pnpm build` clean; `unreachable.mjs` lists only tests, `*RowKeys.ts` and test helpers.

Mutation checks: dropping the `canManage` gate on a card's controls fails the permission tests (generic and per-screen); removing the write to storage fails the "remembers the choice" test; removing `safeWebUrl` from the version card fails the unsafe-address test.

**Looked at in a browser once:** a throwaway page (deleted afterwards) rendered the five real card components on captured rows in the dark theme at 1500 px, with a served image for the picture cards. The layout, badges over the picture, facts boxes and footers rendered as described; the version and review cards were checked with and without a picture. It was not run inside the signed-in app against a backend.

## 4. Not verified, and limits

- **Not looked at inside the app.** Only the throwaway page above; the columns by width (`cardGrid`), the card in a project tab and a narrow phone width were not seen. No live-backend run was done.
- **Only the five screens above have their own card.** Every other list uses the generic card made from its columns (shots, assets, tasks, playlists and the rest); they could get a picture card the same way if they have a thumbnail.
- A card shows every column of the table, so a list with many columns gives a tall card. A per-list choice of which columns a card shows (a `cardColumns` option) is not built.
- The table is still the default; there is no studio-wide setting for it (`usePageLayoutStore.preferredViewMode` exists but nothing reads it).
