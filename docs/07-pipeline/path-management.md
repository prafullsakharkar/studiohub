# Path Management — Templates, Resolver & Mapping

Generated: 2026-08-18T12:34:04+05:30

Purpose
-------
Defines StudioHub's path management strategy: logical path templates, PathResolver behavior, and physical path mapping to multiple storage backends and platforms.

Logical vs Physical paths
-------------------------
- Logical path: an abstract path built from templates and context variables (e.g., `{project_root}/{sequence}/{shot}/{department}/{task}/{version}`)
- Physical path: OS/storage-specific path resolved from logical path and storage mapping (e.g., `/mnt/shows/foo/seq/...` or `s3://studio/publishes/...`)

Path templates
--------------
- Templates use named variables drawn from Pipeline Context (project, sequence, shot, asset, task, version, publish_type).
- Templates must be validated to ensure variables exist and do not produce unsafe paths.

PathResolver responsibilities
-----------------------------
- Render logical templates into logical paths
- Validate output (no path traversal, within allowed roots)
- Map logical paths to platform-specific physical paths using StorageMap
- Support Windows and Unix-style outputs

Path mapping
------------
- StorageMap defines which physical backend is used for a logical location (working, publish, review, archive)
- Each mapping may include platform-specific overrides

Security
--------
- PathResolver must sanitize inputs and enforce allowed roots; never allow client-supplied absolute paths to bypass mappings.

Testing
-------
- Unit tests for template rendering and variable substitution
- Integration tests for mapping resolution across platforms

End of path management document.
