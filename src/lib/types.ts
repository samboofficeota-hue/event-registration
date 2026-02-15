// ---------------------------------------------------------------------------
// マスタースプレッドシート: 「セミナー一覧」シート
// ---------------------------------------------------------------------------
/** 開催形式 */
export type SeminarFormat = "venue" | "online" | "hybrid";
/** 対象 */
export type SeminarTarget = "members_only" | "public";

export interface Seminar {
  id: string;
  title: string;
  description: string;
  date: string; // ISO 8601
  end_time: string; // "HH:mm" 形式の終了時刻
  capacity: number;
  current_bookings: number;
  speaker: string;
  /** 肩書き */
  speaker_title: string;
  /** 講師参考URL */
  speaker_reference_url: string;
  /** 開催形式: 会場 / オンライン / ハイブリッド */
  format: SeminarFormat;
  /** 対象: 会員限定 / 一般公開 */
  target: SeminarTarget;
  /** 招待コード（会員限定セミナーで非会員が申し込む際に使用。空欄なら招待なし） */
  invitation_code: string;
  /** セミナー画像のGoogle Drive URL */
  image_url: string;
  meet_url: string;
  calendar_event_id: string;
  status: "draft" | "published" | "cancelled" | "completed";
  spreadsheet_id: string; // セミナー専用スプレッドシートのID
  created_at: string;
  updated_at: string;
  /** テナントキー（一覧取得時にテナント指定した場合のみ。予約APIに渡す） */
  tenant?: string;
}

// ---------------------------------------------------------------------------
// セミナー専用スプレッドシート: 「予約情報」シート
// ---------------------------------------------------------------------------
/** 参加方法（ハイブリッド時は申込者が選択。オンライン/会場のみの場合はイベント形式に一致） */
export type ParticipationMethod = "venue" | "online";

export interface Reservation {
  id: string;
  name: string;
  email: string;
  company: string;
  department: string;
  phone: string;
  status: "confirmed" | "cancelled";
  pre_survey_completed: boolean;
  post_survey_completed: boolean;
  created_at: string;
  note: string;
  /** 予約番号（例: 2604-a1bc） */
  reservation_number?: string;
  /** 参加方法: 会場 / オンライン（ハイブリッド時は必須。それ以外はイベント形式に応じて自動） */
  participation_method?: ParticipationMethod;
}

// ---------------------------------------------------------------------------
// セミナー専用スプレッドシート: 「事前アンケート」シート
// ---------------------------------------------------------------------------
export interface PreSurveyResponse {
  id: string;
  reservation_id: string;
  q1_interest_level: string;
  q2_expectations: string;
  q3_experience: string;
  q4_questions: string;
  submitted_at: string;
  note: string;
}

// ---------------------------------------------------------------------------
// セミナー専用スプレッドシート: 「事後アンケート」シート
// ---------------------------------------------------------------------------
export interface PostSurveyResponse {
  id: string;
  reservation_id: string;
  q1_satisfaction: string;
  q2_content_quality: string;
  q3_speaker_rating: string;
  q4_learnings: string;
  q5_improvements: string;
  q6_recommend: string;
  submitted_at: string;
  note: string;
}

export type SeminarFormData = Omit<
  Seminar,
  "id" | "current_bookings" | "meet_url" | "calendar_event_id" | "spreadsheet_id" | "created_at" | "updated_at"
>;

export type BookingFormData = {
  seminar_id: string;
  name: string;
  email: string;
  company: string;
  department: string;
  phone: string;
  /** 参加方法（ハイブリッド時のみ必須。online の場合は "online"、venue の場合は "venue"） */
  participation_method?: ParticipationMethod;
};
