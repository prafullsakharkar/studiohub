-- READ-ONLY audit for staging: rows that the new status, timelog and separation-of-duties
-- rules would not allow. SELECT statements only; nothing here changes data. Run each
-- block on its own and keep the output. Tables are the PostgreSQL names of apps/production.
-- (This was not run by the author on any non-test database.)

-- 1. Statuses outside each entity's valid set (they can still move to any valid status).
SELECT 'timelog' AS entity, status, count(*) FROM production_timelog
  WHERE is_deleted = false AND status NOT IN ('Draft','Submitted','Approved','Rejected') GROUP BY status
UNION ALL
SELECT 'review', status, count(*) FROM production_review
  WHERE is_deleted = false AND status NOT IN
    ('Pending Review','Submitted','In Review','Changes Requested','Retake','Rejected','Approved','Closed') GROUP BY status
UNION ALL
SELECT 'shot', status, count(*) FROM production_shot
  WHERE is_deleted = false AND status NOT IN
    ('Not Started','In Progress','Pending Review','Retake','On Hold','Approved','Archived') GROUP BY status
UNION ALL
SELECT 'task', status, count(*) FROM production_task
  WHERE is_deleted = false AND status NOT IN
    ('Not Started','In Progress','Pending Review','Retake','Approved','Archived') GROUP BY status
UNION ALL
SELECT 'version', status, count(*) FROM production_version
  WHERE is_deleted = false AND status NOT IN
    ('Not Started','In Progress','Pending Review','Retake','Approved','Archived') GROUP BY status;

-- 2. Timelogs: approved or rejected rows the new rules would not have produced.
-- 2a. Approved without an approver or time of approval.
SELECT id, person_id, status, approved_by_id, approved_at FROM production_timelog
  WHERE status = 'Approved' AND (approved_by_id IS NULL OR approved_at IS NULL);
-- 2b. Approved by the person who logged it (self-approval) or by whoever created the entry.
SELECT id, person_id, created_by_id, approved_by_id, approved_at FROM production_timelog
  WHERE status = 'Approved' AND (approved_by_id = person_id OR approved_by_id = created_by_id);
-- 2c. Rejected without a reason (a reason is now required).
SELECT id, person_id, status FROM production_timelog
  WHERE status = 'Rejected' AND btrim(coalesce(rejection_reason, '')) = '';
-- 2d. Rows with approval data that are not Approved (stale approver after a status edit).
SELECT id, status, approved_by_id, approved_at FROM production_timelog
  WHERE status <> 'Approved' AND (approved_by_id IS NOT NULL OR approved_at IS NOT NULL);
-- 2e. Timelogs with no project (status history cannot be written for them) or a task of another project.
SELECT t.id, t.project_id, k.project_id AS task_project_id FROM production_timelog t
  JOIN production_task k ON k.id = t.task_id
  WHERE t.project_id IS NULL OR t.project_id IS DISTINCT FROM k.project_id;

-- 3. Versions: approvals the separation-of-duties rule would refuse.
-- 3a. Approved versions whose artist or creator is the only recorded producer (candidates for review).
SELECT id, code, artist_id, created_by_id, updated_by_id, task_id FROM production_version
  WHERE status = 'Approved' AND is_deleted = false
    AND (artist_id IS NOT DISTINCT FROM updated_by_id OR created_by_id IS NOT DISTINCT FROM updated_by_id);
-- 3b. Published versions that are not Approved (the status of a published version is now frozen).
SELECT id, code, status, is_published FROM production_version
  WHERE is_published AND status <> 'Approved' AND is_deleted = false;
-- 3c. Heroes that are not Approved.
SELECT id, code, status FROM production_version WHERE is_hero AND status <> 'Approved' AND is_deleted = false;

-- 4. Shots: Approved is entered from Pending Review only; these disagree with their own flags.
SELECT id, code, status, supervisor_approved FROM production_shot
  WHERE is_deleted = false AND ((status = 'Approved') <> supervisor_approved);

-- 5. Archived statuses: restore now brings a record back to its previous status.
SELECT 'shot' AS entity, count(*) FROM production_shot WHERE is_deleted = false AND status = 'Archived'
UNION ALL SELECT 'task', count(*) FROM production_task WHERE is_deleted = false AND status = 'Archived'
UNION ALL SELECT 'version', count(*) FROM production_version WHERE is_deleted = false AND status = 'Archived';

-- 6. Reviews: decisions with no way to tell who submitted them (no history yet) and open
-- reviews whose subject is not a UUID of the same project (separation cannot resolve it).
SELECT id, code, status, entity_type, entity_id FROM production_review
  WHERE is_deleted = false
    AND entity_type IN ('Version','Shot','Task')
    AND entity_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- 7. After deploy: every use of an override.
SELECT changed_at, entity_type, entity_code, from_status, to_status, override_kind, reason, actor_id
  FROM production_status_history WHERE override_kind <> '' ORDER BY changed_at DESC;
-- 7b. Role grants of the opt-in codes (expected: none unless an admin granted them by hand).
SELECT r.code AS role, p.code AS permission FROM identity_role_permission rp
  JOIN identity_role r ON r.id = rp.role_id
  JOIN identity_permission p ON p.id = rp.permission_id
  WHERE p.code IN ('production.status.override','production.sod.override') AND rp.granted;
