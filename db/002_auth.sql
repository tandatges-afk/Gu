-- Additive migration. Safe to run after db/schema.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS auth_login_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_hash TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_email_time ON auth_login_attempts(email_hash, attempted_at DESC);
COMMIT;
