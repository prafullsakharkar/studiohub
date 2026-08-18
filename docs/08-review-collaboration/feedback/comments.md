# Comments — Threads, Mentions & Resolution

Generated: 2026-08-18T12:53:51+05:30

Purpose
-------
Defines the comment model, threading, mentions, resolution states, priorities and categories used during reviews.

Comment model
-------------
- id (UUID)
- review_id, review_item_id
- author_id
- body (text)
- frame (optional)
- frame_range (optional)
- parent_id (optional for thread replies)
- visibility (internal|external|restricted)
- tags []
- status (open|in_progress|resolved|closed)
- priority (critical|high|normal|low)
- created_at, updated_at

Threads & replies
-----------------
- Comments may be replied to forming threads; preserve parent relationships and ordering
- Thread resolution changes the status of the root comment

Mentions
--------
- @user, @team, @role should be supported and trigger notifications according to preferences

APIs
----
- POST /api/v1/comments/
- POST /api/v1/comments/{id}/resolve

Events
------
- CommentCreated, CommentReplied, CommentResolved

Testing
-------
- Test visibility enforcement, mention notifications, thread ordering, and resolution idempotency

End of comments doc.
