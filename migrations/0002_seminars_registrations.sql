-- migration: 0002_seminars_registrations
-- セミナー情報・登録者情報を Google Sheets から D1 へ移行

-- -----------------------------------------------------------------------
-- seminars テーブル
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seminars (
  id                     TEXT PRIMARY KEY,
  tenant                 TEXT NOT NULL DEFAULT 'default',
  title                  TEXT NOT NULL,
  description            TEXT NOT NULL DEFAULT '',
  date                   TEXT NOT NULL,
  end_time               TEXT NOT NULL DEFAULT '',
  capacity               INTEGER NOT NULL DEFAULT 100,
  current_bookings       INTEGER NOT NULL DEFAULT 0,
  speaker                TEXT NOT NULL DEFAULT '',
  speaker_title          TEXT NOT NULL DEFAULT '',
  speaker_reference_url  TEXT NOT NULL DEFAULT '',
  format                 TEXT NOT NULL DEFAULT 'online',
  target                 TEXT NOT NULL DEFAULT 'public',
  invitation_code        TEXT NOT NULL DEFAULT '',
  image_url              TEXT NOT NULL DEFAULT '',
  meet_url               TEXT NOT NULL DEFAULT '',
  calendar_event_id      TEXT NOT NULL DEFAULT '',
  status                 TEXT NOT NULL DEFAULT 'draft',
  spreadsheet_id         TEXT NOT NULL DEFAULT '',
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seminars_tenant  ON seminars(tenant);
CREATE INDEX IF NOT EXISTS idx_seminars_status  ON seminars(status);
CREATE INDEX IF NOT EXISTS idx_seminars_date    ON seminars(date);

-- -----------------------------------------------------------------------
-- registrations テーブル
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registrations (
  id                     TEXT PRIMARY KEY,
  seminar_id             TEXT NOT NULL,
  tenant                 TEXT NOT NULL DEFAULT 'default',
  reservation_number     TEXT NOT NULL DEFAULT '',
  name                   TEXT NOT NULL,
  email                  TEXT NOT NULL,
  company                TEXT NOT NULL DEFAULT '',
  department             TEXT NOT NULL DEFAULT '',
  phone                  TEXT NOT NULL DEFAULT '',
  status                 TEXT NOT NULL DEFAULT 'confirmed',
  participation_method   TEXT NOT NULL DEFAULT '',
  pre_survey_completed   INTEGER NOT NULL DEFAULT 0,
  post_survey_completed  INTEGER NOT NULL DEFAULT 0,
  note                   TEXT NOT NULL DEFAULT '',
  created_at             TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_registrations_seminar_id        ON registrations(seminar_id);
CREATE INDEX IF NOT EXISTS idx_registrations_email             ON registrations(email);
CREATE INDEX IF NOT EXISTS idx_registrations_reservation_number ON registrations(reservation_number);
CREATE INDEX IF NOT EXISTS idx_registrations_tenant            ON registrations(tenant);
CREATE INDEX IF NOT EXISTS idx_registrations_status            ON registrations(status);
