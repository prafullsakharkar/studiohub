# Naming Conventions — File, Asset, Shot, Task, Version

Generated: 2026-08-18T12:34:04+05:30

Purpose
-------
Document canonical naming variables and validation expectations for StudioHub pipeline artifacts: projects, assets, shots, tasks, versions, and file names.

Variables and examples
----------------------
Common variables used in templates:
- organization, production, project, sequence, shot, asset, task, department, version, publish_type, date, user

Example file name template:
- `{project}_{sequence}_{shot}_{task}_{department}_{version}.{ext}`

Validation
----------
- Enforce allowed character sets (e.g., alphanumeric, underscore, hyphen)
- Disallow whitespace and control characters in filesystem names
- Apply case-sensitivity rules per storage backend (S3: case-sensitive, Windows: case-insensitive)

Project-level overrides
-----------------------
- Projects may declare stricter naming rules via pipeline configuration
- Provide migration tools when renaming schemes change

Integration
-----------
- Naming validation runs in pre-publish validators and as part of PathResolver checks

End of naming conventions document.
