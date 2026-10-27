"""
The delivery manifest and its checksum (docs/deliveries/CONTRACTS.md DOM-DLV-05).

Built from the item snapshots. The checksum is the SHA-256 of the manifest's canonical JSON (sorted
keys, no whitespace), so anyone holding the manifest can recompute it.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any


def build(package: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    """``(manifest, checksums)`` for the package as its items stand now."""
    refs = list(package.versions.prefetch_related("files").order_by("version_number", "pk"))
    versions = []
    for ref in refs:
        versions.append(
            {
                "version_number": ref.version_number,
                "entity_code": ref.entity_code,
                "file_path": ref.file_path,
                "file_size_bytes": ref.file_size_bytes,
                "checksum_md5": ref.checksum_md5,
                "checksum_sha256": ref.checksum_sha256,
                "files": [
                    {
                        "root": f.storage_root_code,
                        "path": f.relative_path,
                        "role": f.role,
                        "size_bytes": f.size_bytes,
                        "sha256": f.sha256,
                        "frame_start": f.frame_start,
                        "frame_end": f.frame_end,
                    }
                    for f in ref.files.all()
                ],
            }
        )
    manifest = {
        "delivery_code": package.code,
        "delivery_name": package.name,
        "created_at": package.created_at.isoformat(),
        "versions": versions,
    }
    canonical = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("utf-8")
    checksums = {
        "manifest_sha256": hashlib.sha256(canonical).hexdigest(),
        "total_size_bytes": sum(ref.file_size_bytes for ref in refs),
        "version_count": len(refs),
    }
    return manifest, checksums
