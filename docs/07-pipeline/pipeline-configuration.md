# Pipeline Configuration — Profiles, Inheritance & Validation

Generated: 2026-08-18T12:34:03+05:30

Purpose
-------
Describes how pipeline configuration is modeled, stored, and resolved. Pipeline configuration controls naming, path templates, publish rules, validators, and tool mappings.

Configuration levels & precedence
--------------------------------
Configuration can be defined at multiple levels. Precedence (highest → lowest):
1. Organization overrides
2. Production
3. Project
4. Department
5. Asset Type / Shot Type / Task Type
6. Pipeline Profile defaults

Pipeline Profile
----------------
A Pipeline Profile is a named set of defaults for a class of productions (e.g., Feature Film, TV Episodic, Commercial, Game Cinematic). Profiles bundle:
- Default path templates
- Default publish rules
- Tool mappings (which DCCs are allowed)
- Validator sets
- Naming conventions

Storage of configuration
------------------------
- Configuration should be serializable (JSON/YAML) and stored versioned in StudioHub (with a configuration version).
- Changes to active configuration must be subject to validation and an effective date.

Validation & activation
-----------------------
- Config changes must pass validation checks (template correctness, storage mappings, tool availability) before activation.
- Provide dry-run and preview modes for configuration changes.

Example configuration keys
--------------------------
- path_templates: {project_root: "{org}/{production}/{project}", publish_root: "{project_root}/publishes/{asset_or_shot}/{version}"}
- validators: ["scene_validator", "checksum_validator"]
- publish_rules: {animation_publish: {allowed_task_types: ["animation"], formats: ["alembic"]}}
- storage_map: {publish: "s3://studio/publishes", working: "/mnt/work"}

End of pipeline configuration document.
