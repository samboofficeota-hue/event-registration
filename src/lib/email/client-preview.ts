import { getTheme } from "./themes";
import { BRAND_CONFIGS, detectBrand } from "./brand";

/**
 * プレーンテキストのメール本文から、クライアントサイドでHTML プレビューを生成する。
 * （buildHtmlEmail のクライアント版 — 実際の送信には使わない）
 */
export function buildPreviewHtml(
  text: string,
  headerColor: string,
  footerText?: string | null,
  previewName = "〇〇様"
): string {
  const theme  = getTheme(headerColor);
  const brand  = BRAND_CONFIGS[detectBrand(footerText)];
  const sender = footerText?.trim() || brand.footerSenderText;

  const replaced = text
    .replace(/\{\{name\}\}/g, previewName)
    .replace(/\{\{company\}\}/g, "〇〇株式会社")
    .replace(/\{\{department\}\}/g, "営業部")
    .replace(/\{\{unsubscribe_url\}\}/g, "#unsubscribe-preview");

  const escaped = replaced
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withLinks = escaped.replace(
    /(https?:\/\/[^\s&<>"]+)/g,
    '<a href="$1" style="color:#6366f1;text-decoration:underline;word-break:break-all;">$1</a>'
  );
  const withBreaks = withLinks.replace(/\n/g, "<br>\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:${theme.bg};font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Hiragino Kaku Gothic ProN',Meiryo,'Yu Gothic',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${theme.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color:${theme.header};padding:20px 32px;">
              <p style="margin:0;color:#ffffff;font-size:15px;font-weight:600;letter-spacing:0.04em;">${brand.headerTitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#18181b;font-size:15px;line-height:1.9;">${withBreaks}</td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#71717a;font-size:12px;line-height:1.8;">
                ${sender}<br>配信停止をご希望の方は <a href="#unsubscribe-preview" style="color:#71717a;text-decoration:underline;">こちら</a>より停止手続きをお願いいたします。<br>
                ご不明な点は <a href="mailto:${brand.contactEmail}" style="color:#71717a;">${brand.contactEmail}</a> までお問い合わせください。
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
