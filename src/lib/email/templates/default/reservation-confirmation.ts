import type {
  ReservationConfirmationTemplateData,
  EmailTemplateOptions,
} from "../types";

export function render(
  data: ReservationConfirmationTemplateData,
  options: EmailTemplateOptions
): string {
  const {
    name,
    seminarTitle,
    seminarDate,
    displayNumber,
    manageUrl,
    preSurveyUrl,
    meetUrl,
    calendarAddUrl,
    topMessage,
    hasPreSurvey = true,
  } = data;
  const { contactEmail } = options;

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>予約完了のお知らせ</title>
</head>
<body style="font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${topMessage ? `
  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
    <p style="margin: 0; font-size: 14px;">${topMessage}</p>
  </div>
  ` : ""}
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
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #6b7280;">予約番号</td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;"><code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${displayNumber}</code></td>
      </tr>
      ${meetUrl ? `
      <tr>
        <td style="padding: 12px 0; font-weight: bold; color: #6b7280;">参加URL</td>
        <td style="padding: 12px 0;">
          <a href="${meetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; margin-bottom: 8px;">参加する</a>
          <p style="margin: 0; font-size: 13px; color: #6b7280; word-break: break-all;">${meetUrl}</p>
        </td>
      </tr>
      ` : ""}
    </table>
    ${calendarAddUrl ? `
    <p style="margin: 20px 0 10px 0; font-size: 14px;">カレンダーに登録すると、リマインドの通知を受け取れます。</p>
    <a href="${calendarAddUrl}" style="display: inline-block; background-color: #0f766e; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; margin-bottom: 20px;">カレンダーに登録</a>
    ` : ""}

    <p style="margin: 20px 0 5px 0; font-size: 14px;">お申込み内容の変更やキャンセルは次のボタンをクリックしてください。</p>
    <p style="margin: 0 0 10px 0; font-size: 14px;">変更やキャンセルには、次の予約番号が必要となります。</p>
    <p style="margin: 0 0 15px 0; font-size: 14px;">予約番号: <strong style="font-size: 18px; font-family: monospace; letter-spacing: 1px;">${displayNumber}</strong></p>
    <a href="${manageUrl}"
       style="display: inline-block; background-color: #6b7280; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-bottom: 20px;">
      変更・キャンセル
    </a>

    ${hasPreSurvey ? `
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
    ` : ""}
  </div>

  <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; font-size: 14px; color: #6b7280;">
    <p style="margin: 0 0 10px 0;">
      このメールアドレスは送信専用のため、このメールに返信はお断りしております。お問い合わせなどは以下のメールアドレス宛にお願いいたします。
    </p>
    <p style="margin: 0;">
      お問合せ先　${contactEmail}
    </p>
  </div>
</body>
</html>
  `.trim();
}
