-- メルマガキャンペーン管理テーブル
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft', -- draft / sent
  recipient_tags TEXT NOT NULL DEFAULT '[]', -- JSON配列: [] = 全員
  recipient_count INTEGER NOT NULL DEFAULT 0, -- 送信対象者数
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_status ON newsletter_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_campaigns_created_at ON newsletter_campaigns(created_at);

-- メルマガ送信ログテーブル
CREATE TABLE IF NOT EXISTS newsletter_send_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL REFERENCES newsletter_campaigns(id),
  subscriber_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL, -- sent / failed
  resend_id TEXT,
  error_message TEXT,
  sent_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_newsletter_send_logs_campaign ON newsletter_send_logs(campaign_id);
