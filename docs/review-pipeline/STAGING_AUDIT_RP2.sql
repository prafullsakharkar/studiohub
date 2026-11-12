-- READ-ONLY check before RP-2 back-fills note links (PLAN WP 2.6).
-- RUN IT BEFORE APPLYING MIGRATION production 0006_rp2_backfill_note_links (0005 may already be applied:
-- this reads only production_project_note and the record tables, whose columns 0005 does not change).
-- Migration 0006 gives a note one link when its stored entity_type is one a note can link to (Episode,
-- Sequence, Shot, Asset, Version, Playlist, Review; case does not matter), its entity_id is a UUID, and a
-- record of that type with that id is in the note's own project (archived records count). Every other
-- note keeps no link: its stored entity_type, entity_id, entity_code and entity_name stay as they are and
-- are still served (C-RP-08), but the new entity_type + entity_id filter (C-RP-09) does not find it.
-- This shows how many notes fall in each case, and which ones will keep no link, before the migration
-- runs. SELECT statements only; nothing here changes data. Run each block on its own (PostgreSQL) and
-- keep the output. Both blocks start with the same WITH part, so each can be run alone.
-- (Checked on the test database by apps/production/tests/test_rp2_staging_audit_sql.py; not run by the
-- author on any non-test database.)

-- 1. Every note (archived included) by what 0006 will do with it.
WITH notes AS (
  SELECT n.id, n.project_id, n.is_deleted, n.entity_type, n.entity_id, n.entity_code, n.subject, n.created_at,
         CASE lower(trim(n.entity_type))
           WHEN 'episode' THEN 'Episode' WHEN 'sequence' THEN 'Sequence' WHEN 'shot' THEN 'Shot'
           WHEN 'asset' THEN 'Asset' WHEN 'version' THEN 'Version' WHEN 'playlist' THEN 'Playlist'
           WHEN 'review' THEN 'Review' END AS link_type,
         CASE WHEN trim(n.entity_id) ~* '^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$'
              THEN trim(n.entity_id)::uuid END AS record_id
    FROM production_project_note n
), judged AS (
  SELECT notes.*,
         CASE
           WHEN trim(entity_type) IN ('', 'Project') THEN 'on the project (no record named)'
           WHEN link_type IS NULL THEN 'type cannot be linked'
           WHEN record_id IS NULL THEN 'id is not a UUID'
           WHEN EXISTS (SELECT 1 FROM production_episode  r WHERE link_type = 'Episode'  AND r.id = record_id AND r.project_id = notes.project_id)
             OR EXISTS (SELECT 1 FROM production_sequence r WHERE link_type = 'Sequence' AND r.id = record_id AND r.project_id = notes.project_id)
             OR EXISTS (SELECT 1 FROM production_shot     r WHERE link_type = 'Shot'     AND r.id = record_id AND r.project_id = notes.project_id)
             OR EXISTS (SELECT 1 FROM production_asset    r WHERE link_type = 'Asset'    AND r.id = record_id AND r.project_id = notes.project_id)
             OR EXISTS (SELECT 1 FROM production_version  r WHERE link_type = 'Version'  AND r.id = record_id AND r.project_id = notes.project_id)
             OR EXISTS (SELECT 1 FROM production_playlist r WHERE link_type = 'Playlist' AND r.id = record_id AND r.project_id = notes.project_id)
             OR EXISTS (SELECT 1 FROM production_review   r WHERE link_type = 'Review'   AND r.id = record_id AND r.project_id = notes.project_id)
             THEN 'will be linked'
           ELSE 'no such record in the note''s project'
         END AS outcome
    FROM notes
)
SELECT outcome, count(*) AS notes, count(*) FILTER (WHERE is_deleted) AS of_them_archived
  FROM judged GROUP BY outcome ORDER BY outcome;

-- 2. Up to 50 of the most recent notes that name a record but will keep no link, to judge by eye.
WITH notes AS (
  SELECT n.id, n.project_id, n.is_deleted, n.entity_type, n.entity_id, n.entity_code, n.subject, n.created_at,
         CASE lower(trim(n.entity_type))
           WHEN 'episode' THEN 'Episode' WHEN 'sequence' THEN 'Sequence' WHEN 'shot' THEN 'Shot'
           WHEN 'asset' THEN 'Asset' WHEN 'version' THEN 'Version' WHEN 'playlist' THEN 'Playlist'
           WHEN 'review' THEN 'Review' END AS link_type,
         CASE WHEN trim(n.entity_id) ~* '^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$'
              THEN trim(n.entity_id)::uuid END AS record_id
    FROM production_project_note n
), judged AS (
  SELECT notes.*,
         CASE
           WHEN trim(entity_type) IN ('', 'Project') THEN 'on the project (no record named)'
           WHEN link_type IS NULL THEN 'type cannot be linked'
           WHEN record_id IS NULL THEN 'id is not a UUID'
           WHEN EXISTS (SELECT 1 FROM production_episode  r WHERE link_type = 'Episode'  AND r.id = record_id AND r.project_id = notes.project_id)
             OR EXISTS (SELECT 1 FROM production_sequence r WHERE link_type = 'Sequence' AND r.id = record_id AND r.project_id = notes.project_id)
             OR EXISTS (SELECT 1 FROM production_shot     r WHERE link_type = 'Shot'     AND r.id = record_id AND r.project_id = notes.project_id)
             OR EXISTS (SELECT 1 FROM production_asset    r WHERE link_type = 'Asset'    AND r.id = record_id AND r.project_id = notes.project_id)
             OR EXISTS (SELECT 1 FROM production_version  r WHERE link_type = 'Version'  AND r.id = record_id AND r.project_id = notes.project_id)
             OR EXISTS (SELECT 1 FROM production_playlist r WHERE link_type = 'Playlist' AND r.id = record_id AND r.project_id = notes.project_id)
             OR EXISTS (SELECT 1 FROM production_review   r WHERE link_type = 'Review'   AND r.id = record_id AND r.project_id = notes.project_id)
             THEN 'will be linked'
           ELSE 'no such record in the note''s project'
         END AS outcome
    FROM notes
)
SELECT j.id, p.code AS project, j.is_deleted AS archived, j.entity_type, j.entity_id, j.entity_code,
       left(j.subject, 80) AS subject, j.outcome, j.created_at
  FROM judged j
  LEFT JOIN production_project p ON p.id = j.project_id
 WHERE j.outcome NOT IN ('will be linked', 'on the project (no record named)')
 ORDER BY j.created_at DESC
 LIMIT 50;
