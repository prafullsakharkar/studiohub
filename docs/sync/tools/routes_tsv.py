"""Normalize urls_dump.py output into routes.tsv (path, app, view, actions-json). Usage: routes_tsv.py urls.json routes.tsv"""

import json
import re
import sys

rows = set()
for x in json.load(open(sys.argv[1])):
    p = x["path"]
    if p.startswith("admin/") or "format" in p:
        continue
    p = p.replace("^", "").replace("$", "")
    p = re.sub(r"\(\?P<(\w+)>[^)]*\)", r"{\1}", p)
    p = re.sub(r"<(?:\w+:)?(\w+)>", r"{\1}", p)
    app = x["view"].split(".")[1] if x["view"].startswith("apps.") else x["view"].split(".")[0]
    rows.add((p, app, x["view"].split(".")[-1], json.dumps(x["actions"]) if x["actions"] else ""))
open(sys.argv[2], "w").write("\n".join("\t".join(r) for r in sorted(rows)))
print(len(rows))
