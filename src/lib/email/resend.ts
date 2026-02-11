import { Resend } from "resend";
import { getTenantResendConfig } from "@/lib/tenant-config";
import {
  getReservationConfirmationTemplate,
  getCancellationTemplate,
} from "./templates";
import type { EmailTemplateOptions } from "./templates";

// ビルド時のエラーを防ぐため、実行時に遅延初期化
let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

export interface ReservationConfirmationData {
  to: string;
  name: string;
  seminarTitle: string;
  seminarDate: string;
  /** 予約番号（例: 2604-a1bc）。表示・変更キャンセル用。空の場合は従来の予約IDを表示 */
  reservationNumber: string;
  reservationId: string;
  preSurveyUrl: string;
  manageUrl: string;
  meetUrl?: string;
  /** Googleカレンダーに登録するURL（任意） */
  calendarAddUrl?: string;
  /** 重複申込時など、メール先頭に追加する注釈文 */
  topMessage?: string;
  /** 事前アンケートが作成済みか（falseの場合、アンケートセクションを非表示） */
  hasPreSurvey?: boolean;
}

/**
 * 予約完了メールを送信
 * @param data 予約完了メールのデータ
 * @param tenant テナントキー（指定時はそのテナントの送信者名・送信元・問い合わせ先・テンプレートを使用）
 */
export async function sendReservationConfirmation(
  data: ReservationConfirmationData,
  tenant?: string
): Promise<void> {
  const {
    to,
    name,
    seminarTitle,
    seminarDate,
    reservationNumber,
    reservationId,
    preSurveyUrl,
    manageUrl,
    meetUrl,
    calendarAddUrl,
    topMessage,
    hasPreSurvey,
  } = data;
  const displayNumber = reservationNumber || reservationId;

  const config = getTenantResendConfig(tenant ?? "");
  const template = getReservationConfirmationTemplate(tenant);
  const options: EmailTemplateOptions = {
    fromName: config.fromName,
    contactEmail: config.contactEmail,
  };
  const html = template(
    {
      name,
      seminarTitle,
      seminarDate,
      displayNumber,
      manageUrl,
      preSurveyUrl,
      meetUrl,
      calendarAddUrl,
      topMessage,
      hasPreSurvey: hasPreSurvey ?? true,
    },
    options
  );

  // テナント別の件名
  const subject = tenant === "whgc-seminars"
    ? "WHGC ｜参加登録を受け付けました"
    : `【${seminarTitle}】予約完了のお知らせ`;

  try {
    await getResend().emails.send({
      from: `${config.fromName} <${config.fromEmail}>`,
      to,
      subject,
      html,
    });

    console.log(`[Email] Reservation confirmation sent to ${to}`);
  } catch (error) {
    console.error("[Email] Failed to send reservation confirmation:", error);
    throw new Error("メールの送信に失敗しました");
  }
}

export interface CancellationNotificationData {
  to: string;
  name: string;
  seminarTitle: string;
  reservationId: string;
  /** 予約番号（表示用）。空の場合は reservationId を表示 */
  reservationNumber?: string;
}

/**
 * キャンセル確認メールを送信
 * @param data キャンセル通知メールのデータ
 * @param tenant テナントキー（指定時はそのテナントの送信者名・送信元・問い合わせ先・テンプレートを使用）
 */
export async function sendCancellationNotification(
  data: CancellationNotificationData,
  tenant?: string
): Promise<void> {
  const { to, name, seminarTitle, reservationId, reservationNumber } = data;
  const displayNumber = reservationNumber || reservationId;

  const config = getTenantResendConfig(tenant ?? "");
  const template = getCancellationTemplate(tenant);
  const options: EmailTemplateOptions = {
    fromName: config.fromName,
    contactEmail: config.contactEmail,
  };
  const html = template(
    { name, seminarTitle, displayNumber },
    options
  );

  try {
    await getResend().emails.send({
      from: `${config.fromName} <${config.fromEmail}>`,
      to,
      subject: `【${seminarTitle}】予約キャンセルのお知らせ`,
      html,
    });

    console.log(`[Email] Cancellation notification sent to ${to}`);
  } catch (error) {
    console.error("[Email] Failed to send cancellation notification:", error);
    throw new Error("メールの送信に失敗しました");
  }
}
