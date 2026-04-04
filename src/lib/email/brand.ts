/**
 * ブランド設定（クライアント・サーバー両用）
 * ※ このファイルはサーバー専用モジュールを import しないこと
 */

export const BRAND_CONFIGS = {
  whgc: {
    headerTitle:      "WHGC ゲームチェンジャーズ・フォーラム",
    footerSenderText: "このメールは WHGC ゲームチェンジャーズ・フォーラム がお送りしています。",
    contactEmail:     "info@whgcforum.org",
    fromName:         "WHGC ゲームチェンジャーズ・フォーラム",
  },
  aff: {
    headerTitle:      "アライアンス・フォーラム財団",
    footerSenderText: "このメールは アライアンス・フォーラム財団がお送りしています。",
    contactEmail:     "contact@allianceforum.org",
    fromName:         "アライアンス・フォーラム財団",
  },
} as const;

export type BrandKey = keyof typeof BRAND_CONFIGS;

/** footer_text の内容からブランドを判定する */
export function detectBrand(footerText?: string | null): BrandKey {
  if (footerText?.includes("アライアンス・フォーラム財団")) return "aff";
  return "whgc";
}
