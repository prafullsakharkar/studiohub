"""Generate the mechanical sections of docs/sync/00-backend-inventory.md and 00b-serializers.md."""

import collections
import json
import re
import sys
from pathlib import Path

import yaml

S = Path(sys.argv[1])
OUT = Path(sys.argv[2])
routes = [l.split("\t") for l in (S / "routes.tsv").read_text().splitlines()]
vm = json.loads((S / "views_meta.json").read_text())
schema = yaml.safe_load((S / "schema.yaml").read_text())
models_md = (S / "models.md").read_text()
samples = {r["path"]: r for r in json.loads((OUT / "samples" / "INDEX.json").read_text())}

APP_ORDER = ["core", "identity", "masterdata", "audit", "settings", "production", "deliveries", "publishing", "scheduling"]
view_by_name = {}
for k, v in vm.items():
    view_by_name.setdefault(k.split(".")[-1] + "@" + k.split(".")[1], v)


def perm_for(meta, action):
    pm = meta.get("permission_map") or {}
    p = pm.get(action)
    if p is None:
        return "—" if pm else ("auth only" if meta.get("perms") else "?")
    if isinstance(p, (list, tuple)):
        return " + ".join(p) if p else "auth only"
    return str(p)


# ---------------- endpoints per app ----------------
by_app = collections.defaultdict(list)
seen = set()
for r in routes:
    path, app, view = r[0], r[1], r[2]
    acts = json.loads(r[3]) if len(r) > 3 and r[3] else {}
    if not path.startswith("api/") or app in ("rest_framework", "drf_spectacular"):
        continue
    key = path.rstrip("/")
    if key in seen:
        continue
    seen.add(key)
    by_app[app].append((path, view, acts))

lines = []
for app in APP_ORDER:
    rows = by_app.get(app, [])
    if not rows:
        continue
    lines.append(f"\n### {app} — endpoints ({len(rows)} paths)\n")
    lines.append("| Path | Method → action | View | Permission per action | Pagination | Filters / search / ordering | Sample |")
    lines.append("|---|---|---|---|---|---|---|")
    for path, view, acts in sorted(rows):
        meta = view_by_name.get(view + "@" + app, {})
        if acts:
            ma = "<br>".join(f"{m.upper()} → `{a}`" for m, a in acts.items())
            pa = "<br>".join(f"`{a}`: {perm_for(meta, a)}" for a in dict.fromkeys(acts.values()))
        else:
            ma = "APIView"
            pa = ", ".join(meta.get("perms") or []) or "—"
        is_list = acts.get("get") == "list"
        pg = (meta.get("pagination") or "none (bare array)") if is_list else ""
        filt = ""
        if is_list:
            f = meta.get("filters") or meta.get("filterset_fields") or []
            parts = []
            if f:
                parts.append("filter: " + ", ".join(f"`{x}`" for x in f if x not in ("search", "ordering")))
            if meta.get("search"):
                parts.append("search: " + ", ".join(meta["search"]))
            if meta.get("ordering_fields"):
                parts.append("ordering: " + ", ".join(meta["ordering_fields"]))
            filt = "<br>".join(parts)
        smp = ""
        sp = "/" + path
        if sp in samples:
            s = samples[sp]
            smp = f"[{s['list_status']}/anon {s['anon']}/norole {s['norole']}/artist {s['artist']}](samples/{s['file']})"
        lines.append(f"| `/{path}` | {ma} | {view} | {pa} | {pg} | {filt} | {smp} |")

# models per app
lines.append("\n## Models (generated)\n")
lines.append("Base columns (`id` UUID pk, `created_at`, `updated_at`, `created_by`, `updated_by`, `is_deleted`, `deleted_at`, `deleted_by`, `metadata`) are omitted per model. `!u` = unique. Relations show `->target(on_delete)`.\n")
blocks = models_md.split("### ")[1:]
for app in APP_ORDER:
    mine = [b for b in blocks if b.startswith(app + ".")]
    if mine:
        lines.append(f"\n### {app} models ({len(mine)})\n")
        for b in mine:
            lines.append("#### " + b.strip() + "\n")

(OUT / "_generated_endpoints_models.md").write_text("\n".join(lines) + "\n")

# ---------------- serializers from OpenAPI ----------------
comps = schema["components"]["schemas"]


def resolve(ref):
    return comps[ref.split("/")[-1]], ref.split("/")[-1]


def ftype(p):
    if "$ref" in p:
        return "→" + p["$ref"].split("/")[-1]
    if "allOf" in p:
        return " & ".join(ftype(x) for x in p["allOf"])
    if "oneOf" in p:
        return " | ".join(ftype(x) for x in p["oneOf"])
    t = p.get("type", "any")
    if t == "array":
        return ftype(p.get("items", {})) + "[]"
    fmt = p.get("format")
    return f"{t}({fmt})" if fmt else t


def table(name):
    c = comps.get(name, {})
    req = set(c.get("required", []))
    out = [f"\n#### `{name}`\n", "| Field | Type | Req | RO | WO | Null | Max | Enum / notes |", "|---|---|---|---|---|---|---|---|"]
    if c.get("enum"):
        return [f"\n#### `{name}` (enum)\n", "Values: " + ", ".join(f"`{e}`" for e in c["enum"] if e not in ("", None)) + "\n"]
    for f, p in (c.get("properties") or {}).items():
        en = ""
        if "enum" in p:
            en = ", ".join(f"`{e}`" for e in p["enum"])
        elif p.get("description"):
            en = re.sub(r"\s+", " ", p["description"])[:120]
        out.append(
            f"| `{f}` | {ftype(p)} | {'✓' if f in req else ''} | {'✓' if p.get('readOnly') else ''} | {'✓' if p.get('writeOnly') else ''} | {'✓' if p.get('nullable') else ''} | {p.get('maxLength', '')} | {en} |"
        )
    return out


slines = ["# Backend serializer contracts (generated from the live OpenAPI schema)\n",
          "Generated by `docs/sync/tools/gen_inventory.py` from `manage.py spectacular` output on the Phase 0 branch. ",
          "One section per operation that has a request or response body. `RO` = read_only, `WO` = write_only. ",
          "Views missing from the schema (spectacular could not introspect them) are listed in 00-backend-inventory.md §8 and are typed from samples instead.\n"]
emitted = set()
for path in sorted(schema["paths"]):
    for m, op in schema["paths"][path].items():
        if m not in ("get", "post", "put", "patch", "delete"):
            continue
        names = []
        rb = (op.get("requestBody") or {}).get("content", {}).get("application/json", {}).get("schema", {})
        if "$ref" in rb:
            names.append(("request", rb["$ref"].split("/")[-1]))
        for code, resp in (op.get("responses") or {}).items():
            sc = (resp.get("content") or {}).get("application/json", {}).get("schema", {})
            ref = sc.get("$ref") or (sc.get("items") or {}).get("$ref")
            if ref:
                n = ref.split("/")[-1]
                c = comps.get(n, {})
                inner = (((c.get("properties") or {}).get("results") or {}).get("items") or {}).get("$ref")
                names.append((f"response {code}" + (" (paginated)" if inner else ""), inner.split("/")[-1] if inner else n))
        if not names:
            continue
        slines.append(f"\n### `{m.upper()} {path}`" + (" — **deprecated**" if op.get("deprecated") else ""))
        slines.append(", ".join(f"{k}: `{n}`" for k, n in names))
        for _, n in names:
            if n not in emitted:
                emitted.add(n)
                slines.extend(table(n))
(OUT / "00b-backend-serializers.md").write_text("\n".join(slines) + "\n")
print("endpoints/models lines", len(lines), "serializer components", len(emitted))
