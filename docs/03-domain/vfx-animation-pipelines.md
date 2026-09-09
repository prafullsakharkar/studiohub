# VFX & Animation Pipeline Overviews

This document provides canonical high-level overviews of common VFX and Animation pipelines and explains how StudioHub models them through configurable domains and workflows.

## Design principle

StudioHub models stable domain concepts (Assets, Shots, Tasks, Versions, Reviews). Studios express their pipeline via configuration: department definitions, workflow states, task templates, and automation rules. The platform must support multiple pipeline topologies.

---

## Example — Asset-centered VFX pipeline

Modeling → Texturing → Lookdev → Rigging → Groom → Publish Asset

How StudioHub models it:
- Asset domain holds the Asset and AssetVersions
- Task domain holds the per-department tasks (e.g., Modeling Task, Rigging Task)
- Workflow engine drives per-asset task transitions
- Publish registers the published asset versions for consumption by shots

---

## Example — Shot-centered VFX pipeline

Editorial → Matchmove → Layout → Animation → CFX → Lighting → Compositing → Final

How StudioHub models it:
- Shot domain holds shot metadata and frame ranges
- Task domain manages department tasks (Animation Task, Lighting Task)
- Version domain holds versions submitted by artists for review
- Review domain captures notes and approvals
- Publish/Deliver handles final output registration and delivery

---

## Example — Animation studio pipeline

Story → Storyboard → Layout → Blocking → Animation → Character FX → Lighting → Render → Comp → Final

How StudioHub models it:
- Project/Production contexts capture story and episode-level metadata
- Tasks and Task Templates represent discipline-specific work
- Versions and Review sessions are central for creative feedback loops
- Workflow configurations support different state machines per department

---

## Key takeaways

- StudioHub does not hard-code department sequences; studios configure department lists and workflow graphs.
- StudioHub supports sharing assets across projects and productions where appropriate.
- Integration points (publishers, renderers, review tools) are the recommended way to connect external processing systems.

