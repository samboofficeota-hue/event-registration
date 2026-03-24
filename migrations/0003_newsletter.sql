-- Newsletter Subscribers（メルマガ購読者マスター）
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id          TEXT PRIMARY KEY,          -- UUID
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL DEFAULT '',
  company     TEXT NOT NULL DEFAULT '',
  department  TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active', -- active / unsubscribed / bounced
  source      TEXT NOT NULL DEFAULT '',       -- 'csv_import' / 'event' / 'manual' etc.
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Tags（フラグ・属性。複数付与可能）
CREATE TABLE IF NOT EXISTS newsletter_tags (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  subscriber_id TEXT NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
  tag           TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_newsletter_tags_subscriber ON newsletter_tags(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_tags_tag ON newsletter_tags(tag);

-- Import Batches（CSVインポート履歴）
CREATE TABLE IF NOT EXISTS newsletter_import_batches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  filename    TEXT NOT NULL DEFAULT '',
  total       INTEGER NOT NULL DEFAULT 0,
  imported    INTEGER NOT NULL DEFAULT 0,
  skipped     INTEGER NOT NULL DEFAULT 0,  -- 重複スキップ件数
  created_at  TEXT NOT NULL
);
