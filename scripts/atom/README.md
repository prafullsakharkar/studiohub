# Importing an ATOM project

These scripts copy one project from ATOM (the studio's older tracker) into studiohub: the project, its
episodes, sequences, shots and assets, the shot–asset links, its tasks, versions from its publishes, and ATOM's people. They were used for MUS on 2026-11-23/24
(70 episodes, 1,471 sequences, 13,116 shots, 1,910 assets, 59,831 links, all checked against ATOM).

## Rules

- **ATOM is read only.** `fetch.py` sends GET requests and nothing else; no other script talks to ATOM.
- **The key stays secret.** `ATOM_API_KEY` is read from the environment or `backend/.env.local` and is never printed.
- **The saved data stays out of Git.** ATOM's project record lists people's names and emails. Keep the data
  folder outside the repository (for example `~/atom-data/<code>`); `scripts/atom/data/` is ignored as a guard.
- **studiohub is written through its own API** (`run.py`, inside `manage.py shell`, as a superuser through DRF's
  `APIClient`), so the same validation as the UI applies. Writes go to whichever database `DJANGO_ENV` selects:
  check it before a real run.
- **Trial run first.** Every bulk step takes `STEP=dry` (the server's dry run, nothing saved) before `STEP=real`.

## Files

| File | Does |
|---|---|
| `fetch.py` | GETs the ATOM project and its episodes, sequences, shots and assets into a data folder; `--work` its steps and tasks; `--publishes` its publishes; `--users` ATOM's users |
| `build.py` | Turns the saved files into studiohub payloads (`<data>/payloads/<kind>.json`); local files only |
| `run.py` | Sends a payload to studiohub (`KIND=project|episodes|sequences|shots|assets|links|tasks|versions|publish-versions`) or compares (`KIND=verify`) |
| `studio.py` | Studio setup: departments on catalog task types, the studio's task templates, a project's workflows |
| `users.py` | Creates ATOM's users as studiohub accounts and directory people (`KIND=users`), and a resource for each active one (`KIND=resources`) |

ATOM's API is described in `scripts/ATOM API.yaml` (base URL `http://192.168.1.128:8085`, header
`Authorization: Token <key>`).

## Steps

Paths below use `D=~/atom-data/mus`; run `fetch.py` and `build.py` from the repository root and `run.py` from `backend/`.

1. **Read ATOM.** `python3 scripts/atom/fetch.py --code MUS --out $D`
2. **Create the project** from a JSON file of its fields. For MUS:
   `{"code": "MUS", "name": "MUS", "type": "Episodic Series", "workflow_type": "episodic", "status": "In Progress", "fps": 25, "resolution": "1920x1080", "aspect_ratio": "16:9", "color_space": "sRGB Encoded Rec.709 (sRGB)", "start_date": "2024-06-26", "delivery_date": "2024-12-31"}`
   - `workflow_type: "episodic"` is what makes a project episodic; studiohub then creates an `EP101` episode.
   - The colour space name must exist in the studio's OCIO config (plain `sRGB` does not).
   - `KIND=project STEP=dry PAYLOADS=$D/project.fields.json ... < ../scripts/atom/run.py` says whether the code is free; `STEP=real` creates it and prints its id.
3. **Build and send, in order** (each kind needs the one before it to exist):
   ```bash
   P=<project id>
   for k in episodes sequences shots assets links; do python3 scripts/atom/build.py $k --data $D --project-id $P; done
   cd backend
   KIND=episodes STEP=dry PROJECT=MUS PAYLOADS=$D/payloads/episodes.json DJANGO_ENV=local uv run python manage.py shell < ../scripts/atom/run.py
   ```
   Repeat with `STEP=real` once the trial run is clean, then the same for `sequences`, `shots`, `assets` and
   `links`. `BATCHES=1` limits a run to one batch; `SHOTS=<code>` limits `links` to one shot, a good first real run.
   `ARCHIVE_EP101=1` on the real episodes run archives the auto-made `EP101`.
4. **Check.** `KIND=verify PROJECT=MUS PAYLOADS=$D ... < ../scripts/atom/run.py` compares each count with ATOM's
   and every stored link with `payloads/links.json`.

## People

ATOM's users are studio-wide, so they are read once, not per project, and imported before tasks (the task import
sets assignees from `user_map.json`).

1. `python3 scripts/atom/fetch.py --users --out ~/atom-data/users` (passwords, API tokens, avatars and settings
   are never saved).
2. `KIND=users USERS=~/atom-data/users/users.json MAP=~/atom-data/users/user_map.json ... < ../scripts/atom/users.py`.
   Try `ONLY=<a few ATOM ids>` first, including an inactive one. A rerun skips everyone already done.
3. `KIND=resources` with the same `USERS` and `MAP`.

What it decides (MUS, 2026-11-24: 2,167 accounts, 495 active; 498 resources):
- **State:** ATOM's active or inactive, on the account and on the person.
- **Password:** random, never kept; people sign in through "Forgot password" or LDAP.
- **Roles, active people only:** artist → Artist, lead → Lead Artist, supervisor and cg_supervisor → VFX Supervisor;
  nobody else gets one, and nobody gets `is_staff` (ATOM's superusers included).
- **Department:** the studiohub department most of the person's ATOM departments map to (`DEPT`), production staff
  → Production, developers → Pipeline TD; blank when they spread over more than three.
- **Position:** from the department for artists (Animator, Rigging TD ...); Production Coordinator for production,
  coordinators and managers; Pipeline Developer for developers.
- **Skipped:** `api_user` and `test.com` / `example.com` addresses. An address studiohub refuses is reported and left out.
- **Limit:** an account's own profile name stays empty (no API lets an admin set another person's profile); the
  name is on the directory person.

## Tasks

One studiohub task per ATOM **step** (a department's work on a shot, asset or sequence); ATOM's tasks (one per
artist and version) give the step its artist and hours. Needs the project, its shots and assets, and the people.

1. `python3 scripts/atom/fetch.py --code MUS --work --out $D` (about 4 minutes for MUS: per episode, then the
   rest by id; a stopped run resumes).
2. `python3 scripts/atom/build.py bids --data $D --project-id $P` prints the median bid hours per step (the
   templates' hours come from it), and `build.py tasks --data $D --project-id $P --users ~/atom-data/users`
   builds `payloads/tasks.json`. `--per-step 100` takes the first 100 steps of each step name by shot or asset
   code, so the first shots get their whole pipeline: a pilot.
3. `KIND=tasks STEP=dry` then `STEP=real` with `PAYLOADS=$D/payloads/tasks.json` (`run.py`). A real run adds the
   assignees as project members first. Existing tasks are matched by ATOM step (`workflow.atom.step_uid`), not by
   code, and skipped, so the full import can follow a pilot; a new step whose code is taken gets the next free `_N`
   (a pilot hands out `_2` codes in another order than a full build: MUS, 5 tasks). `KIND=verify` then also checks
   each built task's entity, type, status, assignee and ATOM details, matched the same way.
4. `KIND=departments PROJECT=MUS` (`studio.py`) if any task type had no department.

What it decides (MUS, 2026-11-24: a pilot of 1,455, then the other 48,243; 49,698 tasks, 16,771 assigned, 65 members):
- **Type:** `STEP_TYPES` maps ATOM's 26 step names to catalog task types (Cloth and Shave Hair → CFX, Blend Shape →
  Rigging, Foliage → Set Dressing ...); the title keeps ATOM's step name. A new step name stops the build.
- **Status:** `STEP_STATUSES`; ATOM's own status goes to `workflow.atom.status`.

  | studiohub | ATOM step status |
  |---|---|
  | Not Started | Ready To Start, Not Started, Waiting To Start |
  | In Progress | In Progress, Outsource |
  | Pending Review | Pending Internal Review, Pending Client Review |
  | Approved | Client Approved, Internal Approved, Final Publish, Closed, Ready To Upload, Ready To Publish |
  | Retake | Client Reject, Internal Reject |
  | Archived | Omitted |
- **Code:** `<entity code>_<TYPE>` like a template's, 44 characters at most, then `_2`.
- **Assignee:** the artist of the step's latest ATOM task, when imported and active; otherwise none (their ATOM id
  stays in `workflow.atom`). MUS pilot: 648 steps' latest artist is inactive, 265 steps have no ATOM task.
- **Hours:** the step's task bids (ATOM keeps minutes; a step's `bid_days` is their sum over 480). Priority stays
  studiohub's default (ATOM's is "low" everywhere).
- **Dates:** start, end and due to `schedule`, due also to `due_date`; dates ATOM filled in are dropped.
- **`workflow.atom`:** step uid, ATOM status, approval times, retakes, bid minutes, artist ids, task count,
  latest version. Never a task uid or name: those hold the artist's name.

## Versions

ATOM's review history for MUS is on its **publishes** (MUS has one ATOM Version record; its reviews were in
ShotGrid). Versions come from publishes in two kinds. Needs the tasks: a version's task is found by its ATOM step.

1. `python3 scripts/atom/fetch.py --code MUS --publishes --out $D` (one GET per shot or asset: MUS has 15,026 and
   about 326,000 publishes, about an hour; a stopped run resumes). `--only <uid>,<uid>` reads a sample.
2. `build.py versions` and `build.py publish-versions`, each with `--data $D --project-id $P --users ~/atom-data/users`.
3. `KIND=versions STEP=dry`, then `STEP=real`, with `PAYLOADS=$D/payloads/versions.json` (`run.py`); the same for
   `publish-versions`. One request per version (no bulk route); a code already there is skipped. `KIND=verify` then
   checks each built version's status, ATOM details and date.

What it decides (MUS pilot, 2026-11-25: 131 dailies versions on 5 shots and 5 assets, 19 publish versions on 10
shots and 10 assets):
- **Dailies version:** one per publish that carries review media (`review_mov`, `mov` or `review_img`), on the task
  of its ATOM step, coded `<task code>_<ATOM publish name>` (`MUS_101_008_0880_ANIMATION_REVIEW_V013`), so artists
  see ATOM's number; studiohub numbers the task's versions v001, v002 ... in ATOM's order. Most departments publish
  review media on one stream ("Review" for Animation, Layout and Cloth; "Comp Out" for Lighting; the geometry for
  asset work); Layout, Render and much of Texturing publish none.
- **Status** (`PUBLISH_STATUSES`): Pending Internal or Client Review → Pending Review; Internal or Client Approved →
  Approved; Internal or Client Reject → Retake. Superseded versions keep theirs (ATOM's review status mostly came
  from ShotGrid; `sg_status_list` is "apr" on every MUS step and means nothing). A new status stops the build.
- **Publish version:** for an approved step (its ATOM status maps to Approved, as for tasks) with no review media,
  one Approved version `<task code>_PUBLISH` holding the step's current set: the latest publish of each stream
  (asset type and name). Not marked published: that waits for its files to be registered (size and SHA-256 need
  read access to the share). Attaching publishes to dailies versions by ATOM's order was tried and dropped: most of
  MUS was bulk-loaded into ATOM on 27–28 June 2024, and some shots have automated cache republishes (up to v1481).
- **Artist:** the publisher (a publish version: the newest publisher) when imported and active; otherwise none, and
  the ATOM id stays in `publishing_info.atom`.
- **`publishing_info.atom`:** publish uid, step uid, name, stream, ATOM version and status, date, publisher id, and
  every component's path (`review`, `review_img` for review copies); `file_path` is the scene (`source`).
- **Resolution, fps and colour space** are the project's (a version's defaults are 4K and ACEScg).
- **Date:** the API stamps a version with the moment it is made, and a shot's current version (D-16: latest
  published, else latest created) would then follow the import's order. `run.py` gives every version from ATOM its
  ATOM date as `created_at` (the publish's; a publish version's newest). ATOM's dates carry no zone and are
  Asia/Kolkata time.
- **Not done:** review copies (the share is not readable from the server, and `PUBLISHING_STORAGE_MOUNTS` and
  review media are off in development), registering files, ATOM's notes (unlinked, ShotGrid-synced test messages).
  For registering files, the file types `json`, `wav`, `atom` and `rs` were added to the catalogue and a storage
  root `ASE` (`/ASE/01prj`) created by hand; a component with no extension is a frame-sequence folder.

## Studio setup

`studio.py`, each `KIND` with `STEP=dry` first; all skip what is there.
- `KIND=departments`: Layout, Animation, Modeling, Texturing and Look Development, Rigging and Matchmove types get
  their department; Vatika (shot-level environment work) goes with Set Dressing in Layout.
- `KIND=templates`: Animation series shot, VFX shot, Character, Prop and Environment asset, studio-wide, with MUS's
  median hours (0 where MUS has no such step).
- `KIND=workflows PROJECT=MUS`: a two-stage review, an animation series shot pipeline and a character asset pipeline.

Done by hand for MUS, not scripted: the catalog task types Previz, CFX, Vatika, Render and Set Dressing, the studio
calendar (Monday to Friday, 8 hours, Asia/Kolkata), and 58 episode-delivery milestones.

## What the builders decide

These were MUS's choices; change `build.py` if another project needs different ones.

- **Codes** are `<CODE>_` plus ATOM's names, upper case: episode `MUS_100`, sequence `MUS_100_001`,
  shot `MUS_100_001_0010` (at most 30 characters), asset `MUS_ALFREDARMOR` (at most 50).
- **Asset codes** that clash case-insensitively (ATOM has `papersheetSet` and `paperSheetSet`) give the second `_2`
  (MUS: 3 assets).
- **Names** are ATOM's, unchanged. **Status** is `Not Started` (`--status` to change).
- **Dates:** ATOM fills a missing date with the day it is read, as both start and due. Such dates are dropped;
  real ones go to the episode's delivery date and to `metadata` (`atom_start_date`, `atom_due_date`), with
  `atom_uid` and `atom_bid_days`. Shots and assets have no `metadata`.
- **Shots** keep ATOM's first and last frame, with 0 handles.
- **Asset types:** Character, Prop and Vehicle map to themselves; Set becomes Environment with catalog type `set`.
  Another ATOM type stops the build until it is added to `ASSET_TYPES`. Software, file format and description are blank.
- **Links** come from each ATOM shot's `assets` list, quantity 1, blank notes. There is no bulk route, so it is
  one request per link (MUS: about 33 minutes); a rerun skips links already there.
- **Batches** hold at most 500 rows (CR-48), cut so an episode's sequences or a sequence's shots stay together.

Only an episodic project (MUS) has been imported. A standard project's sequences have no episode, and `build.py`
then codes them `<CODE>_<name>`; check its ATOM data before relying on that.
