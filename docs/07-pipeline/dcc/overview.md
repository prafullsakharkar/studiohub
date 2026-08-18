# DCC Integration — Overview

Generated: 2026-08-18T12:34:05+05:30

Purpose
-------
Overview of StudioHub's approach to integrating Digital Content Creation (DCC) tools. This page describes principles for adapters, plugins, the PipelineSDK, and how DCCs should interact with StudioHub.

Principles
----------
- DCC integrations are optional adapters that never access the database directly.
- Communication channels: REST API, short-lived tokens, CLI/SDK, or events/websockets where appropriate.
- Keep business rules inside StudioHub; DCCs request operations via the API/SDK.

Adapter model
-------------
- DCCAdapter: abstract interface for collect(), publish(), validate(), create_workspace(), and metadata extraction.
- DCC plugin: implementation for a specific DCC (maya, houdini, nuke, blender). Plugins use PipelineSDK and authenticate to StudioHub.

Security
--------
- DCC plugins use short-lived credentials and respect user permissions.

End of DCC overview.
