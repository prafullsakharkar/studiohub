# Publish Rules — Definition & Examples

Generated: 2026-08-18T12:34:07+05:30

Purpose
-------
Define publish rules: declarative specifications that control which publishes are allowed, their naming, expected representations, validators, and required approvals.

Components of a Publish Rule
---------------------------
- id
- name
- allowed_source_task_types
- allowed_publish_types (alembic, usd, exr_sequence, mp4, other)
- naming_template
- storage_location_key
- required_validators
- required_approvals
- idempotency_key_strategy (e.g., source_version + publish_type)

Example rule (animation cache)
------------------------------
- allowed_source_task_types: ["animation"]
- allowed_publish_types: ["alembic"]
- naming_template: "{project}_{asset}_{publish_type}_{version}.abc"
- required_validators: ["geometry_validator", "checksum_validator"]
- required_approvals: ["supervisor"]

Enforcement
-----------
- Rules are enforced by the publish job and pre-publish validators.
- Rule violations produce structured errors and prevent publish registration.

End of publish rules document.
