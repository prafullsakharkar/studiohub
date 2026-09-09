# Workspaces — Technical Work Environments

Generated: 2026-08-18T12:34:03+05:30

Purpose
-------
Defines Workspace: a reproducible, named, technical environment where artists run DCCs and produce files. Workspaces simplify context resolution and environment setup for DCC plugins and CLI tools.

Workspace model
---------------
A Workspace is a record mapping a user+project+task to a root path and environment configuration.
Attributes:
- id (UUID)
- name
- user_id
- project_id
- production_id
- task_id (optional)
- root_path (logical)
- mapped_paths {platform: physical_root}
- environment (python, dcc versions, plugin list)
- created_at, last_used

Workspace lifecycle
-------------------
- create → configure → validate → open → refresh → archive → destroy

Workspace usage
---------------
- Launcher or CLI creates a workspace record and bootstraps a DCC with the environment.
- DCC plugins read workspace metadata for path resolution and asset collection.

Security
--------
Workspaces must not store secrets. Any credentials required for transfers must be requested at runtime or stored in secure secret stores and referenced by workspace.

End of workspaces document.
