-- Migration 0002: bring `leads` to the market-log shape (Phase 3 Part 3/4)
-- plus the email_sent/hubspot_synced columns Phase 5 needs.
--
-- Checked first (PRAGMA table_info(leads) against lpb-staging-db): the
-- live table is the original Phase 1 shape — id, website_id (NOT NULL),
-- page_id, name, email, message, source_url, metadata, created_at. Zero
-- rows in staging, so the data-copy below is trivial, but the statements
-- are written to be safe on a populated table too.
--
-- Deviations from the brief's literal target schema, both driven by what
-- was actually live (not assumed) and by not wanting to silently break
-- the one real, already-working lead-capture endpoint
-- (POST /websites/:websiteId/leads, worker/src/routes/leads.ts):
--
--  * website_id becomes nullable (market-log leads have no owning
--    website) — SQLite has no ALTER COLUMN, so relaxing an existing NOT
--    NULL requires the standard rebuild pattern: new table, copy every
--    row and column across, drop, rename. Nothing is dropped or lost.
--  * name/email/message stay nullable, not NOT NULL as the brief's target
--    shape lists them. routes/leads.ts's existing validation only
--    requires "name OR email", with message always optional — a NOT NULL
--    constraint here would break that endpoint the next time a real
--    visitor submits email-only. The market-log capture path always
--    supplies all three anyway, so this costs nothing in practice.
--  * market/subdomain/submitted_at are added nullable (SQLite's ALTER-
--    TABLE-ADD-COLUMN-NOT-NULL only accepts a constant default, and
--    `datetime('now')` doesn't reliably qualify across SQLite versions)
--    and backfilled from created_at, rather than constraint-enforced —
--    the Worker always supplies them for every new row regardless.

CREATE TABLE leads_new (
  id             TEXT PRIMARY KEY,
  website_id     TEXT,
  page_id        TEXT,
  market         TEXT,
  subdomain      TEXT,
  name           TEXT,
  email          TEXT,
  message        TEXT,
  source_url     TEXT,
  metadata       TEXT,
  ai_summary     TEXT,
  email_sent     INTEGER NOT NULL DEFAULT 0,
  hubspot_synced INTEGER NOT NULL DEFAULT 0,
  submitted_at   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (website_id) REFERENCES websites(id)
);

INSERT INTO leads_new (
  id, website_id, page_id, market, subdomain, name, email, message,
  source_url, metadata, submitted_at, created_at
)
SELECT
  id, website_id, page_id, 'default', '', name, email, message,
  source_url, metadata, created_at, created_at
FROM leads;

DROP TABLE leads;
ALTER TABLE leads_new RENAME TO leads;

CREATE INDEX IF NOT EXISTS idx_leads_market ON leads(market);
CREATE INDEX IF NOT EXISTS idx_leads_submitted_at ON leads(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
