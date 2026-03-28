-- メルマガキャンペーンに配信予約・スケジュール対応を追加
ALTER TABLE newsletter_campaigns ADD COLUMN scheduled_at TEXT;
-- status に 'scheduled' を追加（draft / scheduled / sending / sent）

-- エンゲージメントログ（開封・クリック・バウンス・苦情）
CREATE TABLE IF NOT EXISTS newsletter_engagement_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  resend_msg_id TEXT NOT NULL,          -- Resend の email.id
  campaign_id   TEXT,                   -- send_logs から逆引き
  subscriber_id TEXT,
  email         TEXT,
  event_type    TEXT NOT NULL,          -- delivered / opened / clicked / bounced / complained
  url           TEXT,                   -- clicked イベントのリンク先
  occurred_at   TEXT NOT NULL,          -- イベント発生時刻 (ISO8601)
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_engagement_resend_id  ON newsletter_engagement_logs(resend_msg_id);
CREATE INDEX IF NOT EXISTS idx_engagement_campaign   ON newsletter_engagement_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_engagement_subscriber ON newsletter_engagement_logs(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_engagement_event      ON newsletter_engagement_logs(event_type);
