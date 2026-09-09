Events → Notification mapping (overview)

This page should document the canonical event → notification mappings. Keep domain-specific examples in domain docs and reference this file for platform-level routing.

Initial event examples (create and extend as needed):

- task.assigned.v1 -> notify assignee, watchers
- task.due_soon.v1 -> notify assignee, lead
- version.submitted.v1 -> notify reviewers, lead
- version.approved.v1 -> notify author, watchers
- review.requested.v1 -> notify reviewers
- comment.created.v1 -> notify mentioned users, watchers

For each mapping include:
- event contract (JSON schema)
- default channels
- mandatory or optional
- grouping key strategy
- suggested dedupe key
