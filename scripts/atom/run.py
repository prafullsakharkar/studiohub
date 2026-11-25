"""Write a built payload to studiohub through its own API, or check what is there. Run inside ``manage.py shell``:

    cd backend && KIND=shots STEP=dry PROJECT=MUS PAYLOADS=~/atom-data/mus/payloads/shots.json \\
        DJANGO_ENV=local uv run python manage.py shell < ../scripts/atom/run.py

Requests go through DRF's APIClient as ADMIN_EMAIL (default admin@studiohub.local), so every serializer,
validator and permission the UI meets applies. Nothing here talks to ATOM.

KIND      project | episodes | sequences | shots | assets | links | tasks | versions | publish-versions | publish | verify
STEP      dry (bulk trial runs, nothing saved) | real (one batch at a time, stop at the first that does not commit)
PROJECT   the studiohub project code (not needed for KIND=project)
PAYLOADS  build.py's output; for KIND=project a JSON file with the project's fields; for KIND=verify the data folder
BATCHES   optional comma list of 1-based batch numbers
SHOTS     KIND=links: optional comma list of shot codes to limit the run to
ONLY      KIND=publish: optional comma list of shot and asset codes to limit the run to
UNDO=1    KIND=publish: unpublish what KIND=publish published (files_registered false)
ERRORS    KIND=links: JSON-lines file for failed links (default <payloads>.errors.jsonl)
ARCHIVE_EP101=1   KIND=episodes, real: archive the EP101 studiohub makes for a new episodic project

KIND=tasks (build.py tasks): a real run first adds the assignees as project members (studiohub assigns a task only to
an active member; a new member is an Artist), then skips the ATOM steps the project already has (matched by
workflow.atom.step_uid, not by code), gives a new step whose code is taken the next free _N, and bulk-creates the rest.
A dry run cannot see members it has not added, so it leaves those assignees out and checks everything else.

KIND=versions / publish-versions (build.py): one POST per version, on the task of its ATOM step, coded
``<task code>_<suffix>``; existing codes are skipped. Afterwards every version from ATOM gets its ATOM date as
created_at (the API cannot set it), so a shot's current version is the real latest. A dry run sends nothing.

KIND=publish (no payload): for every task holding versions from ATOM whose status is Approved, publishes its publish
version, else its latest dailies version (by ATOM date), through POST /versions/<id>/publish/. The API publishes
only an Approved version; a latest dailies version ATOM left Pending Review is listed, not changed. Files are not
registered (that needs read access to the share): each is published with ``files_registered: false``. A dry run
sends nothing.
"""

import datetime
import json
import os
import re
import time
from collections import Counter, defaultdict
from pathlib import Path
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.production.models import (
    Asset,
    Episode,
    Project,
    ProjectMembership,
    Sequence,
    Shot,
    ShotAsset,
    Task,
    Version,
)

# ATOM's dates carry no zone; they are the studio's local time.
ATOM_TZ = ZoneInfo("Asia/Kolkata")

KIND = os.environ["KIND"]
STEP = os.environ.get("STEP", "dry")
assert STEP in ("dry", "real"), "STEP is dry or real"
dry = STEP == "dry"
payloads = Path(os.environ.get("PAYLOADS", "")).expanduser()  # KIND=publish needs none
wanted_batches = [int(n) for n in os.environ.get("BATCHES", "").split(",") if n]

client = APIClient(SERVER_NAME="localhost")
client.force_authenticate(
    user=get_user_model().objects.get(email=os.environ.get("ADMIN_EMAIL", "admin@studiohub.local"))
)


def report(label, response):
    body = response.json()
    results = (body.get("results") or body.get("items") or []) if isinstance(body, dict) else []
    statuses = (
        Counter(str(r.get("status")) for r in results) if isinstance(results, list) else Counter()
    )
    flags = {k: body.get(k) for k in ("dry_run", "committed")} if isinstance(body, dict) else {}
    print(f"{label}: HTTP {response.status_code}", flags, dict(statuses), flush=True)
    errors = body.get("errors") if isinstance(body, dict) else None
    if errors:
        print("  errors:", json.dumps(errors)[:2000], flush=True)
    elif response.status_code >= 400:
        print("  body:", json.dumps(body)[:2000], flush=True)
    return body


def bulk(route, batches, resolve=None):
    """POST each batch to ``route`` (bulk create, atomic); stop at the first real batch that does not commit."""
    for number in wanted_batches or range(1, len(batches) + 1):
        items = [resolve(dict(row)) if resolve else dict(row) for row in batches[number - 1]]
        started = time.monotonic()
        response = client.post(
            route, {"items": items, "dry_run": dry, "atomic": True}, format="json"
        )
        body = report(
            f"batch {number} ({len(items)} rows, {items[0]['code']}..{items[-1]['code']}, {time.monotonic() - started:.1f}s)",
            response,
        )
        if not dry and not body.get("committed"):
            print(f"stopping: batch {number} did not commit")
            break


if KIND == "project":
    fields = json.loads(payloads.read_text())
    taken = (
        Project.all_objects.filter(code__iexact=fields["code"]).exists()
        if hasattr(Project, "all_objects")
        else Project.objects.filter(code__iexact=fields["code"]).exists()
    )
    print("code", fields["code"], "already taken" if taken else "free")
    if not dry and not taken:
        response = client.post("/api/v1/projects/", fields, format="json")
        body = response.json()
        print(
            "HTTP",
            response.status_code,
            json.dumps(
                {k: body.get(k) for k in ("id", "code", "workflow_type", "status")}
                if response.status_code < 300
                else body
            )[:2000],
        )
        auto = Episode.objects.filter(project__code=fields["code"], code="EP101").exists()
        print(
            "auto-created EP101:",
            auto,
            "(archive it with KIND=episodes ARCHIVE_EP101=1 if unwanted)" if auto else "",
        )
    raise SystemExit

project = Project.objects.get(code=os.environ["PROJECT"])

if KIND == "episodes":
    data = json.loads(payloads.read_text())
    create = report(
        "bulk-create",
        client.post(
            "/api/v1/episodes/bulk-create/",
            {"items": data["create"], "dry_run": dry, "atomic": True},
            format="json",
        ),
    )
    if dry:
        print("bulk-update (dates): runs after the real create;", len(data["dates"]), "rows ready")
    elif create.get("committed"):
        if data["dates"]:
            report(
                "bulk-update (dates)",
                client.post(
                    "/api/v1/episodes/bulk-update/",
                    {"items": data["dates"], "dry_run": False, "atomic": True},
                    format="json",
                ),
            )
        ep101 = Episode.objects.filter(project=project, code="EP101").first()
        if ep101 is not None and os.environ.get("ARCHIVE_EP101") == "1":
            archive = client.post(
                "/api/v1/episodes/bulk-archive/", {"ids": [str(ep101.pk)]}, format="json"
            )
            print("archive EP101: HTTP", archive.status_code)
    live = Episode.objects.filter(project=project)
    print(
        "live episodes:",
        live.count(),
        "| with a delivery date:",
        live.exclude(delivery_date=None).count(),
    )

elif KIND == "sequences":
    episode_ids = {e.code: str(e.pk) for e in Episode.objects.filter(project=project)}

    def resolve(item):
        if "episode_code" in item:
            item["episode_id"] = episode_ids[item.pop("episode_code")]
        return item

    bulk("/api/v1/sequences/bulk-create/", json.loads(payloads.read_text()), resolve)
    print("live sequences:", Sequence.objects.filter(project=project).count())

elif KIND == "shots":
    sequence_ids = {s.code: str(s.pk) for s in Sequence.objects.filter(project=project)}

    def resolve(item):
        item["sequence_id"] = sequence_ids[item.pop("sequence_code")]
        return item

    bulk("/api/v1/shots/bulk-create/", json.loads(payloads.read_text()), resolve)
    print("live shots:", Shot.objects.filter(project=project).count())

elif KIND == "assets":
    bulk("/api/v1/assets/bulk-create/", json.loads(payloads.read_text()))
    print("live assets:", Asset.objects.filter(project=project).count())

elif KIND == "links":
    # One POST per link (there is no bulk route). A link already there is skipped without a request and an
    # "already linked" answer counts as done, so a rerun is safe. STEP=dry only counts what would be sent.
    pairs = json.loads(payloads.read_text())
    only = {s for s in os.environ.get("SHOTS", "").split(",") if s}
    errors_path = Path(os.environ.get("ERRORS") or f"{payloads}.errors.jsonl").expanduser()
    shot_ids = {
        code: str(pk) for code, pk in Shot.objects.filter(project=project).values_list("code", "pk")
    }
    asset_ids = {
        code: str(pk)
        for code, pk in Asset.objects.filter(project=project).values_list("code", "pk")
    }
    existing = set(
        ShotAsset.objects.filter(project=project).values_list("shot__code", "asset__code")
    )
    by_shot = defaultdict(list)
    for shot_code, asset_code in pairs:
        if not only or shot_code in only:
            by_shot[shot_code].append(asset_code)
    todo = sum(len(v) for v in by_shot.values())
    missing = sorted(
        {s for s in by_shot if s not in shot_ids}
        | {a for v in by_shot.values() for a in v if a not in asset_ids}
    )
    print(
        f"{todo} links to make, {len(existing)} already in studiohub, {len(missing)} codes not in studiohub",
        missing[:10],
        flush=True,
    )
    counts, started = Counter(), time.monotonic()
    if not dry and not missing:
        with open(errors_path, "a") as errors:
            for shot_code in sorted(by_shot):
                for asset_code in by_shot[shot_code]:
                    if (shot_code, asset_code) in existing:
                        counts["already there"] += 1
                        continue
                    response = client.post(
                        f"/api/v1/shots/{shot_ids[shot_code]}/assets/",
                        {"asset_id": asset_ids[asset_code], "quantity": 1, "notes": ""},
                        format="json",
                    )
                    if response.status_code == 201:
                        counts["linked"] += 1
                    elif (
                        response.status_code == 400
                        and "already" in response.content.decode(errors="replace").lower()
                    ):
                        counts["already linked"] += 1
                    else:
                        counts["failed"] += 1
                        errors.write(
                            json.dumps(
                                {
                                    "shot": shot_code,
                                    "asset": asset_code,
                                    "status": response.status_code,
                                    "body": response.content.decode(errors="replace")[:500],
                                }
                            )
                            + "\n"
                        )
                    done = sum(counts.values())
                    if done % 1000 == 0:
                        print(
                            f"{done}/{todo} {dict(counts)} {done / (time.monotonic() - started):.1f}/s",
                            flush=True,
                        )
        print(
            f"done {sum(counts.values())}/{todo}",
            dict(counts),
            f"{time.monotonic() - started:.0f}s",
            "| failures in",
            errors_path,
        )
    print("links in studiohub:", ShotAsset.objects.filter(project=project).count())

elif KIND == "tasks":
    payload = json.loads(payloads.read_text())
    members = set(
        str(u)
        for u in ProjectMembership.objects.filter(project=project, status="active").values_list(
            "user_id", flat=True
        )
    )
    to_add = [m for m in payload["members"] if m not in members]
    print("members: wanted", len(payload["members"]), "| to add", len(to_add), flush=True)
    if not dry:
        added = Counter()
        for user_id in to_add:
            # The project-scoped routes live at /api/organizations/projects/<id>/... (no /v1/).
            response = client.post(
                f"/api/organizations/projects/{project.pk}/members/",
                {"user_id": user_id},
                format="json",
            )
            added[response.status_code] += 1
            if response.status_code not in (200, 201):
                print("  member failed:", response.status_code, response.content[:300])
        print("member responses:", dict(added))
    # Existing tasks are matched by ATOM step, not by code: a pilot (--per-step) hands out ``_2`` codes in another
    # order than a full build, so a code can name a different step. A step already there is skipped; a new step
    # whose code is taken gets the next free ``_N``.
    existing = list(Task.all_objects.filter(project=project).values_list("code", "workflow"))
    have_codes = {code.upper() for code, _ in existing}
    have_steps = {((w or {}).get("atom") or {}).get("step_uid") for _, w in existing} - {None}
    new_batches = [
        [row for row in batch if row["workflow"]["atom"]["step_uid"] not in have_steps]
        for batch in payload["batches"]
    ]
    skipped = sum(len(b) for b in payload["batches"]) - sum(len(b) for b in new_batches)
    taken = have_codes | {r["code"].upper() for b in new_batches for r in b}
    batches, recoded = [], 0
    for batch in new_batches:
        rows = []
        for row in batch:
            if row["code"].upper() in have_codes:
                base, n = re.sub(r"_\d+$", "", row["code"]), 2
                while f"{base}_{n}".upper() in taken:
                    n += 1
                row = {**row, "code": f"{base}_{n}"}
                taken.add(row["code"].upper())
                recoded += 1
            if dry and row.get("assignee") in to_add:
                row = {k: v for k, v in row.items() if k != "assignee"}
            rows.append(row)
        if rows:
            batches.append(rows)
    print(
        f"steps already in studiohub: {skipped} | to create: {sum(len(b) for b in batches)} in {len(batches)} batches"
        f" | given a free code: {recoded}"
    )
    bulk("/api/v1/tasks/bulk-create/", batches)
    live = Task.objects.filter(project=project)
    print(
        "live tasks:",
        live.count(),
        "| assigned:",
        live.exclude(assignee=None).count(),
        "| by status:",
        dict(Counter(live.values_list("status", flat=True))),
    )

elif KIND in ("versions", "publish-versions"):
    # One POST per version (there is no bulk route). The task is found by ATOM step; the code is
    # ``<task code>_<suffix>``; a code already in the project is skipped, so a rerun is safe. A publish version is
    # made only while its task is Approved. STEP=dry sends nothing and counts what a real run would do.
    rows = json.loads(payloads.read_text())["rows"]
    tasks = {
        ((w or {}).get("atom") or {}).get("step_uid"): (pk, code, status, department)
        for pk, code, status, department, w in Task.objects.filter(project=project).values_list(
            "pk", "code", "status", "department", "workflow"
        )
    }
    have = {
        c.upper()
        for c in Version.all_objects.filter(project=project).values_list("code", flat=True)
    }
    active = {
        str(pk)
        for pk in get_user_model().objects.filter(is_active=True).values_list("pk", flat=True)
    }
    extra = {
        "resolution": project.resolution,
        "fps": str(project.fps),
        "color_space": project.color_space,
    }
    counts, started = Counter(), time.monotonic()
    for row in rows:
        task = tasks.get(row["step_uid"])
        if task is None:
            counts["no task for the ATOM step"] += 1
            continue
        task_id, task_code, task_status, department = task
        if KIND == "publish-versions" and task_status != "Approved":
            counts["task no longer Approved"] += 1
            continue
        code = f"{task_code}_{row['suffix']}".upper()
        if code in have:
            counts["already there"] += 1
            continue
        body = {
            "project_id": str(project.pk), "task": str(task_id), "code": code, "status": row["status"],
            "artist": row["artist"] if row["artist"] in active else None, "department": department or "",
            "file_path": row["file_path"], "tags": row["tags"], "publishing_info": row["publishing_info"], **extra,
        }  # fmt: skip
        if dry:
            counts["would create"] += 1
            have.add(code)
            continue
        response = client.post("/api/v1/versions/", body, format="json")
        if response.status_code == 201:
            counts["created"] += 1
            have.add(code)
        else:
            counts["failed"] += 1
            print(
                "  failed:",
                code,
                response.status_code,
                response.content.decode(errors="replace")[:500],
            )
    print(dict(counts), f"{time.monotonic() - started:.0f}s", flush=True)
    # The API stamps a version with the moment it is made, so a shot's current version (D-16: latest published,
    # else latest created) would follow the import's order. Every version from ATOM gets its ATOM date instead
    # (the publish's, or a publish version's newest); only created_at changes.
    dated = Counter()
    for pk, created, info in Version.all_objects.filter(
        project=project, publishing_info__has_key="atom"
    ).values_list("pk", "created_at", "publishing_info"):
        atom = info["atom"]
        raw = atom.get("published_at") or atom.get("latest_published_at")
        if not raw:
            continue
        when = datetime.datetime.fromisoformat(raw).replace(tzinfo=ATOM_TZ)
        if created == when:
            dated["date already ATOM's"] += 1
        elif dry:
            dated["date to set"] += 1
        else:
            Version.all_objects.filter(pk=pk).update(created_at=when)
            dated["date set"] += 1
    print("dates:", dict(dated))
    live = Version.objects.filter(project=project)
    print(
        "live versions:",
        live.count(),
        "| by status:",
        dict(Counter(live.values_list("status", flat=True))),
    )

elif KIND == "publish":
    # The approved publishing rule: an approved step publishes its current set. A step without review media has a
    # publish version holding that set; otherwise the set goes on the step's latest dailies version. The publish
    # action merges its body into publishing_info one level deep, so the body never carries an ``atom`` key.
    only = {c.upper() for c in os.environ.get("ONLY", "").split(",") if c}
    versions = Version.objects.filter(
        project=project, publishing_info__has_key="atom"
    ).select_related("task", "shot", "asset")
    if only:
        versions = [
            v for v in versions if (v.shot or v.asset) and (v.shot or v.asset).code.upper() in only
        ]
    counts, todo = Counter(), []
    if os.environ.get("UNDO") == "1":
        todo = [
            v
            for v in versions
            if v.is_published and v.publishing_info.get("files_registered") is False
        ]
        for v in todo:
            if dry:
                counts["would unpublish"] += 1
                continue
            response = client.post(f"/api/v1/versions/{v.pk}/unpublish/", {}, format="json")
            counts[
                "unpublished" if response.status_code == 200 else f"HTTP {response.status_code}"
            ] += 1
        print("undo:", dict(counts))
        raise SystemExit
    by_task = defaultdict(list)
    for v in versions:
        by_task[v.task_id].append(v)
    for its in by_task.values():
        task = its[0].task
        if task is None or task.status != "Approved":
            counts[f"task {task.status if task else 'missing'}: left alone"] += 1
            continue
        publish = [v for v in its if v.publishing_info["atom"].get("kind") == "publish"]
        dailies = sorted((v for v in its if v not in publish), key=lambda v: (v.created_at, v.pk))
        pick = publish[0] if publish else dailies[-1]
        kind = "publish version" if publish else "latest dailies"
        if pick.is_published:
            counts[f"{kind}: already published"] += 1
        elif pick.status != "Approved":
            counts[f"{kind}: {pick.status}, not publishable"] += 1
            print(f"  not publishable ({pick.status}): {pick.code}")
        else:
            todo.append(pick)
            counts[f"{kind}: to publish"] += 1
    print(dict(sorted(counts.items())), flush=True)
    body = {
        "publishing_info": {
            "comment": "Published from ATOM: approved step, its latest dailies or current set. "
            "Files not registered yet (the share is not readable).",
            "files_registered": False,
        }
    }
    sent = Counter()
    for v in [] if dry else todo:
        before = v.publishing_info["atom"]
        response = client.post(f"/api/v1/versions/{v.pk}/publish/", body, format="json")
        if response.status_code != 200:
            sent["failed"] += 1
            print(
                "  failed:",
                v.code,
                response.status_code,
                response.content.decode(errors="replace")[:300],
            )
            continue
        v.refresh_from_db()
        sent[
            "published"
            if v.publishing_info.get("atom") == before
            else "PUBLISHED, ATOM DETAILS CHANGED"
        ] += 1
    if sent:
        print("sent:", dict(sent))
    live = Version.objects.filter(project=project, publishing_info__has_key="atom")
    print(
        "published versions from ATOM:", live.filter(is_published=True).count(), "of", live.count()
    )

elif KIND == "verify":
    # Read only: what ATOM holds (the data folder) against what studiohub holds now.
    data = payloads
    atom = {
        name: len(json.loads((data / f"{name}.json").read_text()))
        for name in ("episodes", "sequences", "shots", "assets")
    }
    live = {
        "episodes": Episode.objects.filter(project=project).exclude(code="EP101").count(),
        "sequences": Sequence.objects.filter(project=project).count(),
        "shots": Shot.objects.filter(project=project).count(),
        "assets": Asset.objects.filter(project=project).count(),
    }
    for name in atom:
        print(
            f"{name:10} ATOM {atom[name]:>7}  studiohub {live[name]:>7}  {'ok' if atom[name] == live[name] else 'DIFFERENT'}"
        )
    links_file = data / "payloads" / "links.json"
    if links_file.exists():
        expected = {tuple(p) for p in json.loads(links_file.read_text())}
        stored = set(
            ShotAsset.objects.filter(project=project).values_list("shot__code", "asset__code")
        )
        print(
            f"links      ATOM {len(expected):>7}  studiohub {len(stored):>7}  missing {len(expected - stored)}  extra {len(stored - expected)}"
        )
    tasks_file = data / "payloads" / "tasks.json"
    if tasks_file.exists():
        # Matched by ATOM step (codes can differ, see KIND=tasks).
        built = {
            r["workflow"]["atom"]["step_uid"]: r
            for b in json.loads(tasks_file.read_text())["batches"]
            for r in b
        }
        stored = {
            ((t.workflow or {}).get("atom") or {}).get("step_uid"): t
            for t in Task.objects.filter(project=project).select_related(
                "task_type", "shot", "asset", "sequence"
            )
        }
        checks = Counter()
        for step_uid, row in built.items():
            t = stored.get(step_uid)
            if t is None:
                checks["missing"] += 1
                continue
            entity = t.shot or t.asset or t.sequence
            checks[
                "entity ok" if entity and entity.code == row["entity_id"] else "ENTITY DIFFERENT"
            ] += 1
            checks[
                "type ok"
                if t.task_type and t.task_type.code == row["task_type_id"]
                else "TYPE DIFFERENT"
            ] += 1
            checks["status ok" if t.status == row["status"] else "status changed since"] += 1
            checks[
                "assignee ok"
                if str(t.assignee_id or "") == (row.get("assignee") or "")
                else "assignee changed since"
            ] += 1
            checks["atom ok" if t.workflow == row["workflow"] else "WORKFLOW DIFFERENT"] += 1
        print(
            f"tasks      built {len(built):>7}  studiohub {len(stored):>7}  extra {len(stored.keys() - built.keys())}",
            dict(checks),
        )
    codes = {
        ((w or {}).get("atom") or {}).get("step_uid"): code
        for code, w in Task.objects.filter(project=project).values_list("code", "workflow")
    }
    for name in ("versions", "publish-versions"):
        built_file = data / "payloads" / f"{name}.json"
        if not built_file.exists():
            continue
        # Matched by code (<task code>_<suffix>); the ATOM details must be the built ones.
        stored = {v.code: v for v in Version.objects.filter(project=project)}
        checks = Counter()
        for row in json.loads(built_file.read_text())["rows"]:
            v = stored.get(f"{codes.get(row['step_uid'], '?')}_{row['suffix']}".upper())
            if v is None:
                checks["missing"] += 1
                continue
            checks["status ok" if v.status == row["status"] else "status changed since"] += 1
            atom = v.publishing_info.get("atom")
            checks[
                "atom ok" if atom == row["publishing_info"]["atom"] else "ATOM DETAILS DIFFERENT"
            ] += 1
            raw = atom and (atom.get("published_at") or atom.get("latest_published_at"))
            when = raw and datetime.datetime.fromisoformat(raw).replace(tzinfo=ATOM_TZ)
            checks["date ok" if v.created_at == when else "DATE NOT ATOM'S"] += 1
        print(
            f"{name:16} built {sum(checks[k] for k in ('missing', 'status ok', 'status changed since')):>6}",
            dict(checks),
        )

else:
    raise SystemExit(f"unknown KIND {KIND}")
