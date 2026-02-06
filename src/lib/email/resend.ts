import { Resend } from "resend";

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

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export interface ReservationConfirmationData {
  to: string;
  name: string;
  seminarTitle: string;
  seminarDate: string;
  reservationId: string;
  preSurveyUrl: string;
  meetUrl?: string;
}

/**
 * 予約完了メールを送信
 */
export async function sendReservationConfirmation(
  data: ReservationConfirmationData
): Promise<void> {
  const { to, name, seminarTitle, seminarDate, reservationId, preSurveyUrl, meetUrl } = data;

  try {
    await getResend().emails.send({
      from: `Alliance Forum <${FROM_EMAIL}>`,
      to,
      subject: `【${seminarTitle}】予約完了のお知らせ`,
      html: `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>予約完了のお知らせ</title>
</head>
<body style="font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: #2563eb; margin-top: 0; font-size: 24px;">セミナー予約が完了しました</h1>
    <p style="font-size: 16px; margin-bottom: 0;">
      ${name} 様
    </p>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
    <p style="margin-top: 0;">
      以下のセミナーへのご予約を受け付けました。
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280; width: 120px;">セミナー</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">${seminarTitle}</td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">開催日時</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">${seminarDate}</td>
      </tr>
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">予約ID</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${reservationId}</code></td>
      </tr>
      ${meetUrl ? `
      <tr>
        <td style="padding: 12px 0; font-weight: bold; color: #6b7280;">参加URL</td>
        <td style="padding: 12px 0;"><a href="${meetUrl}" style="color: #2563eb; text-decoration: none;">Google Meet で参加</a></td>
      </tr>
      ` : ''}
    </table>

    <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 25px 0; border-radius: 4px;">
      <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">📋 事前アンケートのお願い</p>
      <p style="margin: 0 0 15px 0; font-size: 14px;">
        より充実したセミナーにするため、事前アンケートへのご協力をお願いいたします。
      </p>
      <a href="${preSurveyUrl}"
         style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">
        事前アンケートに回答する
      </a>
    </div>
  </div>

  <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; font-size: 14px; color: #6b7280;">
    <p style="margin: 0 0 10px 0;">
      ご不明な点がございましたら、お気軽にお問い合わせください。
    </p>
    <p style="margin: 0;">
      <strong>Alliance Forum</strong><br>
      Email: ${FROM_EMAIL}
    </p>
  </div>
</body>
</html>
      `,
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
}

/**
 * キャンセル確認メールを送信
 */
export async function sendCancellationNotification(
  data: CancellationNotificationData
): Promise<void> {
  const { to, name, seminarTitle, reservationId } = data;

  try {
    await getResend().emails.send({
      from: `Alliance Forum <${FROM_EMAIL}>`,
      to,
      subject: `【${seminarTitle}】予約キャンセルのお知らせ`,
      html: `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>予約キャンセルのお知らせ</title>
</head>
<body style="font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: #dc2626; margin-top: 0; font-size: 24px;">予約がキャンセルされました</h1>
    <p style="font-size: 16px; margin-bottom: 0;">
      ${name} 様
    </p>
  </div>

  <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 25px; margin-bottom: 20px;">
    <p style="margin-top: 0;">
      以下のセミナーの予約がキャンセルされました。
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280; width: 120px;">セミナー</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">${seminarTitle}</td>
      </tr>
      <tr>
        <td style="padding: 12px 0; font-weight: bold; color: #6b7280;">予約ID</td>
        <td style="padding: 12px 0;"><code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${reservationId}</code></td>
      </tr>
    </table>

    <p>またのご参加をお待ちしております。</p>
  </div>

  <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; font-size: 14px; color: #6b7280;">
    <p style="margin: 0 0 10px 0;">
      ご不明な点がございましたら、お気軽にお問い合わせください。
    </p>
    <p style="margin: 0;">
      <strong>Alliance Forum</strong><br>
      Email: ${FROM_EMAIL}
    </p>
  </div>
</body>
</html>
      `,
    });

    console.log(`[Email] Cancellation notification sent to ${to}`);
  } catch (error) {
    console.error("[Email] Failed to send cancellation notification:", error);
    throw new Error("メールの送信に失敗しました");
  }
}
