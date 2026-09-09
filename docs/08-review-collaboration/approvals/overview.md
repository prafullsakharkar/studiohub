# Approvals — Decisions, Quorum & Gates

Generated: 2026-08-18T12:53:51+05:30

Purpose
-------
Defines approval concepts: decision types, approval policies (quorum), approval gates, history, and integration with production workflows (publishing, delivery, task completion).

Core concepts
-------------
- ApprovalRequest: a request for one or more reviewers to approve a ReviewItem or Playlist
- ApprovalDecision: a recorded decision (approve|approve_with_notes|request_changes|reject|hold)
- ApprovalPolicy: template for required approvers, quorum, and escalation

Attributes
----------
- approval_request: {id, review_id, item_ids, requested_by, requested_at, policy_id}
- approval_decision: {id, approval_request_id, reviewer_id, decision, comment, timestamp}

Quorum & gate examples
-----------------------
- single_approver: any one approver required
- role_based: specific role(s) must approve (client + supervisor)
- majority: majority of assigned approvers

Immutability & history
----------------------
- Preserve full approval history (who, when, what) and never overwrite decisions
- Approval references exact Version/Representation to avoid moving targets

APIs & events
-------------
- POST /api/v1/approvals/request
- POST /api/v1/approvals/{id}/decide
- ApprovalRequested, ApprovalGranted, ApprovalRejected

Testing
-------
- Test concurrent approvals, quorum rules, reopen flows and idempotency

End of approvals doc.
