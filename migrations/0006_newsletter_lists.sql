-- Newsletter Lists（送信対象リスト管理）
CREATE TABLE IF NOT EXISTS newsletter_lists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  conditions  TEXT NOT NULL DEFAULT '[]', -- JSON配列: 絞り込み条件
  preview_count INTEGER NOT NULL DEFAULT 0, -- 最後にプレビューした件数
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_newsletter_lists_created_at ON newsletter_lists(created_at);
