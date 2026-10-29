-- btree_gist for Scheduling Phase 10 (docs/scheduling/PLAN.md, decision Q32).
--
-- The booking exclusion constraint compares a resource id with "=" and a time range with "&&"
-- inside one GiST index, which needs this extension. Migration scheduling 0008 runs
-- CREATE EXTENSION IF NOT EXISTS btree_gist itself; this script is for checking a database
-- first, or for an administrator to install it when the application role may not. (The test
-- cluster already has it, installed by masterdata's migration 0007.)
--
-- Run once per database (the test database, staging, production), connected TO that database:
--   psql -h <host> -U <role> -d <database> -f docs/scheduling/BTREE_GIST.sql
--
-- Needs: (1) the server to have the contrib files installed. On RHEL-style hosts with
-- PostgreSQL 17 that is the `postgresql17-contrib` package, which provides
-- /usr/pgsql-17/share/extension/btree_gist.control. A database role cannot install them.
-- (2) A role with CREATE on the database (btree_gist is a trusted extension since PostgreSQL 13),
-- otherwise a superuser.
--
-- Safe to run again. It creates one extension and changes no table or data.

-- 1. Is it on the server? Zero rows means the package from (1) is missing: stop here.
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name = 'btree_gist';

-- 2. Create it (does nothing if it is already there).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 3. Confirm. Expect one row with the version.
SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist';

-- 4. Prove it works: an exclusion constraint on a throwaway temporary table.
--    The second row overlaps the first for the same resource, so the INSERT must fail with
--    "conflicting key value violates exclusion constraint". Nothing is kept: the table is
--    temporary and the transaction rolls back.
BEGIN;
CREATE TEMPORARY TABLE btree_gist_probe (
    resource_id uuid NOT NULL,
    span tstzrange NOT NULL,
    EXCLUDE USING gist (resource_id WITH =, span WITH &&)
);
INSERT INTO btree_gist_probe VALUES
    ('00000000-0000-0000-0000-000000000001', tstzrange('2026-11-02 09:00+00', '2026-11-02 10:00+00'));
-- Different resource, same time: allowed.
INSERT INTO btree_gist_probe VALUES
    ('00000000-0000-0000-0000-000000000002', tstzrange('2026-11-02 09:00+00', '2026-11-02 10:00+00'));
-- Back to back on the first resource: allowed (the end is exclusive).
INSERT INTO btree_gist_probe VALUES
    ('00000000-0000-0000-0000-000000000001', tstzrange('2026-11-02 10:00+00', '2026-11-02 11:00+00'));
-- Overlapping the first row: this one must be refused.
INSERT INTO btree_gist_probe VALUES
    ('00000000-0000-0000-0000-000000000001', tstzrange('2026-11-02 09:30+00', '2026-11-02 10:30+00'));
ROLLBACK;
