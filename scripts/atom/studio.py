"""Studio setup that goes with an ATOM import, through studiohub's own API. Run inside ``manage.py shell``:

    cd backend && KIND=departments STEP=dry DJANGO_ENV=local uv run python manage.py shell < ../scripts/atom/studio.py

KIND=departments  give catalog task types without a department one (PATCH task-types), then, with PROJECT
                  (a project code), set it on that project's tasks of those types that have none (tasks/bulk-update).
KIND=templates    the 5 studio-wide task templates (POST task-templates); one with the same name is left alone.
KIND=workflows    3 workflows on PROJECT (workflows need a project; codes carry its prefix, CR-49): a two-stage
                  review, an animation series shot pipeline and a character asset pipeline.
STEP=dry changes nothing (bulk routes run their dry run; other writes are only listed); STEP=real writes.
Every KIND skips what is already there, so a rerun is safe.
"""

import os
from collections import Counter

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.masterdata.models import Department, MasterTaskType
from apps.production.models import Project, Task, TaskTemplate, Workflow

KIND = os.environ["KIND"]
assert KIND in ("departments", "templates", "workflows"), (
    "KIND is departments, templates or workflows"
)
STEP = os.environ.get("STEP", "dry")
assert STEP in ("dry", "real"), "STEP is dry or real"
dry = STEP == "dry"
project = Project.objects.get(code=os.environ["PROJECT"]) if os.environ.get("PROJECT") else None
client = APIClient(SERVER_NAME="localhost")
client.force_authenticate(
    user=get_user_model().objects.get(email=os.environ.get("ADMIN_EMAIL", "admin@studiohub.local"))
)

# Catalog task type -> department code. Vatika (shot-level environment work, ATOM has no such department) goes
# with Set Dressing in Layout.
TYPE_DEPARTMENTS = {
    "layout": "DEPT-LAYOUT", "animation": "DEPT-ANIM", "modeling": "DEPT-MODEL", "texturing": "DEPT-TEX",
    "lookdev": "DEPT-TEX", "rigging": "DEPT-RIG", "matchmove": "DEPT-MM", "vatika": "DEPT-LAYOUT",
}  # fmt: skip

# Default hours: MUS's median bid per step (build.py bids, ATOM 2026-11-24, steps with a bid only); 0 where MUS
# has no such step. CFX is 8 h on shots (Cloth) and 16 h on assets.
TEMPLATE_NOTE = (
    "Default hours: MUS median bid per step from ATOM (2026-11-24); 0 where MUS has no data."
)
TEMPLATES = [
    ("Animation series shot", "Shot", [("layout", 8), ("animation", 16), ("cfx", 8), ("lighting", 32), ("render", 16), ("comp", 16)]),
    ("VFX shot", "Shot", [("matchmove", 0), ("roto", 0), ("paint", 0), ("layout", 8), ("animation", 16), ("fx", 8), ("lighting", 32), ("comp", 16)]),
    ("Character asset", "Asset", [("modeling", 8), ("texturing", 4), ("rigging", 4), ("cfx", 16), ("lookdev", 0)]),
    ("Prop asset", "Asset", [("modeling", 8), ("texturing", 4), ("lookdev", 0)]),
    ("Environment asset", "Asset", [("modeling", 8), ("texturing", 4), ("set-dressing", 6), ("lookdev", 0)]),
]  # fmt: skip

if KIND == "departments":
    names = dict(Department.objects.values_list("code", "name"))
    for code, dept in TYPE_DEPARTMENTS.items():
        task_type = MasterTaskType.objects.get(code=code)
        if task_type.department_code == dept and task_type.department_name == names[dept]:
            print("type", code, "already", names[dept])
            continue
        if dry:
            print("type", code, "would get", names[dept])
            continue
        response = client.patch(
            f"/api/v1/platform/master-data/task-types/{task_type.pk}",
            {"department_code": dept, "department_name": names[dept]},
            format="json",
        )
        print(
            "type",
            code,
            "->",
            names[dept],
            response.status_code,
            "" if response.ok else response.content[:300],
        )
    if project is not None:
        # Tasks keep the department's name (what the create route fills in from the task type).
        for code, dept in TYPE_DEPARTMENTS.items():
            ids = [
                str(i)
                for i in Task.objects.filter(
                    project=project, task_type__code=code, department=""
                ).values_list("id", flat=True)
            ]
            for i in range(0, len(ids), 500):
                chunk = ids[i : i + 500]
                body = client.post(
                    "/api/v1/tasks/bulk-update/",
                    {
                        "ids": chunk,
                        "changes": {"department": names[dept]},
                        "dry_run": dry,
                        "atomic": True,
                    },
                    format="json",
                ).json()
                print("tasks", code, len(chunk), "->", names[dept], "failed", body.get("failed"), "committed", body.get("committed"), body.get("errors", [])[:2])  # fmt: skip
        live = Task.objects.filter(project=project)
        print("tasks with a department:", live.exclude(department="").count(), "/", live.count())

elif KIND == "templates":
    type_names = dict(MasterTaskType.objects.values_list("code", "name"))
    for name, kind, steps in TEMPLATES:
        if TaskTemplate.objects.filter(name=name, project=None).exists():
            print("exists:", name)
            continue
        if dry:
            print("would create:", name, kind, [c for c, _ in steps])
            continue
        items = [
            {"task_type_id": code, "name": type_names[code], "order": i, "default_bid_hours": hours}
            for i, (code, hours) in enumerate(steps, 1)
        ]
        body = {"project_id": None, "name": name, "entity_type": kind, "description": TEMPLATE_NOTE, "is_active": True, "items": items}  # fmt: skip
        response = client.post("/api/v1/task-templates/", body, format="json")
        print(
            name,
            response.status_code,
            "" if response.status_code == 201 else response.content[:400],
        )
    for template in TaskTemplate.objects.filter(project=None).order_by("name"):
        items = template.items.order_by("order").select_related("task_type")
        print(
            f"{template.name} ({template.entity_type}):",
            " -> ".join(f"{i.name} {i.default_bid_hours:g}h" for i in items),
        )

elif KIND == "workflows":
    assert project is not None, "KIND=workflows needs PROJECT"
    PREFIX = project.code.upper()

    def node(i, t, title, x, y, dept="", desc="", **cfg):
        return {
            "id": i,
            "type": t,
            "title": title,
            "config": cfg,
            "position": {"x": x, "y": y},
            "department": dept,
            "description": desc,
        }

    def edge(i, s, t, label, port="out"):
        return {
            "id": i,
            "label": label,
            "source_port": port,
            "source_node_id": s,
            "target_node_id": t,
        }

    review = dict(
        name="Two-stage review (internal + client)",
        code=f"{PREFIX}_WF_REVIEW_2STAGE",
        category="Review",
        description="The review loop used on animation series: the lead or supervisor approves internally, then the client approves. A rejection at either stage is a retake.",
        nodes=[
            node("s", "start", "Ready for review", 60, 160, desc="The artist submits a version."),
            node(
                "int",
                "review",
                "Internal review",
                400,
                160,
                "Review",
                "Lead or supervisor reviews in dailies.",
            ),
            node(
                "int_ok",
                "condition",
                "Internally approved?",
                740,
                160,
                condition_field="verdict",
                condition_value="Approved",
            ),
            node(
                "rt", "task", "Internal retake", 740, 380, desc="Artist addresses internal notes."
            ),
            node(
                "cli",
                "review",
                "Client review",
                1080,
                160,
                "Review",
                "The version is sent to the client.",
            ),
            node(
                "cli_ok",
                "condition",
                "Client approved?",
                1420,
                160,
                condition_field="client_verdict",
                condition_value="Approved",
            ),
            node("crt", "task", "Client retake", 1420, 380, desc="Artist addresses client notes."),
            node(
                "done",
                "approval",
                "Final",
                1760,
                160,
                desc="Client-approved: ready to publish and deliver.",
                approval_type="Client",
            ),
            node("e", "end", "Done", 2100, 160),
        ],
        transitions=[
            edge("t1", "s", "int", "Submit"),
            edge("t2", "int", "int_ok", "Verdict"),
            edge("t3", "int_ok", "cli", "Yes", "true"),
            edge("t4", "int_ok", "rt", "No", "false"),
            edge("t5", "rt", "int", "Resubmit"),
            edge("t6", "cli", "cli_ok", "Client verdict"),
            edge("t7", "cli_ok", "done", "Yes", "true"),
            edge("t8", "cli_ok", "crt", "No", "false"),
            edge("t9", "crt", "int", "Resubmit"),
            edge("t10", "done", "e", "Close"),
        ],
        automation_rules=[
            {"id": "r1", "when": "status == 'Retake'", "then": "notify_assignee"},
            {"id": "r2", "when": "status == 'Approved'", "then": "notify_producer"},
        ],
    )

    def chain(name, code, category, desc, first, last_nodes, steps):
        nodes, tr, prev = [node("s", "start", first[0], 60, 160, desc=first[1])], [], "s"
        for i, (k, title, dept) in enumerate(steps):
            nodes.append(
                node(
                    k,
                    "task",
                    title,
                    400 + i * 340,
                    160,
                    dept,
                    f"{title}; approved internally before the next step.",
                )
            )
            tr.append(edge(f"t{i}", prev, k, "Start" if prev == "s" else "Approved"))
            prev = k
        x = 400 + len(steps) * 340
        (k1, t1, typ1, d1), (k2, t2) = last_nodes
        nodes += [node(k1, typ1, t1, x, 160, d1[0], d1[1]), node(k2, "end", t2, x + 340, 160)]
        tr += [edge("tl", prev, k1, "Submit"), edge("te", k1, k2, "Done")]
        return dict(
            name=name,
            code=code,
            category=category,
            description=desc,
            nodes=nodes,
            transitions=tr,
            automation_rules=[],
        )

    shot = chain(
        "Animation series shot pipeline",
        f"{PREFIX}_WF_SHOT_ANIM_SERIES",
        "Shot",
        "Layout, Animation, CFX, Lighting, Render, Compositing, each approved internally before the next; then client review (the order MUS used in ATOM).",
        ("Shot ready", "Shot is turned over with its assets."),
        (
            ("rv", "Client review", "review", ("Review", "The finished shot goes to the client.")),
            ("e", "Delivered"),
        ),
        [
            ("lay", "Layout", "Layout"),
            ("anim", "Animation", "Animation"),
            ("cfx", "CFX", "Rigging"),
            ("lit", "Lighting", "Lighting"),
            ("rnd", "Render", "Lighting"),
            ("cmp", "Compositing", "Compositing"),
        ],
    )
    asset = chain(
        "Character asset pipeline",
        f"{PREFIX}_WF_ASSET_CHARACTER",
        "Asset",
        "Modeling, Texturing, Rigging, CFX (hair and cloth setup), Look Development, then publish for shots.",
        ("Asset brief", "Design and references approved."),
        (
            ("pub", "Publish asset", "publish", ("", "Asset published for shots.")),
            ("e", "Ready for shots"),
        ),
        [
            ("mod", "Modeling", "Modeling"),
            ("tex", "Texturing", "Texturing & Look Dev"),
            ("rig", "Rigging", "Rigging"),
            ("cfx", "CFX", "Rigging"),
            ("ldv", "Look Development", "Texturing & Look Dev"),
        ],
    )

    counts = Counter()
    for w in (review, shot, asset):
        if Workflow.objects.filter(project=project, name=w["name"]).exists():
            print("exists:", w["name"])
            continue
        if dry:
            print("would create:", w["name"], w["code"])
            continue
        response = client.post(
            "/api/v1/workflows/", {**w, "project": str(project.pk)}, format="json"
        )
        print(
            w["name"],
            response.status_code,
            "" if response.status_code == 201 else response.content[:400],
        )
    print(project.code, "workflows:", Workflow.objects.filter(project=project).count())
