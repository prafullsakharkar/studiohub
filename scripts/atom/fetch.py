"""Read one ATOM project into a data folder. Only GET requests are ever sent.

    python3 -I scripts/atom/fetch.py --code MUS --out ~/atom-data/mus
    python3 -I scripts/atom/fetch.py --code MUS --work --out ~/atom-data/mus
    python3 -I scripts/atom/fetch.py --users --out ~/atom-data/users

The key comes from ``ATOM_API_KEY`` in the environment, else from ``backend/.env.local``; it is never printed.
The base URL comes from ``--base``, else ``ATOM_BASE_URL``, else http://192.168.1.128:8085 (spec:
``scripts/ATOM API.yaml``). The folder gets ``project.json``, ``episodes.json``, ``sequences.json``,
``shots.json``, ``assets.json`` and ``_fetched.json`` (code, slug, episodic, and the day it was read: ATOM fills a
missing date with that day, so the builders drop such dates). ``--users`` saves ATOM's user list as ``users.json``
instead, without passwords, API tokens, avatars or settings. ``--work`` (with ``--code``) saves the project's
steps and tasks instead (``steps.json``, ``tasks.json``, ``statuses.json``, ``_work.json``): per episode from ATOM's
episode routes, which are fast, then whatever is left by id, 50 per request, each piece kept in ``parts/`` so a
stopped run resumes. People are kept as ATOM user ids only, but a task's uid and name hold the artist's name. The
saved files hold people's names and emails: keep the folder outside the repository.
"""

import argparse
import datetime
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

DEFAULT_BASE = "http://192.168.1.128:8085"
ENV_FILE = Path(__file__).resolve().parents[2] / "backend" / ".env.local"


def api_key() -> str:
    key = os.environ.get("ATOM_API_KEY", "")
    if not key and ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if line.startswith("ATOM_API_KEY="):
                key = line.split("=", 1)[1].strip().strip("'\"")
    if not key:
        sys.exit("ATOM_API_KEY is not set (environment or backend/.env.local)")
    return key


def get(base: str, key: str, path: str, params: dict | None = None, timeout: int = 600):
    """One GET; the only kind of request this script makes."""
    url = f"{base}{path}" + (f"?{urllib.parse.urlencode(params)}" if params else "")
    if urllib.parse.urlsplit(url).scheme not in ("http", "https"):
        sys.exit(f"not an http(s) URL: {base}")
    request = urllib.request.Request(  # noqa: S310 - the scheme is checked just above
        url, method="GET", headers={"Authorization": f"Token {key}", "Accept": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310
        return json.load(response)


def rows(body):
    return body.get("results", body) if isinstance(body, dict) else body


# Never saved: secrets and per-user UI state that ATOM's user list returns.
USER_FIELDS_DROPPED = ("password", "token", "avatar", "shortcuts", "settings")


def fetch_users(base: str, key: str, out: Path) -> None:
    users, page = [], 1
    while True:
        body = get(base, key, "/api/v1/account/users/", {"page_size": 500, "page": page})
        for user in rows(body):
            users.append({k: v for k, v in user.items() if k not in USER_FIELDS_DROPPED})
        if not (isinstance(body, dict) and body.get("next")):
            break
        page += 1
    (out / "users.json").write_text(json.dumps(users))
    print(f"users: {len(users)} ({sum(1 for u in users if u.get('is_active'))} active)")


# Dropped from steps and tasks: files, thumbnails and nested records the import does not use.
WORK_FIELDS_DROPPED = (
    "reference_files",
    "thumbnail",
    "tasks",
    "latest_task",
    "last_version",
    "latest_approved_version",
    "latest_comment",
    "assets",
)


def person_id(value):
    return value.get("id") if isinstance(value, dict) else value


def slim(row: dict) -> dict:
    """A step or task with people as ATOM ids and nested records as their id or uid."""
    row = {k: v for k, v in row.items() if k not in WORK_FIELDS_DROPPED}
    for k in ("users", "reviewers"):
        if k in row:
            row[k] = [person_id(u) for u in row[k] or []]
    for k in ("user", "created_by", "updated_by"):
        if k in row:
            row[k] = person_id(row[k])
    if isinstance(row.get("status"), dict):
        row["status"] = row["status"].get("id")
    if isinstance(row.get("step"), dict):
        row["step"] = row["step"].get("uid")
    if "old_tasks" in row:
        row["old_tasks"] = [
            o.get("uid") if isinstance(o, dict) else o for o in row["old_tasks"] or []
        ]
    return row


def paged(base: str, key: str, path: str, params: dict) -> list:
    got, page = [], 1
    while True:
        body = get(base, key, path, {"page_size": 100, "page": page, **params})
        got += rows(body)
        if not (isinstance(body, dict) and body.get("next")):
            return got
        page += 1


def fetch_work(base: str, key: str, out: Path, slug: str) -> None:
    parts = out / "parts"
    parts.mkdir(exist_ok=True)

    def piece(name, read):
        path = parts / f"{name}.json"
        if path.exists():
            return json.loads(path.read_text())
        data = [slim(r) for r in read()]
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data))
        tmp.replace(path)
        return data

    statuses = rows(get(base, key, "/api/v1/utility/statuses/", {"page_size": 500}))
    (out / "statuses.json").write_text(
        json.dumps([{"id": s["id"], "name": s["name"]} for s in statuses])
    )
    episodes = [e["uid"] for e in rows(get(base, key, f"/api/v1/entity/projects/{slug}/episodes/"))]
    for kind in ("steps", "tasks"):
        wanted = set(rows(get(base, key, f"/api/v1/entity/projects/{slug}/{kind[:-1]}_ids/")))
        found = {}
        for e in episodes:
            route = f"/api/v1/entity/episodes/{e}/{kind}/"
            for r in piece(
                f"{kind}.ep_{e.replace(':', '_')}", lambda route=route: rows(get(base, key, route))
            ):
                found[r["uid"]] = r
        rest = sorted(wanted - found.keys())
        for i in range(0, len(rest), 50):
            chunk = ",".join(rest[i : i + 50])
            route = f"/api/v1/entity/{kind}/"
            for r in piece(
                f"{kind}.by_id_{i:06d}",
                lambda route=route, chunk=chunk: paged(base, key, route, {"uid__in": chunk}),
            ):
                found[r["uid"]] = r
        (out / f"{kind}.json").write_text(json.dumps(list(found.values())))
        missing, extra = len(wanted - found.keys()), len(found.keys() - wanted)
        print(
            f"{kind}: {len(found)} | ATOM lists {len(wanted)} | missing {missing} | extra {extra}",
            flush=True,
        )
        if missing:
            sys.exit(f"{kind}: {missing} not read; rerun to retry (pieces already read are kept)")
    work = {"slug": slug, "fetched_on": datetime.date.today().isoformat(), "base": base}
    (out / "_work.json").write_text(json.dumps(work, indent=1))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--code", help="ATOM project code, e.g. MUS")
    group.add_argument("--users", action="store_true", help="ATOM's users instead of a project")
    parser.add_argument(
        "--work", action="store_true", help="with --code: the project's steps and tasks"
    )
    parser.add_argument(
        "--out", required=True, type=Path, help="data folder (outside the repository)"
    )
    parser.add_argument("--base", default=os.environ.get("ATOM_BASE_URL", DEFAULT_BASE))
    args = parser.parse_args()

    key = api_key()
    base = args.base.rstrip("/")
    out = args.out.expanduser()
    out.mkdir(parents=True, exist_ok=True)
    out.chmod(0o700)
    if args.users:
        fetch_users(base, key, out)
        return

    projects = rows(get(base, key, "/api/v1/entity/projects/", {"code": args.code}))
    if len(projects) != 1:
        sys.exit(f"expected one ATOM project with code {args.code}, found {len(projects)}")
    project = projects[0]
    slug = project["uid"]
    if args.work:
        fetch_work(base, key, out, slug)
        print("saved to", out)
        return
    (out / "project.json").write_text(json.dumps(project, indent=1))
    print(
        f"project {project['code']} (slug {slug}, episodic {project.get('is_episodic')})",
        flush=True,
    )

    for name in ("episodes", "sequences", "shots", "assets"):
        data = rows(get(base, key, f"/api/v1/entity/projects/{slug}/{name}/"))
        (out / f"{name}.json").write_text(json.dumps(data))
        print(f"{name}: {len(data)}", flush=True)

    fetched = {
        "code": project["code"],
        "slug": slug,
        "episodic": bool(project.get("is_episodic")),
        "fetched_on": datetime.date.today().isoformat(),
        "base": base,
    }
    (out / "_fetched.json").write_text(json.dumps(fetched, indent=1))
    print("saved to", out)


if __name__ == "__main__":
    main()
