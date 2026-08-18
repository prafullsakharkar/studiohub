"""
Add ``model = Xxx`` to every ``XxxBaseSerializer`` Meta that lacks it.

The tournament serializer modules define ``class Meta: abstract = True`` on
each base serializer without a ``model``, which makes DRF raise
"missing Meta.model" for every List/Detail/Summary subclass. This script
injects ``model = <ModelName>`` (derived from the class name) into the Meta.
"""

from __future__ import annotations

import ast
import re
from pathlib import Path

SERIALIZERS_DIR = Path("apps/tournament/api/serializers")

MODEL_ALIASES = {
    # serializer base name -> model symbol (for names that don't strip cleanly)
    "TeamMember": "TeamMember",
}


def fix_file(path: Path) -> int:
    source = path.read_text()
    tree = ast.parse(source)
    changes = 0

    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        if not node.name.endswith("BaseSerializer"):
            continue
        model_name = MODEL_ALIASES.get(node.name[:-len("BaseSerializer")], node.name[:-len("BaseSerializer")])

        for item in node.body:
            if not isinstance(item, ast.ClassDef) or item.name != "Meta":
                continue
            meta_has_model = any(
                isinstance(a, ast.Assign)
                and any(isinstance(t, ast.Name) and t.id == "model" for t in a.targets)
                for a in item.body
            )
            if meta_has_model:
                continue
            has_abstract = any(
                isinstance(a, ast.Assign)
                and any(isinstance(t, ast.Name) and t.id == "abstract" for t in a.targets)
                for a in item.body
            )
            if not has_abstract:
                continue
            # Insert `model = Xxx` right after the `abstract = True` line.
            for a in item.body:
                if isinstance(a, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "abstract" for t in a.targets):
                    indent = " " * (a.col_offset)
                    insert_at = a.end_lineno  # 1-based line number
                    lines = source.splitlines(keepends=True)
                    new_line = f"{indent}model = {model_name}\n"
                    lines.insert(insert_at, new_line)
                    source = "".join(lines)
                    changes += 1
                    break
            break  # only the first Meta class in the serializer class

    if changes:
        path.write_text(source)
    return changes


def main() -> None:
    total = 0
    for path in sorted(SERIALIZERS_DIR.glob("*.py")):
        if path.name == "__init__.py":
            continue
        try:
            n = fix_file(path)
        except Exception as exc:  # noqa: BLE001
            print(f"SKIP {path.name}: {exc}")
            continue
        if n:
            print(f"{path.name}: {n} base serializer(s) updated")
            total += n
    print(f"TOTAL: {total} base serializer Meta blocks updated")


if __name__ == "__main__":
    main()
