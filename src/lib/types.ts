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
  duration_minutes: number;
  capacity: number;
  current_bookings: number;
  speaker: string;
  /** 肩書き */
  speaker_title: string;
  /** 開催形式: 会場 / オンライン / ハイブリッド */
  format: SeminarFormat;
  /** 対象: 会員限定 / 一般公開 */
  target: SeminarTarget;
  /** セミナー画像のGoogle Drive URL */
  image_url: string;
  meet_url: string;
  calendar_event_id: string;
  status: "draft" | "published" | "cancelled" | "completed";
  spreadsheet_id: string; // セミナー専用スプレッドシートのID
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// セミナー専用スプレッドシート: 「予約情報」シート
// ---------------------------------------------------------------------------
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
};
