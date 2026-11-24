"""Turn the files saved by fetch.py into studiohub bulk payloads. Reads and writes local files only.

    python3 scripts/atom/build.py <episodes|sequences|shots|assets|links> --data ~/atom-data/mus --project-id <uuid>

Writes ``<data>/payloads/<kind>.json``. Codes are ``<CODE>_...`` in upper case (CR-49):
episode ``MUS_100``, sequence ``MUS_100_001``, shot ``MUS_100_001_0010``, asset ``MUS_ALFREDARMOR``.
Bulk rows are cut into batches of at most 500 (CR-48), at episode or sequence boundaries so a parent and its
children stay together. ATOM fills a missing date with the day it is read (``fetched_on`` in ``_fetched.json``,
as both start and due); such dates are dropped.
"""

import argparse
import json
import sys
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


KINDS = {
    "episodes": episodes,
    "sequences": sequences,
    "shots": shots,
    "assets": assets,
    "links": links,
}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("kind", choices=KINDS)
    parser.add_argument("--data", required=True, type=Path, help="folder written by fetch.py")
    parser.add_argument("--project-id", required=True, help="the studiohub project's id")
    parser.add_argument("--status", default="Not Started", help="status of every new row")
    args = parser.parse_args()

    data = args.data.expanduser()
    meta = load(data, "_fetched.json")
    result = KINDS[args.kind](data, meta, args.project_id, args.status)
    out = data / "payloads" / f"{args.kind}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(result, indent=1))
    print("written:", out)


if __name__ == "__main__":
    main()
