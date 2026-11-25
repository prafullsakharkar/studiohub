"""Turn the files saved by fetch.py into studiohub bulk payloads. Reads and writes local files only.

    python3 scripts/atom/build.py <episodes|sequences|shots|assets|links> --data ~/atom-data/mus --project-id <uuid>
    python3 scripts/atom/build.py tasks --data ~/atom-data/mus --project-id <uuid> --users ~/atom-data/users [--per-step 100]
    python3 scripts/atom/build.py bids --data ~/atom-data/mus --project-id <uuid>
    python3 scripts/atom/build.py <versions|publish-versions> --data ~/atom-data/mus --project-id <uuid> --users ~/atom-data/users

Writes ``<data>/payloads/<kind>.json``. Codes are ``<CODE>_...`` in upper case (CR-49):
episode ``MUS_100``, sequence ``MUS_100_001``, shot ``MUS_100_001_0010``, asset ``MUS_ALFREDARMOR``.
Bulk rows are cut into batches of at most 500 (CR-48), at episode or sequence boundaries so a parent and its
children stay together. ATOM fills a missing date with the day it is read (``fetched_on`` in ``_fetched.json``,
as both start and due); such dates are dropped. ``tasks`` and ``bids`` need ``fetch.py --work``; ``tasks`` also
needs the people import's ``user_map.json`` and ``users.json`` (``--users``). ``versions`` (dailies) and
``publish-versions`` need ``fetch.py --publishes`` and ``--users``; ``publish-versions`` also ``fetch.py --work``.
"""

import argparse
import json
import re
import statistics
import sys
from collections import Counter, defaultdict
from itertools import groupby
from pathlib import Path

LIMIT = 500
SHOT_CODE_MAX = 30
CODE_MAX = 50
# ATOM asset type -> (studiohub category, catalog asset type code).
ASSET_TYPES = {
    "Character": ("Character", "character"),
    "Prop": ("Prop", "prop"),
    "Vehicle": ("Vehicle", "vehicle"),
    "Set": ("Environment", "set"),
}


def load(data: Path, name: str):
    return json.loads((data / name).read_text())


def batched(groups: list[list[dict]]) -> list[list[dict]]:
    """Batches of at most LIMIT rows, never splitting a group unless the group alone is bigger."""
    batches, current = [], []
    for rows in groups:
        if current and len(current) + len(rows) > LIMIT:
            batches.append(current)
            current = []
        current.extend(rows)
        while len(current) > LIMIT:
            batches.append(current[:LIMIT])
            current = current[LIMIT:]
    if current:
        batches.append(current)
    return batches


def tail(uid: str) -> str:
    """``mus:100:001`` -> ``100_001`` (the uid without the project slug)."""
    return uid.split(":", 1)[1].replace(":", "_")


def real_dates(row: dict, filled: str) -> bool:
    return not (row.get("start_date") == filled and row.get("due_date") == filled)


def episodes(data, meta, project_id, status):
    prefix, filled = meta["code"].upper(), meta["fetched_on"]
    create, dates = [], []
    for e in load(data, "episodes.json"):
        code = f"{prefix}_{e['name'].upper()}"
        metadata = {"atom_uid": e["uid"], "atom_bid_days": e.get("bid_days")}
        if real_dates(e, filled):
            metadata["atom_start_date"] = e["start_date"]
            dates.append({"project_id": project_id, "code": code, "delivery_date": e["due_date"]})
        create.append(
            {
                "project_id": project_id,
                "code": code,
                "name": e["name"],
                "status": status,
                "metadata": metadata,
            }
        )
    assert len({r["code"] for r in create}) == len(create), "episode codes not unique"
    print(f"create rows: {len(create)}, date rows: {len(dates)}")
    print("no real dates:", [r["code"] for r in create if "atom_start_date" not in r["metadata"]])
    return {"create": create, "dates": dates}


def sequences(data, meta, project_id, status):
    prefix, filled = meta["code"].upper(), meta["fetched_on"]
    items = load(data, "sequences.json")
    groups = []
    for episode, group in groupby(
        sorted(items, key=lambda s: (s.get("episode") or "", s["name"])),
        key=lambda s: s.get("episode"),
    ):
        rows = []
        for s in group:
            metadata = {"atom_uid": s["uid"], "atom_bid_days": s.get("bid_days")}
            if real_dates(s, filled):
                metadata["atom_start_date"] = s["start_date"]
                metadata["atom_due_date"] = s["due_date"]
            parent = f"{prefix}_{tail(episode)}".upper() if episode else prefix
            row = {
                "project_id": project_id,
                "code": f"{parent}_{s['name']}".upper(),
                "name": s["name"],
                "status": status,
                "metadata": metadata,
            }
            if episode:
                row["episode_code"] = parent  # resolved to the episode id by run.py
            rows.append(row)
        groups.append(rows)
    batches = batched(groups)
    codes = [r["code"] for b in batches for r in b]
    assert len(codes) == len(set(codes)) == len(items), "sequence codes not unique or rows lost"
    assert max(map(len, codes), default=0) <= CODE_MAX
    print("batches:", [len(b) for b in batches], "total:", len(codes))
    return batches


def shots(data, meta, project_id, status):
    prefix = meta["code"].upper()
    items = load(data, "shots.json")
    groups = []
    for sequence, group in groupby(
        sorted(items, key=lambda s: (s["sequence"], s["name"])), key=lambda s: s["sequence"]
    ):
        sequence_code = f"{prefix}_{tail(sequence)}".upper()
        groups.append(
            [
                {
                    "project_id": project_id,
                    "sequence_code": sequence_code,  # resolved to the sequence id by run.py
                    "code": f"{sequence_code}_{s['name']}".upper(),
                    "name": s["name"],
                    "status": status,
                    "frame_in": s["start_frame"],
                    "frame_out": s["end_frame"],
                    "handle_frames": 0,
                }
                for s in group
            ]
        )
    batches = batched(groups)
    codes = [r["code"] for b in batches for r in b]
    assert len(codes) == len(set(codes)) == len(items), "shot codes not unique or rows lost"
    longest = max(codes, key=len, default="")
    assert len(longest) <= SHOT_CODE_MAX, f"shot code longer than {SHOT_CODE_MAX}: {longest}"
    print("batches:", len(batches), "total:", len(codes))
    return batches


def asset_rows(data, meta, project_id, status):
    """(ATOM uid, studiohub row) per asset. A code that clashes case-insensitively with an earlier one gets ``_2``."""
    prefix = meta["code"].upper()
    seen, out, suffixed = set(), [], []
    for a in load(data, "assets.json"):
        code = f"{prefix}_{a['name']}".upper()
        if code in seen:
            code = f"{code}_2"
            suffixed.append(code)
        assert code not in seen, f"asset code still clashes: {code}"
        seen.add(code)
        if a["asset_type"] not in ASSET_TYPES:
            sys.exit(f"ATOM asset type {a['asset_type']!r} has no mapping in ASSET_TYPES")
        category, type_code = ASSET_TYPES[a["asset_type"]]
        out.append(
            (
                a["uid"],
                {
                    "project_id": project_id,
                    "code": code,
                    "name": a["name"],
                    "category": category,
                    "asset_type_id": type_code,
                    "status": status,
                    "software": "",
                    "file_format": "",
                },
            )
        )
    assert max((len(r["code"]) for _, r in out), default=0) <= CODE_MAX
    return out, suffixed


def assets(data, meta, project_id, status):
    rows, suffixed = asset_rows(data, meta, project_id, status)
    batches = [[r for _, r in rows[i : i + LIMIT]] for i in range(0, len(rows), LIMIT)]
    print("batches:", [len(b) for b in batches], "total:", len(rows))
    print("suffixed _2:", suffixed)
    return batches


def links(data, meta, project_id, status):
    """Sorted [shot code, asset code] pairs from each ATOM shot's ``assets`` list."""
    rows, _ = asset_rows(data, meta, project_id, status)
    by_uid = {uid: row["code"] for uid, row in rows}
    prefix = meta["code"].upper()
    pairs, unknown = set(), set()
    for s in load(data, "shots.json"):
        shot_code = f"{prefix}_{tail(s['sequence'])}_{s['name']}".upper()
        for uid in s.get("assets") or []:
            if uid in by_uid:
                pairs.add((shot_code, by_uid[uid]))
            else:
                unknown.add(uid)
    print(
        "links:",
        len(pairs),
        "| shots with links:",
        len({p[0] for p in pairs}),
        "| unknown asset uids:",
        len(unknown),
    )
    return sorted(pairs)


# ATOM step name -> catalog task type code. A step name not here stops the build.
STEP_TYPES = {
    "Layout": "layout", "Scout": "layout", "Previz": "previz",
    "Animation": "animation", "Refine Animation": "animation", "Anim Tech Check": "animation",
    "Lighting": "lighting", "PreLighting": "lighting", "Render": "render",
    "FX": "fx", "Compositing": "comp", "Shot Finaling": "comp", "Vatika": "vatika",
    "CFX": "cfx", "Cloth": "cfx", "Shave Hair": "cfx",
    "Modeling": "modeling", "Texturing": "texturing", "Anim Texture": "texturing",
    "Rigging": "rigging", "Blend Shape": "rigging", "Layout Rig": "rigging", "Rig Test": "rigging",
    "Set Dressing": "set-dressing", "Foliage": "set-dressing", "Proxy Set": "set-dressing",
}  # fmt: skip
# ATOM step status -> studiohub task status (ATOM's own is kept in the task's workflow JSON).
STEP_STATUSES = {
    "Ready To Start": "Not Started", "Not Started": "Not Started", "Waiting To Start": "Not Started",
    "In Progress": "In Progress", "Outsource": "In Progress",
    "Pending Internal Review": "Pending Review", "Pending Client Review": "Pending Review",
    "Client Approved": "Approved", "Internal Approved": "Approved", "Final Publish": "Approved",
    "Closed": "Approved", "Ready To Upload": "Approved", "Ready To Publish": "Approved",
    "Client Reject": "Retake", "Internal Reject": "Retake", "Omitted": "Archived",
}  # fmt: skip
TASK_CODE_UNSAFE = re.compile(r"[^A-Z0-9_-]+")


def work(data):
    """Steps, tasks per step uid, ATOM status names, and the days ATOM filled in (the days it was read)."""
    steps = load(data, "steps.json")
    by_step = defaultdict(list)
    for t in load(data, "tasks.json"):
        by_step[t["step"]].append(t)
    statuses = {s["id"]: s["name"] for s in load(data, "statuses.json")}
    filled = {load(data, "_work.json")["fetched_on"], load(data, "_fetched.json")["fetched_on"]}
    return steps, by_step, statuses, filled


def step_entity(step, prefix, asset_codes):
    """(entity type, studiohub code) of the shot, asset or sequence an ATOM step is on."""
    if step.get("shot"):
        sequence, name = step["shot"].rsplit(":", 1)
        return "Shot", f"{prefix}_{tail(sequence)}_{name}".upper()
    if step.get("asset"):
        return "Asset", asset_codes[step["asset"]]
    return "Sequence", f"{prefix}_{tail(step['sequence'])}".upper()


def tasks(data, meta, project_id, users_dir, per_step):
    """
    One task per ATOM step (at most ``per_step`` per step name, by entity code), coded like a template's
    ``<entity code>_<TYPE>`` (44 characters, then ``_2``...). Assignee: the step's latest ATOM task's artist when
    that person is imported and active (they are added to the project: an assignee must be a member). Hours: the
    step's task bids (minutes). ATOM's status, approvals, retakes and artist ids go to ``workflow.atom``; its dates
    to ``schedule``.
    """
    steps, by_step, statuses, filled = work(data)
    unmapped = sorted({s["name"] for s in steps} - STEP_TYPES.keys())
    if unmapped:
        sys.exit(f"ATOM step names with no task type in STEP_TYPES: {unmapped}")
    unknown = sorted(
        {str(statuses.get(s["status"], s["status"])) for s in steps} - STEP_STATUSES.keys()
    )
    if unknown:
        sys.exit(f"ATOM step statuses with no mapping in STEP_STATUSES: {unknown}")
    user_map = json.loads((users_dir / "user_map.json").read_text())
    active = {str(u["id"]): bool(u.get("is_active")) for u in load(users_dir, "users.json")}
    prefix = meta["code"].upper()
    asset_codes = {uid: row["code"] for uid, row in asset_rows(data, meta, project_id, "")[0]}

    def day(value):
        value = (value or "")[:10]
        return value if value and value not in filled else None

    by_name = defaultdict(list)
    for s in steps:
        by_name[s["name"]].append(s)
    rows, members, used, counts = [], set(), set(), Counter()
    for name in sorted(by_name):
        picked = sorted(
            by_name[name], key=lambda s: (step_entity(s, prefix, asset_codes)[1], s["uid"])
        )
        for s in picked[:per_step] if per_step else picked:
            kind, code = step_entity(s, prefix, asset_codes)
            type_code = STEP_TYPES[name]
            base = TASK_CODE_UNSAFE.sub("-", f"{code}_{type_code}".upper()).strip("-_")[:44]
            task_code, n = base, 1
            while task_code in used:
                n += 1
                task_code = f"{base}_{n}"
            used.add(task_code)
            its = sorted(
                by_step.get(s["uid"], []), key=lambda t: (t["created_at"], t["version_number"])
            )
            latest = its[-1] if its else None
            entry = (user_map.get(str(latest["user"])) or {}) if latest else {}
            assignee = (
                entry.get("user_id")
                if entry.get("done") and active.get(str(latest["user"]))
                else None
            )
            counts[
                "assigned"
                if assignee
                else "no ATOM task"
                if not latest
                else "artist inactive or not imported"
            ] += 1
            if assignee:
                members.add(assignee)
            atom_status = statuses.get(s["status"], str(s["status"]))
            minutes = sum(t.get("bid") or 0 for t in its)
            dates = (
                ("start_date", s.get("start_date")),
                ("end_date", s.get("end_date")),
                ("due_date", s.get("due_date")),
            )
            schedule = {k: day(v) for k, v in dates if day(v)}
            atom = {
                "step_uid": s["uid"],
                "step": name,
                "status": atom_status,
                "sg_status": s.get("sg_status_list") or None,
                "internal_approved_at": s.get("internal_approved_at"),
                "client_approved_at": s.get("client_approved_at"),
                "retakes": s.get("retakes"),
                "client_retakes": s.get("client_retakes"),
                "bid_minutes": minutes,
                "artists": sorted({t["user"] for t in its}),
                "latest_artist": latest["user"] if latest else None,
                "tasks": len(its),
                "latest_version": s.get("sg_latest_version"),
            }
            row = {
                "project_id": project_id,
                "code": task_code,
                "title": name,
                "entity_type": kind,
                "entity_id": code,
                "task_type_id": type_code,
                "status": STEP_STATUSES[atom_status],
                "estimated_hours": round(minutes / 60, 2),
                "schedule": schedule,
                "workflow": {"atom": {k: v for k, v in atom.items() if v is not None}},
            }
            if assignee:
                row["assignee"] = assignee
            if schedule.get("due_date"):
                row["due_date"] = schedule["due_date"]
            rows.append(row)
            counts[f"status {row['status']}"] += 1
    print("tasks:", len(rows), "| step names:", len(by_name), "| members to add:", len(members))
    print(dict(sorted(counts.items())))
    return {
        "members": sorted(members),
        "batches": [rows[i : i + LIMIT] for i in range(0, len(rows), LIMIT)],
    }


def percentile(values, p):
    return values[int(p * (len(values) - 1))] if values else None


def bids(data, meta, project_id):
    """Median, 25th and 75th percentile bid hours per (entity kind, ATOM step name), steps with a bid only."""
    steps, by_step, _, _ = work(data)
    hours, none = defaultdict(list), Counter()
    for s in steps:
        kind = "shot" if s.get("shot") else "asset" if s.get("asset") else "sequence"
        h = sum(t.get("bid") or 0 for t in by_step.get(s["uid"], [])) / 60
        (hours[(kind, s["name"])].append(h) if h > 0 else none.update([(kind, s["name"])]))
    table = []
    for key in sorted(set(hours) | set(none)):
        v = sorted(hours.get(key, []))
        table.append({"kind": key[0], "step": key[1], "with_bid": len(v), "no_bid": none[key],
                      "median_hours": statistics.median(v) if v else None, "p25": percentile(v, 0.25), "p75": percentile(v, 0.75)})  # fmt: skip
        print(
            f"{key[0]:8} {key[1]:18} with bid {len(v):>6}  none {none[key]:>5}  median {table[-1]['median_hours']}"
        )
    return table


# A publish carrying one of these is review media: it becomes a dailies version.
REVIEW_COMPONENTS = {"review_mov", "mov", "review_img"}
# ATOM publish status -> studiohub version status.
PUBLISH_STATUSES = {
    "Pending Internal Review": "Pending Review",
    "Pending Client Review": "Pending Review",
    "Internal Approved": "Approved",
    "Client Approved": "Approved",
    "Internal Reject": "Retake",
    "Client Reject": "Retake",
}


def publishes(data):
    """Every saved publish (``fetch.py --publishes``), grouped by ATOM step uid."""
    by_step = defaultdict(list)
    for line in (data / "publishes.jsonl").read_text().splitlines():
        for p in json.loads(line)["publishes"]:
            by_step[p["step"]].append(p)
    unknown = sorted(
        {str(p["status"]) for ps in by_step.values() for p in ps} - PUBLISH_STATUSES.keys()
    )
    if unknown:
        sys.exit(f"ATOM publish statuses with no mapping in PUBLISH_STATUSES: {unknown}")
    return by_step


def artists(users_dir):
    """ATOM user id -> studiohub user id, for people imported and active."""
    user_map = json.loads((users_dir / "user_map.json").read_text())
    active = {str(u["id"]) for u in load(users_dir, "users.json") if u.get("is_active")}
    return {
        k: v["user_id"]
        for k, v in user_map.items()
        if v.get("done") and v.get("user_id") and k in active
    }


def is_review(p):
    return bool(REVIEW_COMPONENTS & {c["name"] for c in p["components"] or []})


def components(p):
    return {c["name"]: c["location"] for c in p["components"] or []}


def versions(data, meta, project_id, users_dir):
    """
    Dailies: one version per publish carrying review media, on its ATOM step's task (run.py finds the task and codes
    the version ``<task code>_<ATOM publish name>``). Status from ATOM's (PUBLISH_STATUSES), superseded ones too;
    artist: the publisher when imported and active. ATOM's details go to ``publishing_info.atom``.
    """
    by_step, people = publishes(data), artists(users_dir)
    rows = []
    for step, ps in sorted(by_step.items()):
        latest = Counter()
        for p in ps:
            k = (p["asset_type"], p["asset_name"])
            latest[k] = max(latest[k], p["version_number"])
        for p in sorted(ps, key=lambda p: (p["created_at"], p["version_number"])):
            if not is_review(p):
                continue
            comps = components(p)
            rows.append({
                "step_uid": step, "suffix": p["name"], "status": PUBLISH_STATUSES[p["status"]],
                "artist": people.get(str(p["published_by"])), "file_path": comps.get("source", ""), "tags": ["atom"],
                "publishing_info": {"atom": {
                    "publish_uid": p["uid"], "step_uid": step, "name": p["name"],
                    "stream": [p["asset_type"], p["asset_name"]], "version": p["version_number"], "status": p["status"],
                    "published_at": p["created_at"], "published_by": p["published_by"],
                    "superseded": p["version_number"] < latest[(p["asset_type"], p["asset_name"])],
                    "review": comps.get("review_mov") or comps.get("mov") or "", "review_img": comps.get("review_img", ""),
                    "components": comps}},
            })  # fmt: skip
    counts = Counter(r["status"] for r in rows)
    print(f"dailies versions: {len(rows)} on {len({r['step_uid'] for r in rows})} steps", dict(counts),
          f"| with an artist {sum(1 for r in rows if r['artist'])}")  # fmt: skip
    return {"rows": rows}


def publish_versions(data, meta, project_id, users_dir):
    """
    One Approved "publish" version per approved step (its ATOM status maps to Approved, as for tasks) that has no
    review media, holding the step's current set (the latest publish of each stream) in
    ``publishing_info.atom.current_set``; coded ``<task code>_PUBLISH`` by run.py. Not marked published: that
    waits for its files to be registered.
    """
    by_step, people = publishes(data), artists(users_dir)
    steps, _, statuses, _ = work(data)
    approved = {
        s["uid"] for s in steps if STEP_STATUSES.get(statuses.get(s["status"], "")) == "Approved"
    }
    rows = []
    for step, ps in sorted(by_step.items()):
        if step not in approved or any(is_review(p) for p in ps):
            continue
        current = {}
        for p in ps:
            k = (p["asset_type"], p["asset_name"])
            if k not in current or p["version_number"] > current[k]["version_number"]:
                current[k] = p
        current = sorted(current.values(), key=lambda p: (p["asset_type"], p["asset_name"]))
        last = max(current, key=lambda p: p["created_at"])
        scene = next((p for p in current if p["asset_type"] == "Scene"), None)
        rows.append({
            "step_uid": step, "suffix": "PUBLISH", "status": "Approved", "artist": people.get(str(last["published_by"])),
            "file_path": components(scene).get("source", "") if scene else "", "tags": ["atom", "publish"],
            "publishing_info": {"atom": {
                "kind": "publish", "step_uid": step, "rule": "approved step, latest publish of each stream",
                "latest_published_at": last["created_at"],
                "current_set": [{"publish_uid": p["uid"], "name": p["name"], "stream": [p["asset_type"], p["asset_name"]],
                                 "version": p["version_number"], "status": p["status"], "published_at": p["created_at"],
                                 "published_by": p["published_by"], "components": components(p)} for p in current]}},
        })  # fmt: skip
    files = sum(
        len(p["components"]) for r in rows for p in r["publishing_info"]["atom"]["current_set"]
    )
    print(f"publish versions: {len(rows)} | streams {sum(len(r['publishing_info']['atom']['current_set']) for r in rows)}"
          f" | components {files}", dict(Counter(r["step_uid"].rsplit(":", 1)[1] for r in rows)))  # fmt: skip
    return {"rows": rows}


KINDS = {
    "episodes": episodes,
    "sequences": sequences,
    "shots": shots,
    "assets": assets,
    "links": links,
    "tasks": tasks,
    "bids": bids,
    "versions": versions,
    "publish-versions": publish_versions,
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("kind", choices=KINDS)
    parser.add_argument("--data", required=True, type=Path, help="folder written by fetch.py")
    parser.add_argument("--project-id", required=True, help="the studiohub project's id")
    parser.add_argument("--status", default="Not Started", help="status of every new row")
    parser.add_argument(
        "--users", type=Path, help="tasks: folder with user_map.json and users.json"
    )
    parser.add_argument(
        "--per-step", type=int, default=0, help="tasks: at most this many per ATOM step name"
    )
    args = parser.parse_args()

    data = args.data.expanduser()
    meta = load(data, "_fetched.json")
    if args.kind in ("tasks", "versions", "publish-versions") and not args.users:
        parser.error(f"{args.kind} needs --users")
    if args.kind == "tasks":
        result = tasks(data, meta, args.project_id, args.users.expanduser(), args.per_step)
    elif args.kind in ("versions", "publish-versions"):
        result = KINDS[args.kind](data, meta, args.project_id, args.users.expanduser())
    elif args.kind == "bids":
        result = bids(data, meta, args.project_id)
    else:
        result = KINDS[args.kind](data, meta, args.project_id, args.status)
    out = data / "payloads" / f"{args.kind}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(result, indent=1))
    print("written:", out)


if __name__ == "__main__":
    main()
