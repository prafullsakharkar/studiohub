-- READ-ONLY check before RP-1 drops six JSON columns of production_version (PLAN WP 1.6):
-- media_items, attachments, reviews, playlists, notes_list, activity.
-- RUN IT BEFORE APPLYING MIGRATION production 0004_drop_version_json_copies: afterwards the columns are
-- gone and every statement here fails. (It was checked against the schema before 0004 by
-- apps/production/tests/test_rp1_staging_audit_sql.py, which went with the drop; see commit 83167cec.)
-- Since RP-1 nothing serves or writes them (C-RP-01, C-RP-02). They were stored copies (production
-- DECISIONS D-18); the records are the truth. This shows what is in them, so that anything that looks
-- hand-entered is seen before it goes. SELECT statements only; nothing here changes data. Run each block
-- on its own (PostgreSQL) and keep the output.
-- (Not run by the author on any non-test database.)

-- 1. How many versions hold something in each column (archived versions included), how many of those
--    are archived, and how many hold something that is not a list at all.
SELECT 'media_items' AS column_name,
       count(*) FILTER (WHERE media_items IS NOT NULL AND media_items <> '[]'::jsonb) AS versions_with_data,
       count(*) FILTER (WHERE media_items IS NOT NULL AND media_items <> '[]'::jsonb AND is_deleted) AS of_them_archived,
       count(*) FILTER (WHERE jsonb_typeof(media_items) IS DISTINCT FROM 'array') AS not_a_list
  FROM production_version
UNION ALL
SELECT 'attachments',
       count(*) FILTER (WHERE attachments IS NOT NULL AND attachments <> '[]'::jsonb),
       count(*) FILTER (WHERE attachments IS NOT NULL AND attachments <> '[]'::jsonb AND is_deleted),
       count(*) FILTER (WHERE jsonb_typeof(attachments) IS DISTINCT FROM 'array')
  FROM production_version
UNION ALL
SELECT 'reviews',
       count(*) FILTER (WHERE reviews IS NOT NULL AND reviews <> '[]'::jsonb),
       count(*) FILTER (WHERE reviews IS NOT NULL AND reviews <> '[]'::jsonb AND is_deleted),
       count(*) FILTER (WHERE jsonb_typeof(reviews) IS DISTINCT FROM 'array')
  FROM production_version
UNION ALL
SELECT 'playlists',
       count(*) FILTER (WHERE playlists IS NOT NULL AND playlists <> '[]'::jsonb),
       count(*) FILTER (WHERE playlists IS NOT NULL AND playlists <> '[]'::jsonb AND is_deleted),
       count(*) FILTER (WHERE jsonb_typeof(playlists) IS DISTINCT FROM 'array')
  FROM production_version
UNION ALL
SELECT 'notes_list',
       count(*) FILTER (WHERE notes_list IS NOT NULL AND notes_list <> '[]'::jsonb),
       count(*) FILTER (WHERE notes_list IS NOT NULL AND notes_list <> '[]'::jsonb AND is_deleted),
       count(*) FILTER (WHERE jsonb_typeof(notes_list) IS DISTINCT FROM 'array')
  FROM production_version
UNION ALL
SELECT 'activity',
       count(*) FILTER (WHERE activity IS NOT NULL AND activity <> '[]'::jsonb),
       count(*) FILTER (WHERE activity IS NOT NULL AND activity <> '[]'::jsonb AND is_deleted),
       count(*) FILTER (WHERE jsonb_typeof(activity) IS DISTINCT FROM 'array')
  FROM production_version;

-- 2. Up to 20 of the most recently changed versions per column that hold something, with the first
--    300 characters, to judge by eye whether any of it was typed by a person.
-- 2a. media_items
SELECT v.id, p.code AS project, v.code, v.is_deleted AS archived,
       CASE WHEN jsonb_typeof(v.media_items) = 'array' THEN jsonb_array_length(v.media_items) END AS entries,
       left(v.media_items::text, 300) AS sample
  FROM production_version v LEFT JOIN production_project p ON p.id = v.project_id
  WHERE v.media_items IS NOT NULL AND v.media_items <> '[]'::jsonb
  ORDER BY v.updated_at DESC LIMIT 20;
-- 2b. attachments
SELECT v.id, p.code AS project, v.code, v.is_deleted AS archived,
       CASE WHEN jsonb_typeof(v.attachments) = 'array' THEN jsonb_array_length(v.attachments) END AS entries,
       left(v.attachments::text, 300) AS sample
  FROM production_version v LEFT JOIN production_project p ON p.id = v.project_id
  WHERE v.attachments IS NOT NULL AND v.attachments <> '[]'::jsonb
  ORDER BY v.updated_at DESC LIMIT 20;
-- 2c. reviews
SELECT v.id, p.code AS project, v.code, v.is_deleted AS archived,
       CASE WHEN jsonb_typeof(v.reviews) = 'array' THEN jsonb_array_length(v.reviews) END AS entries,
       left(v.reviews::text, 300) AS sample
  FROM production_version v LEFT JOIN production_project p ON p.id = v.project_id
  WHERE v.reviews IS NOT NULL AND v.reviews <> '[]'::jsonb
  ORDER BY v.updated_at DESC LIMIT 20;
-- 2d. playlists
SELECT v.id, p.code AS project, v.code, v.is_deleted AS archived,
       CASE WHEN jsonb_typeof(v.playlists) = 'array' THEN jsonb_array_length(v.playlists) END AS entries,
       left(v.playlists::text, 300) AS sample
  FROM production_version v LEFT JOIN production_project p ON p.id = v.project_id
  WHERE v.playlists IS NOT NULL AND v.playlists <> '[]'::jsonb
  ORDER BY v.updated_at DESC LIMIT 20;
-- 2e. notes_list
SELECT v.id, p.code AS project, v.code, v.is_deleted AS archived,
       CASE WHEN jsonb_typeof(v.notes_list) = 'array' THEN jsonb_array_length(v.notes_list) END AS entries,
       left(v.notes_list::text, 300) AS sample
  FROM production_version v LEFT JOIN production_project p ON p.id = v.project_id
  WHERE v.notes_list IS NOT NULL AND v.notes_list <> '[]'::jsonb
  ORDER BY v.updated_at DESC LIMIT 20;
-- 2f. activity
SELECT v.id, p.code AS project, v.code, v.is_deleted AS archived,
       CASE WHEN jsonb_typeof(v.activity) = 'array' THEN jsonb_array_length(v.activity) END AS entries,
       left(v.activity::text, 300) AS sample
  FROM production_version v LEFT JOIN production_project p ON p.id = v.project_id
  WHERE v.activity IS NOT NULL AND v.activity <> '[]'::jsonb
  ORDER BY v.updated_at DESC LIMIT 20;

-- 3. Entries of the playlists copy (written by add-to-playlist before RP-1 as {playlist_id, playlist_name})
--    with no live playlist entry for that version behind them. An entry with no playlist_id was an add by
--    name, which never made an entry; the others are versions since taken off the playlist. Neither is a
--    record of anything the playlist holds now.
SELECT v.id AS version_id, v.code, e ->> 'playlist_id' AS playlist_id, e ->> 'playlist_name' AS playlist_name
  FROM production_version v
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(v.playlists) = 'array' THEN v.playlists ELSE '[]'::jsonb END) AS e
  WHERE NOT EXISTS (
    SELECT 1 FROM production_playlist_entry pe
     WHERE pe.version_id = v.id AND pe.is_deleted = false AND pe.playlist_id::text = e ->> 'playlist_id')
  ORDER BY v.code;
