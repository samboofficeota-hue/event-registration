-- メールテンプレート
CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- セミナーごとのメールスケジュール
CREATE TABLE IF NOT EXISTS email_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seminar_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  send_time TEXT NOT NULL DEFAULT '10:00',
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(seminar_id, template_id)
);

-- 送信ログ
CREATE TABLE IF NOT EXISTS email_send_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL,
  seminar_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  status TEXT NOT NULL,
  resend_id TEXT,
  error_message TEXT,
  sent_at TEXT NOT NULL
);

-- デフォルトテンプレートの挿入
INSERT INTO email_templates (id, name, subject, body, created_at, updated_at) VALUES
(
  'reminder_30',
  '30日前案内',
  '【WHGC】{{seminar_title}} のご案内',
  '{{name}} 様

いつもWHGCの活動にご参加いただき、ありがとうございます。

来月開催予定のセミナーをご案内いたします。

━━━━━━━━━━━━━━━━━━━━━
■ {{seminar_title}}
━━━━━━━━━━━━━━━━━━━━━

開催日時：{{date}}
開催形式：{{format}}
登壇者：{{speaker}}

{{description}}

▼ お申し込みはこちら
{{registration_url}}

皆様のご参加をお待ちしております。

━━━━━━━━━━━━━━━━━━━━━
WHGC ゲームチェンジャーズ・フォーラム
{{from_email}}
━━━━━━━━━━━━━━━━━━━━━',
  datetime('now'),
  datetime('now')
),
(
  'reminder_7',
  '7日前リマインド',
  '【WHGC】来週開催｜{{seminar_title}} リマインドのご案内',
  '{{name}} 様

来週開催のセミナーについて、リマインドをお送りします。

━━━━━━━━━━━━━━━━━━━━━
■ {{seminar_title}}
━━━━━━━━━━━━━━━━━━━━━

開催日時：{{date}}
開催形式：{{format}}
登壇者：{{speaker}}
{{meet_url_line}}

ご参加の準備をお願いいたします。

━━━━━━━━━━━━━━━━━━━━━
WHGC ゲームチェンジャーズ・フォーラム
{{from_email}}
━━━━━━━━━━━━━━━━━━━━━',
  datetime('now'),
  datetime('now')
),
(
  'reminder_1',
  '前日リマインド',
  '【WHGC】明日開催｜{{seminar_title}}',
  '{{name}} 様

明日開催のセミナーについて、前日リマインドをお送りします。

━━━━━━━━━━━━━━━━━━━━━
■ {{seminar_title}}
━━━━━━━━━━━━━━━━━━━━━

開催日時：{{date}}
開催形式：{{format}}
登壇者：{{speaker}}
{{meet_url_line}}

明日のご参加をお待ちしております。

━━━━━━━━━━━━━━━━━━━━━
WHGC ゲームチェンジャーズ・フォーラム
{{from_email}}
━━━━━━━━━━━━━━━━━━━━━',
  datetime('now'),
  datetime('now')
),
(
  'followup_1',
  '御礼・アンケート',
  '【WHGC】ご参加御礼｜{{seminar_title}}',
  '{{name}} 様

昨日は「{{seminar_title}}」にご参加いただき、誠にありがとうございました。

当日の内容はいかがでしたでしょうか。
より良いセミナー運営のため、ぜひアンケートへのご協力をお願いいたします。

▼ アンケートはこちら（所要時間：約3分）
{{survey_url}}

引き続き、WHGCの活動をどうぞよろしくお願いいたします。

━━━━━━━━━━━━━━━━━━━━━
WHGC ゲームチェンジャーズ・フォーラム
{{from_email}}
━━━━━━━━━━━━━━━━━━━━━',
  datetime('now'),
  datetime('now')
);
