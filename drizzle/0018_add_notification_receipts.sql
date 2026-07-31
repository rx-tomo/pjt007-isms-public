-- This file is also applied as a raw migration artifact. BEGIN IMMEDIATE keeps
-- the preflight and every persistent DDL/backfill statement in one write order.
BEGIN IMMEDIATE;

DROP TABLE IF EXISTS temp.notification_receipt_migration_preflight_guard;

CREATE TEMP TABLE notification_receipt_migration_preflight_guard (
  safe INTEGER NOT NULL
    CONSTRAINT notification_receipt_migration_preflight CHECK (safe = 1)
);

INSERT INTO notification_receipt_migration_preflight_guard (safe)
SELECT CASE
  WHEN EXISTS (
    SELECT 1
    FROM notifications
    WHERE notifications.user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM user_memberships
        WHERE user_memberships.user_id = notifications.user_id
          AND user_memberships.organization_id = notifications.organization_id
          AND user_memberships.status = 'active'
      )
  ) THEN 0
  ELSE 1
END;

DROP TABLE temp.notification_receipt_migration_preflight_guard;

CREATE TABLE notification_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  notification_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  read_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_notification_receipts_notification_user_unique
ON notification_receipts(notification_id, user_id);

CREATE INDEX idx_notification_receipts_notification
ON notification_receipts(notification_id);

CREATE INDEX idx_notification_receipts_user_status
ON notification_receipts(user_id, status);

CREATE INDEX idx_notification_receipts_user_updated_at
ON notification_receipts(user_id, updated_at);

INSERT INTO notification_receipts (
  id,
  notification_id,
  user_id,
  status,
  read_at,
  archived_at,
  created_at,
  updated_at
)
SELECT
  'legacy:' || notifications.id || ':' || notifications.user_id,
  notifications.id,
  notifications.user_id,
  CASE notifications.status
    WHEN 'read' THEN 'read'
    WHEN 'archived' THEN 'archived'
    ELSE 'unread'
  END,
  notifications.read_at,
  notifications.archived_at,
  notifications.created_at,
  COALESCE(notifications.archived_at, notifications.read_at, notifications.created_at)
FROM notifications
WHERE notifications.user_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM user_memberships
    WHERE user_memberships.user_id = notifications.user_id
      AND user_memberships.organization_id = notifications.organization_id
      AND user_memberships.status = 'active'
  );

COMMIT;
