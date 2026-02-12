/**
 * アンケートURLトークンのエンコード/デコード
 *
 * セミナーIDと予約IDを組み合わせてBase64URLエンコードし、
 * URLにセミナーIDを露出させずにアンケートURLを生成する。
 */

/** トークンをエンコード */
export function encodeSurveyToken(seminarId: string, reservationId: string): string {
  const payload = `${seminarId}:${reservationId}`;
  // Base64URL エンコード（+ → -, / → _, = 除去）
  const base64 = Buffer.from(payload, "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** トークンをデコード */
export function decodeSurveyToken(token: string): { seminarId: string; reservationId: string } | null {
  try {
    // Base64URL → Base64
    let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    // パディング復元
    while (base64.length % 4 !== 0) base64 += "=";
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const [seminarId, reservationId] = decoded.split(":");
    if (!seminarId || !reservationId) return null;
    return { seminarId, reservationId };
  } catch {
    return null;
  }
}
