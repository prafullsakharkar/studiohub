#!/usr/bin/env python3
"""Validate relative markdown links across the documentation.

Checks that every relative link target (files, images, directories) used in
docs markdown files resolves to an existing path in the repository. Absolute
URLs (http/https/mailto) and same-page anchors are ignored.

Usage:
    uv run python scripts/check_docs_links.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = REPO_ROOT / "docs"

# Inline markdown links/images: [text](target "title")
LINK_RE = re.compile(r"\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+\"[^\"]*\")?\s*\)")
FENCE_RE = re.compile(r"^(?:```|~~~)")

SKIP_PREFIXES = ("http://", "https://", "mailto:", "#")


def strip_code(content: str) -> str:
    """Remove fenced code blocks and inline code spans so their content is
    never treated as links."""
    lines: list[str] = []
    in_fence = False
    fence_marker = ""
    for line in content.splitlines():
        stripped = line.lstrip()
        if not in_fence:
            match = FENCE_RE.match(stripped)
            if match:
                in_fence = True
                fence_marker = stripped[:3]
                lines.append("")
                continue
            lines.append(line)
        else:
            if stripped.startswith(fence_marker):
                in_fence = False
            lines.append("")
    text = "\n".join(lines)
    return re.sub(r"`[^`\n]*`", lambda m: "`" + " " * (len(m.group(0)) - 2) + "`", text)


def iter_markdown_files() -> list[Path]:
    return sorted(DOCS_DIR.rglob("*.md"))


def check_file(path: Path) -> list[str]:
    errors: list[str] = []
    content = strip_code(path.read_text(encoding="utf-8"))
    for line_no, line in enumerate(content.splitlines(), start=1):
        for target in LINK_RE.findall(line):
            if target.startswith(SKIP_PREFIXES):
                continue
            target = target.split("#", 1)[0]
            if not target:
                continue
            # Repo-absolute links start with "/", everything else is file-relative.
            base = REPO_ROOT if target.startswith("/") else path.parent
            resolved = (base / target.lstrip("/")).resolve()
            if resolved.exists():
                continue
            # A trailing-slash directory link is valid when it contains an index file.
            if target.endswith("/") and any(
                (resolved / name).exists() for name in ("README.md", "index.md")
            ):
                continue
            errors.append(f"{path.relative_to(REPO_ROOT)}:{line_no}: broken link -> {target}")
    return errors


def main() -> int:
    if not DOCS_DIR.is_dir():
        print(f"docs directory not found: {DOCS_DIR}", file=sys.stderr)
        return 1

    errors: list[str] = []
    checked = 0
    for path in iter_markdown_files():
        checked += 1
        errors.extend(check_file(path))

    if errors:
        print(f"Found {len(errors)} broken link(s) in {checked} markdown file(s):\n")
        for error in errors:
            print(f"  {error}")
        return 1

    print(f"OK: {checked} markdown file(s) checked, all relative links resolve.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
