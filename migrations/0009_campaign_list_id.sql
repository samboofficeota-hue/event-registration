-- キャンペーンにリストIDカラムを追加（リスト設定ページからの配信予約に使用）
ALTER TABLE newsletter_campaigns ADD COLUMN list_id TEXT;
