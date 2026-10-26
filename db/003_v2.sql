BEGIN;
CREATE TABLE IF NOT EXISTS media_assets (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 uploaded_by UUID NOT NULL REFERENCES staff_users(id),
 kind TEXT NOT NULL CHECK (kind IN ('PRODUCT','EVIDENCE','HANDOVER')),
 file_key TEXT NOT NULL UNIQUE,
 mime TEXT NOT NULL CHECK (mime IN ('image/jpeg','image/png','image/webp')),
 size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 8388608),
 item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
 order_id UUID REFERENCES rental_orders(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_item ON media_assets(item_id);
CREATE INDEX IF NOT EXISTS idx_media_order ON media_assets(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_time ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_return ON rental_orders(return_at) WHERE status IN ('RESERVED','PICKED_UP');
COMMIT;
