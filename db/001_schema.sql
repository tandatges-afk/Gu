-- GU - Thue do xinh | PostgreSQL migration starter
-- 2026-10-26. Run against a NEW, EMPTY gu_db.
-- This is a schema scaffold for the VPS rewrite; the original Firebase APIs
-- WILL NOT read these tables until they are migrated to PostgreSQL.
-- Intentionally no DROP/TRUNCATE, Firebase export, or sample passwords.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,          -- Argon2id hash; never plaintext
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,      -- hash of opaque cookie token
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_staff_expiry ON auth_sessions(staff_id,expires_at);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT,                 -- 0xxxxxxxxx; canonicalize in backend
  size_note TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_phone_normalized ON customers(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(lower(name));

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  search_name TEXT,
  sku TEXT NOT NULL UNIQUE,
  hanger_code TEXT UNIQUE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  size TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  daily_rate BIGINT NOT NULL DEFAULT 0 CHECK (daily_rate >= 0),
  replacement_value BIGINT NOT NULL DEFAULT 0 CHECK (replacement_value >= 0),
  status TEXT NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE','RENTED','LAUNDRY','MAINTENANCE','MISSING')),
  requires_laundry BOOLEAN NOT NULL DEFAULT TRUE,
  inspection_angles JSONB NOT NULL DEFAULT '[]'::jsonb,
  reference_shots JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb, -- camera/other extension fields
  archived_at TIMESTAMPTZ,
  laundry_started_at TIMESTAMPTZ,
  laundry_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items(status) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS rental_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id),
  created_by UUID REFERENCES staff_users(id),
  pickup_at TIMESTAMPTZ NOT NULL,
  return_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'RESERVED'
    CHECK (status IN ('RESERVED','PICKED_UP','RETURNED','CANCELLED','VOIDED')),
  booking_kind TEXT CHECK (booking_kind IN ('RESERVE','WALK_IN')),
  total_vnd BIGINT NOT NULL DEFAULT 0 CHECK (total_vnd >= 0),
  paid_vnd BIGINT NOT NULL DEFAULT 0 CHECK (paid_vnd >= 0),
  deposit_due_vnd BIGINT NOT NULL DEFAULT 0 CHECK (deposit_due_vnd >= 0),
  note TEXT NOT NULL DEFAULT '',
  extra JSONB NOT NULL DEFAULT '{}'::jsonb, -- handover/inspection snapshots
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (return_at > pickup_at)
);
CREATE INDEX IF NOT EXISTS idx_orders_status_pickup ON rental_orders(status,pickup_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON rental_orders(customer_id,created_at DESC);

CREATE TABLE IF NOT EXISTS rental_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES rental_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  item_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  line_total_vnd BIGINT NOT NULL DEFAULT 0 CHECK (line_total_vnd >= 0),
  UNIQUE (order_id, item_id)
);

-- Critical GU guarantee: no overlapping active reservations for same item.
-- During is half-open [start,end): returning exactly at next pickup is allowed.
-- Changes to both rental_orders.status and item_reservations.state must be
-- made atomically by the rewritten backend.
CREATE TABLE IF NOT EXISTS item_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES rental_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  pickup_at TIMESTAMPTZ NOT NULL,
  return_at TIMESTAMPTZ NOT NULL,
  during TSTZRANGE GENERATED ALWAYS AS (tstzrange(pickup_at,return_at,'[)')) STORED,
  state TEXT NOT NULL DEFAULT 'RESERVED'
    CHECK (state IN ('RESERVED','PICKED_UP','RETURNED','CANCELLED','VOIDED')),
  CHECK (return_at > pickup_at),
  UNIQUE (order_id,item_id),
  CONSTRAINT gu_no_overlapping_active_rentals EXCLUDE USING gist
     (item_id WITH =, during WITH &&)
     WHERE (state IN ('RESERVED','PICKED_UP'))
);
CREATE INDEX IF NOT EXISTS idx_reservations_order ON item_reservations(order_id);

CREATE TABLE IF NOT EXISTS order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES rental_orders(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES staff_users(id),
  event_type TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id,created_at DESC);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES rental_orders(id),
  actor_id UUID REFERENCES staff_users(id),
  direction TEXT NOT NULL CHECK (direction IN ('IN','OUT')),
  kind TEXT NOT NULL,                      -- prepay, deposit, refund, other
  amount_vnd BIGINT NOT NULL CHECK (amount_vnd >= 0),
  reference TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id,created_at DESC);

CREATE TABLE IF NOT EXISTS debt_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES rental_orders(id),
  amount_vnd BIGINT NOT NULL,               -- signed delta
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_debt_order ON debt_ledger(order_id,created_at DESC);

CREATE TABLE IF NOT EXISTS staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  shift_code TEXT NOT NULL CHECK (shift_code IN ('S1','S2','S3')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id,work_date,shift_code)
);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_day ON staff_shifts(work_date,shift_code);
-- Enforce GU's 'max 2 staff/shift' under transaction/locking in application.

CREATE TABLE IF NOT EXISTS secure_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES staff_users(id),
  order_id UUID REFERENCES rental_orders(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('reservation','deposit','handover','return')),
  private_storage_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evidence_order ON secure_evidence(order_id);
CREATE INDEX IF NOT EXISTS idx_evidence_retention ON secure_evidence(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES staff_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMIT;
