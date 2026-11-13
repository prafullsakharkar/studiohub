"""
What the Docker build context leaves out (``.dockerignore``) must never hold application code.

``**/media`` once dropped ``apps/production/api/serializers/media/`` from every image built since
v4.1.0; ``apps/production/api/urls.py`` imports it, so those images could not load the URLconf.
The media and static folders are now named by path (``backend/media``, ``backend/static``, …).
"""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]


def _dropped_packages() -> list[str]:
    lines = [line.strip().rstrip("/") for line in (ROOT / ".dockerignore").read_text().splitlines()]
    names = {line[3:] for line in lines if line.startswith("**/") and "*" not in line[3:]}
    paths = {line for line in lines if line and line[0] not in "#*!" and "*" not in line}
    dropped = []
    for top in ("apps", "config", "core"):
        for init in (ROOT / "backend" / top).rglob("__init__.py"):
            rel = init.relative_to(ROOT)
            folders = rel.parts[:-1]
            prefixes = {"/".join(folders[: i + 1]) for i in range(len(folders))}
            if names & set(folders) or paths & prefixes:
                dropped.append(str(rel))
    return dropped


def test_no_application_package_is_left_out_of_the_image():
    assert _dropped_packages() == []


def test_the_local_media_and_static_folders_stay_out():
    lines = {line.strip() for line in (ROOT / ".dockerignore").read_text().splitlines()}
    assert {"backend/media", "backend/static", "backend/staticfiles"} <= lines
