import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Upstash Redis が設定されている場合はそちらを使用、未設定時は in-memory フォールバック
// （ローカル開発では Upstash 環境変数なしでも動作する）
// ---------------------------------------------------------------------------

function isUpstashConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function createLimiter(limit: number, windowSeconds: number): Ratelimit | null {
  if (!isUpstashConfigured()) return null;
  return new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    }),
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    analytics: false,
  });
}

// 管理者ログイン: 5回 / 15分 / IP
// eslint-disable-next-line prefer-const
let _authLimiter: Ratelimit | null = null;

// 予約 POST: 10回 / 60秒 / IP  (メールスパム・容量枯渇対策)
// eslint-disable-next-line prefer-const
let _bookingLimiter: Ratelimit | null = null;

// 招待コード試行: 5回 / 300秒 / IP  (ブルートフォース対策)
// eslint-disable-next-line prefer-const
let _invitationCodeLimiter: Ratelimit | null = null;

function getAuthLimiter(): Ratelimit | null {
  if (!_authLimiter) _authLimiter = createLimiter(5, 15 * 60);
  return _authLimiter;
}
function getBookingLimiter(): Ratelimit | null {
  if (!_bookingLimiter) _bookingLimiter = createLimiter(10, 60);
  return _bookingLimiter;
}
function getInvitationCodeLimiter(): Ratelimit | null {
  if (!_invitationCodeLimiter) _invitationCodeLimiter = createLimiter(5, 5 * 60);
  return _invitationCodeLimiter;
}

// ---------------------------------------------------------------------------
// in-memory フォールバック（ローカル開発 / Upstash 未設定）
// ---------------------------------------------------------------------------

const memAuthMap = new Map<string, { count: number; lockedUntil: number }>();
const MEM_AUTH_MAX = 5;
const MEM_AUTH_LOCK_MS = 15 * 60 * 1000;

const memBookingMap = new Map<string, { count: number; resetAt: number }>();
const MEM_BOOKING_MAX = 10;
const MEM_BOOKING_WINDOW_MS = 60 * 1000;

const memInvMap = new Map<string, { count: number; resetAt: number }>();
const MEM_INV_MAX = 5;
const MEM_INV_WINDOW_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

/** 管理者ログイン失敗カウントを増やし、超過していれば残り分をエラーで返す */
export async function checkAuthRateLimit(
  ip: string
): Promise<{ limited: false } | { limited: true; retryAfterMin: number }> {
  const limiter = getAuthLimiter();
  if (limiter) {
    const { success, reset } = await limiter.limit(`auth:${ip}`);
    if (!success) {
      const retryAfterMin = Math.ceil((reset - Date.now()) / 60000);
      return { limited: true, retryAfterMin };
    }
    return { limited: false };
  }

  // in-memory フォールバック（チェックのみ。失敗後のカウントは resetAuthRateLimit/incrAuthRateLimit で行う）
  const now = Date.now();
  const state = memAuthMap.get(ip);
  if (state && state.lockedUntil > now) {
    const retryAfterMin = Math.ceil((state.lockedUntil - now) / 60000);
    return { limited: true, retryAfterMin };
  }
  return { limited: false };
}

/** 認証失敗時に呼び出す（in-memory フォールバック用） */
export function recordAuthFailure(ip: string): void {
  if (isUpstashConfigured()) return; // Upstash 側で自動カウント済み
  const now = Date.now();
  const current = memAuthMap.get(ip) ?? { count: 0, lockedUntil: 0 };
  const newCount = current.count + 1;
  memAuthMap.set(ip, {
    count: newCount,
    lockedUntil: newCount >= MEM_AUTH_MAX ? now + MEM_AUTH_LOCK_MS : 0,
  });
}

/** 認証成功時にリセット */
export function resetAuthRateLimit(ip: string): void {
  memAuthMap.delete(ip);
}

/** 予約 POST のレート制限チェック */
export async function checkBookingRateLimit(
  ip: string
): Promise<boolean> {
  const limiter = getBookingLimiter();
  if (limiter) {
    const { success } = await limiter.limit(`booking:${ip}`);
    return success;
  }

  const now = Date.now();
  const state = memBookingMap.get(ip);
  if (!state || state.resetAt <= now) {
    memBookingMap.set(ip, { count: 1, resetAt: now + MEM_BOOKING_WINDOW_MS });
    return true;
  }
  if (state.count >= MEM_BOOKING_MAX) return false;
  state.count++;
  return true;
}

/** 招待コード試行のレート制限チェック */
export async function checkInvitationCodeRateLimit(
  ip: string
): Promise<boolean> {
  const limiter = getInvitationCodeLimiter();
  if (limiter) {
    const { success } = await limiter.limit(`invcode:${ip}`);
    return success;
  }

  const now = Date.now();
  const state = memInvMap.get(ip);
  if (!state || state.resetAt <= now) {
    memInvMap.set(ip, { count: 1, resetAt: now + MEM_INV_WINDOW_MS });
    return true;
  }
  if (state.count >= MEM_INV_MAX) return false;
  state.count++;
  return true;
}

export function getClientIp(request: Request): string {
  return (
    (request.headers.get("cf-connecting-ip")) ??
    (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()) ??
    (request.headers.get("x-real-ip")) ??
    "unknown"
  );
}
