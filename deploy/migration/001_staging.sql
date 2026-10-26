-- GU migration staging ONLY. Not yet used by business APIs.
-- Do not declare the Firestore -> PostgreSQL cutover complete from this schema alone.
BEGIN;
CREATE TABLE IF NOT EXISTS gu_migration_document (
 collection text NOT NULL,
 doc_id text NOT NULL,
 payload jsonb NOT NULL,
 migrated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (collection, doc_id)
);
CREATE INDEX IF NOT EXISTS gu_migration_collection_name_idx
 ON gu_migration_document (collection, (payload->>'name'));
CREATE INDEX IF NOT EXISTS gu_migration_collection_status_idx
 ON gu_migration_document (collection, (payload->>'status'));
CREATE INDEX IF NOT EXISTS gu_migration_collection_dates_idx
 ON gu_migration_document (collection, (payload->>'pickupDate'), (payload->>'returnDate'));
CREATE TABLE IF NOT EXISTS gu_migration_runs (
 id bigserial PRIMARY KEY,
 exported_at timestamptz NOT NULL,
 imported_at timestamptz NOT NULL DEFAULT now(),
 manifest jsonb NOT NULL
);
-- Target transactional model guard: exclusive overlapping active rentals per physical item.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE IF NOT EXISTS gu_rental_allocation (
 id text PRIMARY KEY,
 item_id text NOT NULL,
 order_id text NOT NULL,
 timespan tstzrange NOT NULL,
 status text NOT NULL CHECK (status IN ('RESERVED','PICKED_UP','RETURNED','CANCELLED')),
 CHECK (NOT isempty(timespan)),
 EXCLUDE USING gist (item_id WITH =, timespan WITH &&)
 WHERE (status IN ('RESERVED','PICKED_UP'))
);
COMMIT;
