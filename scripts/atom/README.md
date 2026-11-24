# Importing an ATOM project

These scripts copy one project from ATOM (the studio's older tracker) into studiohub: the project, its
episodes, sequences, shots and assets, and the shot–asset links. They were used for MUS on 2026-11-23/24
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
| `fetch.py` | GETs the ATOM project and its episodes, sequences, shots and assets into a data folder |
| `build.py` | Turns the saved files into studiohub payloads (`<data>/payloads/<kind>.json`); local files only |
| `run.py` | Sends a payload to studiohub (`KIND=project|episodes|sequences|shots|assets|links`) or compares counts (`KIND=verify`) |

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
