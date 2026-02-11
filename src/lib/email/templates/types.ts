/** テンプレートに渡す共通オプション（送信者名・問い合わせ先はフッター等で使用） */
export interface EmailTemplateOptions {
  fromName: string;
  contactEmail: string;
}

/** 予約完了メール用データ */
export interface ReservationConfirmationTemplateData {
  name: string;
  seminarTitle: string;
  seminarDate: string;
  displayNumber: string;
  manageUrl: string;
  preSurveyUrl: string;
  meetUrl?: string;
  calendarAddUrl?: string;
  topMessage?: string;
  /** 事前アンケートが作成済みか（falseの場合、アンケートセクションを非表示） */
  hasPreSurvey?: boolean;
}

/** キャンセル通知メール用データ */
export interface CancellationTemplateData {
  name: string;
  seminarTitle: string;
  displayNumber: string;
}

export type ReservationConfirmationRenderer = (
  data: ReservationConfirmationTemplateData,
  options: EmailTemplateOptions
) => string;

export type CancellationRenderer = (
  data: CancellationTemplateData,
  options: EmailTemplateOptions
) => string;
