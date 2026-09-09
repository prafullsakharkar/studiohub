# Production Workflows — Definition and DSL

Generated: 2026-08-18T12:22:35+05:30

Purpose
-------
Defines how workflows are modelled, configured, and executed within StudioHub. Includes examples for Shot, Task and Publish workflows and guidance for workflow authors and implementers.

Principles
----------
- Workflows are configuration artifacts owned by a Production (or shared templates).
- Workflows define states, transitions, guards, side-effects and SLA timers.
- Workflow execution is handled by Application Services; domain entities validate state transitions.
- Keep workflows declarative and small. Complex orchestration remains in Application Services but invokes workflow rules.

Workflow model
--------------
A Workflow is composed of:
- id, name, description
- entity_type (shot|task|publish|asset)
- states: list of named states
- transitions: list of {name, from_states, to_state, guard, action}
- state_meta: per-state metadata (assignment_rules, auto_advance, sla_seconds)
- entry_actions / exit_actions: optional side-effects
- version: numeric schema version

State
- name: unique string (e.g., "in_progress")
- display_name
- auto_assign: optional rule to auto-assign to role or resource
- notification_template_id: optional

Transition
- name: short id (e.g., "submit_for_review")
- from: one or more state names
- to: destination state
- guard: a declarative condition (optional) expressed in small DSL or reference to domain validator function
- action: named side-effect to run on transition (e.g., create_review, notify)

Guards and validators
---------------------
Guards are small predicates that decide whether a transition is permitted. Implement guards as domain validators called by Application Services. Typical guards:
- has_all_required_artifacts (ensure thumbnails, proxies present)
- approvals_count >= N
- user_has_role('dept_lead')

Actions and side-effects
------------------------
- Actions are tasks triggered by transitions: send_notification, start_transcode, create_playlist, publish_artifact.
- Keep actions idempotent and execute them via background workers where long-running.

Timers and SLA
--------------
- Workflows may specify sla_seconds for states; the scheduler service monitors and raises alerts or can auto-advance (if configured).
- SLA violations generate operational events (SLAExceeded) and notifications.

Example: Shot workflow (typical)
--------------------------------
States: draft, layout, animation, fx, lighting, comp, review, approved, published
Transitions:
- start_layout: draft -> layout
- complete_layout: layout -> animation
- complete_animation: animation -> fx
- complete_fx: fx -> lighting
- complete_lighting: lighting -> comp
- submit_for_review: comp -> review (guard: all_tasks_complete)
- approve: review -> approved (action: create_publish)
- publish: approved -> published (action: PublishService.publish)

Example: Task workflow
----------------------
States: todo, in_progress, review, done
Transitions: assign (todo -> in_progress), submit_review (in_progress -> review), approve (review -> done), reject (review -> in_progress)

Example: Publish workflow
-------------------------
States: staged, validating, published, failed
Transitions: stage -> validating (action: validate_publish), validating -> published (action: move_to_storage), validating -> failed

Configuration and storage
-------------------------
- Workflows are stored as JSON/YAML configuration documents in the Production context (table: production_workflows) with a schema version.
- Provide a workflow editor UI for producers; editors produce versioned workflow artifacts.
- Keep default workflows in code for initial installations; studios can override via UI.

Runtime enforcement
-------------------
- Application Services call domain validators to check guards before performing transitions under transaction.atomic blocks.
- Use on_commit hooks to schedule actions and background tasks.
- Record transition history for auditing (who performed transition, when, metadata).

Extensibility
-------------
- Allow custom guard functions and action handlers to be registered via Infrastructure adapters (plugin pattern), but require ADR sign-off before adding core-side effects.

Best practices
--------------
- Keep workflows declarative and domain-focused.
- Avoid heavy scripting inside workflow definitions. Use actions to perform complex tasks.
- Always record transition history and actor information.
- Provide tooling for safe workflow migrations (backwards-compatible changes only; breaking changes require migration and ADR).

End of workflows document.
