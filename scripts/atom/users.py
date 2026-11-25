"""Create ATOM's users in studiohub through its own API, or give the active ones a resource. Run inside ``manage.py shell``:

    cd backend && KIND=users USERS=~/atom-data/users/users.json MAP=~/atom-data/users/user_map.json \\
        DJANGO_ENV=local uv run python manage.py shell < ../scripts/atom/users.py

USERS is ``fetch.py --users`` output. MAP (ATOM id -> studiohub user and person ids) is read and extended, so a rerun
skips the people already done; the task import reads it to set assignees. ONLY = optional comma list of ATOM ids.
Prints counts only, never names or e-mails. Nothing here talks to ATOM.

KIND=users, per person, in this order (each step is the order studiohub needs):
1. the directory person with ATOM's full name, department and position (POST /people/, or unlink and PATCH an
   existing one: a linked person takes its name from the account's profile, which these accounts lack);
2. the account, active, with a random password that is never kept (POST /identity/users/); it adopts the unlinked
   person with its e-mail (DOM-MD-PER-10), or is linked with POST /people/{id}/link-user/;
3. for an active artist, lead or supervisor, a role (POST /roles/{id}/users/); then, for an inactive ATOM user, the
   account and the person are deactivated (an inactive account cannot be linked, hence this order).
Test and API accounts are skipped. ATOM's superusers get ordinary accounts; nobody gets ``is_staff``.

KIND=resources: a Person resource per active imported user, on the default work calendar, 40 hours a week, code
``RES-<employee code>``, or ``RES-ATOM<id>`` when ATOM gives several people the same employee code.
"""

import json
import os
import secrets
import time
from collections import Counter
from pathlib import Path

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.identity.models import Role
from apps.masterdata.models import Department, Person, Position
from apps.scheduling.models import Resource, WorkCalendar

KIND = os.environ["KIND"]
assert KIND in ("users", "resources"), "KIND is users or resources"

SKIP_DOMAINS = ("test.com", "example.com")
SKIP_ROLES = ("api_user",)
# ATOM department (a step) -> studiohub department.
DEPT = {
    "Animation": [
        "Animation",
        "Blocking",
        "Animation Blocking",
        "Anim Tech Check",
        "Refine Animation",
        "Animation Final",
        "Animation Stereo",
        "Final Animation Stereo",
        "Cycle",
        "Crowd",
        "crowdBlocking",
        "TempleCrowd",
    ],
    "Layout": [
        "Layout",
        "Layout Blocking",
        "Layout Final",
        "Layout Stereo",
        "Scout",
        "Previz",
        "PostViz",
        "Animatic",
        "Set Dressing",
    ],
    "Compositing": [
        "Compositing",
        "SlapComp",
        "Keying",
        "Stereo Comp",
        "Compositing Wip",
        "Compositing Techfix",
        "Distortion",
        "Stabilize",
        "Steadiness",
        "Postertask",
        "Teaser",
        "FaceReplacement",
        "Dmp",
        "Matte Painting",
        "Plate",
        "CrowdPlate",
        "CrowdPlateShoot",
    ],
    "Lighting": ["Lighting", "PreLighting", "Render", "Stereo Render"],
    "FX": ["FX", "FX Final", "FX Blocking", "crowdSim", "crowdAi", "crowdPrep", "Mash"],
    "Modeling": ["Modeling", "Sim Modeling", "Foliage", "Proxy Set", "Lidar"],
    "Texturing & Look Dev": ["Texturing", "Anim Texture", "Sim Texturing"],
    "Rigging": [
        "Rigging",
        "Rig Test",
        "Layout Rig",
        "Sim Rig",
        "Master Rig",
        "Blend Shape",
        "CFX",
        "Cloth",
        "Shave Hair",
        "Fur Shape",
    ],
    "Roto & Paint": ["Roto", "Roto Anim", "Paint", "Cleanup"],
    "Matchmove": ["Matchmove"],
    "Editorial": ["Retime", "Editing"],
    "Data & I/O": ["Data Ingest", "Input Output", "Delivery", "Repo"],
}
ATOM_TO_DEPT = {atom: ours for ours, atoms in DEPT.items() for atom in atoms}
ROLE_DEPT = {
    "production": "Production",
    "coordinator": "Production",
    "manager": "Production",
    "developer": "Pipeline TD",
}
ARTIST_POSITION = {
    "Animation": "Animator",
    "Layout": "Layout Artist",
    "Lighting": "Lighting Artist",
    "FX": "FX Artist",
    "Modeling": "Modeler",
    "Texturing & Look Dev": "Texture Artist",
    "Rigging": "Rigging TD",
    "Roto & Paint": "Roto Artist",
    "Matchmove": "Matchmove Artist",
}
SUPERVISOR_POSITION = {
    "Animation": "Animation Supervisor",
    "Compositing": "Compositing Supervisor",
    "FX": "FX Supervisor",
}
RBAC = {
    "artist": "Artist",
    "lead": "Lead Artist",
    "supervisor": "VFX Supervisor",
    "cg_supervisor": "VFX Supervisor",
}

users = json.loads(Path(os.environ["USERS"]).read_text())
map_path = Path(os.environ["MAP"])
done = json.loads(map_path.read_text()) if map_path.exists() else {}
only = {s for s in os.environ.get("ONLY", "").split(",") if s}

client = APIClient(SERVER_NAME="localhost")
client.force_authenticate(user=get_user_model().objects.get(email="admin@studiohub.local"))
departments = {d.name: str(d.pk) for d in Department.objects.all()}
positions = {p.name: str(p.pk) for p in Position.objects.all()}
roles = {r.name: str(r.pk) for r in Role.objects.all()}


def dept_names(u):
    return [d.get("name") if isinstance(d, dict) else str(d) for d in (u.get("departments") or [])]


def department(u):
    if u.get("role") in ROLE_DEPT:
        return ROLE_DEPT[u["role"]]
    mapped = Counter(ATOM_TO_DEPT[d] for d in dept_names(u) if d in ATOM_TO_DEPT)
    if not mapped or len(mapped) > 3:
        return None
    return mapped.most_common(1)[0][0]


def position(u, dept):
    role = u.get("role")
    if role in ("production", "coordinator", "manager"):
        return "Production Coordinator"
    if role == "developer":
        return "Pipeline Developer"
    if role == "lead":
        return "Lighting Lead" if dept == "Lighting" else "Lead Artist"
    if role == "supervisor":
        return SUPERVISOR_POSITION.get(dept)
    if role == "artist":
        return ARTIST_POSITION.get(dept, "Artist")
    return None


def name(u):
    full = (
        u.get("full_name") or ""
    ).strip() or f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
    return full or u["username"]


if KIND == "users":
    counts, failures = Counter(), []
    started = time.monotonic()
    for u in users:
        key = str(u["id"])
        if only and key not in only:
            continue
        email = (u.get("email") or "").strip().lower()
        if u.get("role") in SKIP_ROLES or email.endswith(SKIP_DOMAINS) or not email:
            counts["skipped (test/api)"] += 1
            continue
        if key in done and done[key].get("done"):
            counts["already done"] += 1
            continue
        active = bool(u.get("is_active"))
        entry = done.get(key, {})
        try:
            dept = department(u)
            pos = position(u, dept)
            fields = {
                "name": name(u)[:255],
                "email": email,
                "department": departments.get(dept) if dept else None,
                "role": positions.get(pos) if pos else None,
                "description": f"ATOM {u.get('role')} (emp {u.get('emp_code')})",
            }
            fields = {k: v for k, v in fields.items() if v is not None}
            # 1. The person first: a new account adopts the unlinked person with its e-mail (DOM-MD-PER-10).
            person = Person.objects.filter(email__iexact=email).first()
            if person is None:
                r = client.post("/api/v1/people/", {**fields, "status": "active"}, format="json")
                if r.status_code != 201:
                    raise RuntimeError(f"person {r.status_code} {r.content[:300]!r}")
                person_id = str(r.json()["id"])
            else:
                person_id = str(person.pk)
                if person.user_id:
                    # A linked person's name comes from the account's profile, which these accounts lack: unlink,
                    # set the name, and link again below (the link keeps a name the profile does not give).
                    r = client.post(f"/api/v1/people/{person_id}/unlink-user/", {}, format="json")
                    if r.status_code != 200:
                        raise RuntimeError(f"unlink {r.status_code} {r.content[:300]!r}")
                if person.status != "active":
                    client.post(f"/api/v1/people/{person_id}/reactivate/", {}, format="json")
                r = client.patch(f"/api/v1/people/{person_id}/", fields, format="json")
                if r.status_code != 200:
                    raise RuntimeError(f"person patch {r.status_code} {r.content[:300]!r}")
            entry["person_id"] = person_id
            # 2. The account, active so it can be linked.
            if not entry.get("user_id"):
                r = client.post(
                    "/api/v1/identity/users/",
                    {
                        "email": email,
                        "password": secrets.token_urlsafe(24) + "aA1!",
                        "is_active": True,
                        "is_staff": False,
                    },
                    format="json",
                )
                if r.status_code != 201:
                    raise RuntimeError(f"user {r.status_code} {r.content[:300]!r}")
                entry["user_id"] = str(r.json()["id"])
            elif not get_user_model().objects.get(pk=entry["user_id"]).is_active:
                r = client.patch(
                    f"/api/v1/identity/users/{entry['user_id']}/",
                    {"is_active": True},
                    format="json",
                )
                if r.status_code != 200:
                    raise RuntimeError(f"user activate {r.status_code} {r.content[:300]!r}")
            if str(Person.objects.get(pk=person_id).user_id or "") != entry["user_id"]:
                r = client.post(
                    f"/api/v1/people/{person_id}/link-user/",
                    {"user": entry["user_id"]},
                    format="json",
                )
                if r.status_code not in (200, 201):
                    raise RuntimeError(f"link {r.status_code} {r.content[:300]!r}")
            # 3. ATOM's state: an inactive ATOM user is an inactive account and an inactive person.
            rbac = RBAC.get(u.get("role")) if active else None
            if rbac and not entry.get("role"):
                r = client.post(
                    f"/api/v1/roles/{roles[rbac]}/users/",
                    {"user_id": entry["user_id"]},
                    format="json",
                )
                if r.status_code not in (200, 201):
                    raise RuntimeError(f"role {r.status_code} {r.content[:300]!r}")
                entry["role"] = rbac
            if not active:
                r = client.patch(
                    f"/api/v1/identity/users/{entry['user_id']}/",
                    {"is_active": False},
                    format="json",
                )
                if r.status_code != 200:
                    raise RuntimeError(f"user deactivate {r.status_code} {r.content[:300]!r}")
                r = client.post(f"/api/v1/people/{person_id}/deactivate/", {}, format="json")
                if r.status_code != 200:
                    raise RuntimeError(f"person deactivate {r.status_code} {r.content[:300]!r}")
            entry["done"] = True
            counts["created " + ("active" if active else "inactive")] += 1
            counts[f"dept {'set' if dept else 'blank'}"] += 1
            counts[f"position {'set' if pos else 'blank'}"] += 1
            if rbac:
                counts[f"role {rbac}"] += 1
        except Exception as error:  # noqa: BLE001 - recorded and reported, the run goes on
            failures.append({"atom_id": key, "error": str(error)[:400]})
            counts["failed"] += 1
        done[key] = entry
        map_path.write_text(json.dumps(done))
        total = sum(v for k, v in counts.items() if k.startswith("created") or k == "failed")
        if total and total % 200 == 0:
            print(f"{total} {dict(counts)} {time.monotonic() - started:.0f}s", flush=True)

    print("counts:", dict(counts), f"{time.monotonic() - started:.0f}s")
    for f in failures[:10]:
        print("failure:", f)
    print(
        "studiohub users:",
        get_user_model().objects.count(),
        "| people:",
        Person.objects.count(),
        "| linked people:",
        Person.objects.exclude(user=None).count(),
    )
elif KIND == "resources":
    users = {str(u["id"]): u for u in users}
    calendar = WorkCalendar.objects.get(is_default=True)
    have = set(Resource.objects.exclude(user=None).values_list("user_id", flat=True))

    emp_counts = Counter((u.get("emp_code") or "").strip().upper() for u in users.values())

    def resource_code(key):
        emp = (users[key].get("emp_code") or "").strip().upper()
        # 311 active ATOM users share one placeholder employee code: they are told apart by their ATOM id.
        return f"RES-{emp}"[:50] if emp and emp_counts[emp] == 1 else f"RES-ATOM{key}"

    counts, failures = Counter(), []
    for key, entry in done.items():
        if (only and key not in only) or not entry.get("done") or not users[key].get("is_active"):
            continue
        user_id = entry["user_id"]
        if any(str(h) == user_id for h in have):
            counts["already has one"] += 1
            continue
        person = Person.objects.get(pk=entry["person_id"])
        body = {
            "name": person.name,
            "code": resource_code(key),
            "resource_type": "Person",
            "status": "Active",
            "user_id": user_id,
            "department_id": str(person.department_id) if person.department_id else None,
            "calendar_id": str(calendar.pk),
            "capacity_hours_per_week": 40,
        }
        r = client.post(
            "/api/v1/scheduling/resources/",
            {k: v for k, v in body.items() if v is not None},
            format="json",
        )
        if r.status_code == 201:
            counts["created"] += 1
        else:
            counts["failed"] += 1
            failures.append(
                {
                    "atom_id": key,
                    "status": r.status_code,
                    "body": r.content.decode(errors="replace")[:300],
                }
            )

    print("counts:", dict(counts))
    for f in failures[:5]:
        print("failure:", f)
    made = Resource.objects.filter(resource_type="Person").exclude(user=None)
    print(
        "person resources:",
        made.count(),
        "| on the studio calendar:",
        made.filter(calendar=calendar).count(),
        "| 40h:",
        made.filter(capacity_hours_per_week=40).count(),
    )
