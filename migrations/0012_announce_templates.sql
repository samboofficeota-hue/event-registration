-- email_schedules に list_id 列を追加（告知集客用スケジュールの送付リスト）
ALTER TABLE email_schedules ADD COLUMN list_id TEXT;

-- 既存の reminder_30 テンプレート名を「2週間前リマインド」に更新
UPDATE email_templates
SET name = '2週間前リマインド', updated_at = datetime('now')
WHERE id = 'reminder_30';

-- 【告知集客用】新規テンプレートを追加
INSERT OR IGNORE INTO email_templates (id, name, subject, body, created_at, updated_at) VALUES
(
  'announce_30',
  '30日前告知（集客用）',
  '【WHGC】{{seminar_title}} のご案内（{{date}}開催）',
  '{{name}} 様

いつもWHGCの活動をご支援いただき、誠にありがとうございます。

来月開催予定のセミナーをご案内いたします。
ぜひご参加をご検討ください。

━━━━━━━━━━━━━━━━━━━━━
■ {{seminar_title}}
━━━━━━━━━━━━━━━━━━━━━

開催日時：{{date}}
開催形式：{{format}}
登壇者：{{speaker}}

{{description}}

▼ 参加お申し込みはこちら
{{registration_url}}

皆様のご参加を心よりお待ちしております。

━━━━━━━━━━━━━━━━━━━━━
WHGC ゲームチェンジャーズ・フォーラム
{{from_email}}
━━━━━━━━━━━━━━━━━━━━━',
  datetime('now'),
  datetime('now')
),
(
  'announce_14',
  '2週間前告知（集客用）',
  '【WHGC】開催まで2週間｜{{seminar_title}} のご案内',
  '{{name}} 様

いつもWHGCの活動をご支援いただき、誠にありがとうございます。

2週間後に開催予定のセミナーについて、改めてご案内いたします。

━━━━━━━━━━━━━━━━━━━━━
■ {{seminar_title}}
━━━━━━━━━━━━━━━━━━━━━

開催日時：{{date}}
開催形式：{{format}}
登壇者：{{speaker}}

{{description}}

▼ 参加お申し込みはこちら
{{registration_url}}

まだお申し込みでない方は、ぜひこの機会にご登録ください。

━━━━━━━━━━━━━━━━━━━━━
WHGC ゲームチェンジャーズ・フォーラム
{{from_email}}
━━━━━━━━━━━━━━━━━━━━━',
  datetime('now'),
  datetime('now')
),
(
  'announce_7',
  '1週間前告知（集客用）',
  '【WHGC】来週開催｜{{seminar_title}} 参加受付中',
  '{{name}} 様

いつもWHGCの活動をご支援いただき、誠にありがとうございます。

来週開催のセミナーについて、最終のご案内をお送りします。

━━━━━━━━━━━━━━━━━━━━━
■ {{seminar_title}}
━━━━━━━━━━━━━━━━━━━━━

開催日時：{{date}}
開催形式：{{format}}
登壇者：{{speaker}}

{{description}}

▼ 参加お申し込みはこちら（締切間近）
{{registration_url}}

━━━━━━━━━━━━━━━━━━━━━
WHGC ゲームチェンジャーズ・フォーラム
{{from_email}}
━━━━━━━━━━━━━━━━━━━━━',
  datetime('now'),
  datetime('now')
);
