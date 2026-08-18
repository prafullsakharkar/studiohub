# Pipeline Context — Runtime Context for DCC and CLI

Generated: 2026-08-18T12:34:02+05:30

Purpose
-------
Defines the runtime Pipeline Context used by DCC plugins, CLI tools, and pipeline jobs to answer: "What am I working on?" The Context is an explicit, first-class object that avoids unreliable path-parsing heuristics.

Canonical context model
-----------------------
A Pipeline Context is a serializable object containing:
- user_id (optional for service accounts)
- organization_id
- production_id
- project_id
- sequence_id (optional)
- shot_id (optional)
- asset_id (optional)
- task_id (optional)
- department_id (optional)
- pipeline_profile (optional)
- workspace_id (optional)
- environment (dictionaries: software versions, toolchain)

Resolution hierarchy
-------------------
When resolving context, prefer explicit StudioHub arguments, then workspace metadata, then filesystem/path inference:
1. Explicit context (UI, CLI flags, SDK call)
2. Workspace (stored workspace record)
3. File metadata (sidecar json)
4. Path inference (template matching)

Interaction patterns
--------------------
- DCC plugin receives a context token from launcher or user, validates it against StudioHub, and then uses the PipelineSDK to query task/version details.
- CLI can bootstrap context from a workspace file or flags: `studiohub open --task TASK_ID`.
- Pipeline jobs receive context in job payloads and validate before executing.

Security
--------
- Context tokens should be short-lived and bound to a workspace or user.
- Service accounts used by automated systems should have restricted scopes and audit trails.

End of pipeline context document.
