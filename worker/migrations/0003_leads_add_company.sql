-- Migration 0003: add a nullable `company` column to `leads`, for the new
-- public market lead-capture endpoint (POST /api/leads/:market —
-- worker/src/routes/publicLeads.ts).
--
-- Checked first (PRAGMA table_info(leads) against lpb-staging-db, same way
-- migration 0002 was): the live table is exactly the 0002 shape — no
-- `company` column exists yet. A plain nullable ADD COLUMN is safe here
-- (unlike 0002's NOT NULL relaxation, which needed the full rebuild
-- pattern) — SQLite supports ADD COLUMN with no default/rebuild required
-- as long as the new column is nullable, which this is.

ALTER TABLE leads ADD COLUMN company TEXT;
