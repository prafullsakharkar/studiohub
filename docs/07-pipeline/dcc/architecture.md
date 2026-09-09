# DCC Adapter Architecture — Patterns & Responsibilities

Generated: 2026-08-18T12:34:06+05:30

Purpose
-------
Defines the recommended adapter and plugin architecture for integrating DCC applications with StudioHub.

Adapter responsibilities
------------------------
- discover_context(): determine task/asset/shot context from passed context or workspace
- collect_scene_metadata(): gather frame ranges, dependencies, linked assets, plugins used
- create_workspace(): prepare folders and environment variables for the DCC
- save_scene(): save a scene file with canonical naming
- publish(): perform a publish operation via PipelineSDK or REST API
- validate_scene(): run registered validators and return structured results
- notify(): emit pipeline events on completion

Plugin packaging
----------------
- Plugins should be packaged per DCC and versioned independently
- Require a small bootstrap loader that obtains StudioHub tokens and context

Communication
-------------
- Prefer the SDK or REST API for commands that change StudioHub state
- Use webhooks/events for asynchronous notifications from external systems

Testing & sandboxing
--------------------
- Provide a sandbox project for plugin development and testing
- Validate plugin behavior in offline or mocked environments

End of DCC adapter architecture document.
