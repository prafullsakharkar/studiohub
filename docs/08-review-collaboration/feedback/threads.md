# Threads — Discussion, Resolution & Linking

Generated: 2026-08-18T12:53:51+05:30

Purpose
-------
Defines discussion thread behavior for comments and annotations within reviews: lifecycle, linking to tasks, and resolution semantics.

Thread concepts
---------------
- A thread is rooted at a comment or annotation and contains ordered replies
- Threads can be converted to tasks when action is required

Thread attributes
-----------------
- id (UUID)
- root_comment_id
- review_id
- status (open|resolved|reopened|closed)
- assignee_id (optional)
- linked_task_id (optional)
- created_at, updated_at

Conversion to tasks
-------------------
- Conversion must preserve context (frame, annotation geometry, author) and create a Task linked back to the original thread
- Conversion requires permission checks

APIs & events
-------------
- POST /api/v1/threads/{id}/convert_to_task
- ThreadResolved, ThreadReopened

End of threads doc.
