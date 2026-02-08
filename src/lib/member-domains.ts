import { getMemberDomains } from "@/lib/google/sheets";

/**
 * メールアドレスからドメイン部分（@ より後ろ）を取得する。
 * 小文字で返す。
 */
export function getDomainFromEmail(email: string): string {
  const at = email.indexOf("@");
  if (at === -1) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

/**
 * 登録済み会員企業ドメイン一覧と後方一致で照合する。
 * メールのドメインが登録ドメインと完全一致、または登録ドメインのサブドメイン
 * （例: 登録が duskin.co.jp なら mail.duskin.co.jp も一致）であれば true。
 */
function domainMatchesAllowed(emailDomain: string, allowedDomain: string): boolean {
  if (emailDomain === allowedDomain) return true;
  if (allowedDomain.length >= emailDomain.length) return false;
  return emailDomain.endsWith("." + allowedDomain);
}

/**
 * 登録済み会員企業ドメイン一覧を取得し、指定メールアドレスのドメインが
 * 後方一致でいずれかに該当するかを返す。会員企業のメール（@ より後ろ）で判定する。
 * 例: 登録に duskin.co.jp があれば、xxx@mail.duskin.co.jp も会員と判定される。
 */
export async function isMemberDomainEmail(email: string): Promise<boolean> {
  const domain = getDomainFromEmail(email);
  if (!domain) return false;
  const allowed = await getMemberDomains();
  return allowed.some((d) => {
    const a = d.trim().toLowerCase();
    return a && domainMatchesAllowed(domain, a);
  });
}
