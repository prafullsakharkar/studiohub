# StudioHub Notifications Architecture

## Event-Driven Notification System
StudioHub dispatches notifications based on lifecycle triggers in production workflows.

---

## Channels
- **In-App Toast & Feed**: Real-time notifications dispatched via WebSockets/polling.
- **Email Dispatch**: Celery asynchronous tasks queue emails for review requests, assignment changes, and delivery sign-offs.

---

## Trigger Events
1. **Task Assignment**: Assigned artist is notified when a high-priority task is queued.
2. **Review Scheduled**: Screening room invitations sent to supervisors and client reviewers.
3. **Approval Verdict**: Artist notified immediately upon shot approval or revision requests.
4. **Turnover Ready**: Client contacts alerted when a Delivery Package completes validation.
