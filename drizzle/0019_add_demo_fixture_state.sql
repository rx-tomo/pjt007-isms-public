CREATE TABLE IF NOT EXISTS demo_fixture_state (
  id text PRIMARY KEY NOT NULL,
  database_id text NOT NULL,
  fixture_version text NOT NULL,
  fixture_epoch text NOT NULL,
  generation integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'leased', 'failed')),
  lease_owner text,
  lease_expires_at text,
  last_reset_at text,
  login_window_started_at text,
  login_attempt_count integer NOT NULL DEFAULT 0,
  CHECK (id = 'public-demo'),
  CHECK (
    (status = 'leased' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR
    (status <> 'leased' AND lease_owner IS NULL AND lease_expires_at IS NULL)
  )
);

-- Intentionally no row initializer here. Operations must bootstrap the singleton
-- with the exact production database_id through a separately authorized action.
