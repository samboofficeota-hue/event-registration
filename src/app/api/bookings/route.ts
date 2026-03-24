import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { sendReservationConfirmation, sendCancellationNotification } from "@/lib/email/resend";
import { d1SeminarToSeminar } from "@/lib/seminars";
import { isMemberDomainEmail } from "@/lib/member-domains";
import { generateReservationNumber } from "@/lib/reservation-number";
import { isTenantKey, TENANT_KEYS, type TenantKey } from "@/lib/tenant-config";
import { getSurveyQuestions } from "@/lib/survey/storage";
import { encodeSurveyToken } from "@/lib/survey-token";
import { verifyAdminRequest } from "@/lib/auth";
import { checkBookingRateLimit, checkInvitationCodeRateLimit, getClientIp } from "@/lib/ratelimit";
import {
  getSeminarByIdFromD1,
  updateSeminarInD1,
  getRegistrationsBySeminarFromD1,
  insertRegistrationToD1,
  getRegistrationByIdFromD1,
  updateRegistrationInD1,
  type D1Registration,
} from "@/lib/d1";

/** body に tenant が無い場合、Referer のパスからテナントを補完 */
function tenantFromReferer(request: NextRequest): TenantKey | undefined {
  const referer = request.headers.get("referer") || request.headers.get("origin");
  if (!referer) return undefined;
  try {
    const pathname = new URL(referer).pathname;
    return TENANT_KEYS.find((t) => pathname.startsWith(`/${t}`));
  } catch {
    return undefined;
  }
}

/** Googleカレンダー「イベントを追加」URL */
function buildCalendarAddUrl(
  date: string,
  end_time: string,
  title: string,
  meet_url: string
): string | undefined {
  if (!date) return undefined;
  const m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (!m) return undefined;
  const [, y, mo, d, h, min] = m.map(Number);
  const jstMs = Date.UTC(y, mo - 1, d, h, min, 0);
  const utcStart = new Date(jstMs - 9 * 60 * 60 * 1000);
  const endMatch = (end_time || "").match(/^(\d{2}):(\d{2})$/);
  const endH = endMatch ? Number(endMatch[1]) : h + 1;
  const endMin = endMatch ? Number(endMatch[2]) : min;
  const jstEndMs = Date.UTC(y, mo - 1, d, endH, endMin, 0);
  const utcEnd = new Date(jstEndMs - 9 * 60 * 60 * 1000);
  const fmt = (dt: Date) =>
    `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}T${String(dt.getUTCHours()).padStart(2, "0")}${String(dt.getUTCMinutes()).padStart(2, "0")}${String(dt.getUTCSeconds()).padStart(2, "0")}Z`;
  const calParams = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "セミナー",
    dates: `${fmt(utcStart)}/${fmt(utcEnd)}`,
  });
  if (meet_url) calParams.set("location", meet_url);
  return `https://calendar.google.com/calendar/render?${calParams.toString()}`;
}

// ---------------------------------------------------------------------------
// POST: 新規予約
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const bookingAllowed = await checkBookingRateLimit(ip);
    if (!bookingAllowed) {
      return NextResponse.json(
        { error: "リクエストが多すぎます。しばらく経ってから再試行してください。" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { seminar_id, name, email, company, department, phone, invitation_code, participation_method, tenant } = body;
    const emailTrimmed = (email || "").trim().toLowerCase();
    let tenantKey = tenant && isTenantKey(tenant) ? tenant : undefined;
    if (!tenantKey) tenantKey = tenantFromReferer(request);
    const tenantVal = tenantKey || "default";

    if (!seminar_id || !name || !email) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    const seminarRow = await getSeminarByIdFromD1(seminar_id);
    if (!seminarRow) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }
    const seminar = d1SeminarToSeminar(seminarRow);

    if (seminar.status !== "published") {
      return NextResponse.json({ error: "このセミナーは現在予約を受け付けていません" }, { status: 400 });
    }
    if (seminar.current_bookings >= seminar.capacity) {
      return NextResponse.json({ error: "定員に達しました" }, { status: 400 });
    }

    // 会員限定チェック
    if (seminar.target === "members_only") {
      const isMember = await isMemberDomainEmail(email, tenantKey);
      if (!isMember) {
        const code = (invitation_code || "").trim();
        const expected = (seminar.invitation_code || "").trim().toLowerCase();
        if (!expected || code.toLowerCase() !== expected) {
          const invAllowed = await checkInvitationCodeRateLimit(ip);
          if (!invAllowed) {
            return NextResponse.json(
              { error: "リクエストが多すぎます。しばらく経ってから再試行してください。" },
              { status: 429 }
            );
          }
          const message = code
            ? "招待コードが正しくありません"
            : "会員企業のメールアドレス、または招待コードが必要です";
          return NextResponse.json({ error: message }, { status: 403 });
        }
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const manageUrl = tenantKey
      ? `${appUrl}/${tenantKey}/booking/manage`
      : `${appUrl}/booking/manage`;

    const dateObj = new Date(seminar.date);
    const formattedDate = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日 ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;
    const calendarAddUrl = buildCalendarAddUrl(seminar.date, seminar.end_time, seminar.title, seminar.meet_url);

    // 事前アンケート存在確認
    let hasPreSurvey = false;
    if (seminar.spreadsheet_id) {
      try {
        const preQuestions = await getSurveyQuestions(seminar.spreadsheet_id, "pre");
        hasPreSurvey = Array.isArray(preQuestions) && preQuestions.length > 0;
      } catch {
        hasPreSurvey = false;
      }
    }

    // 重複申込チェック
    const existingRegs = await getRegistrationsBySeminarFromD1(seminar_id);
    const duplicate = existingRegs.find(
      (r) => r.email.trim().toLowerCase() === emailTrimmed && r.status === "confirmed"
    );

    if (duplicate) {
      try {
        await sendReservationConfirmation(
          {
            to: email,
            name,
            seminarTitle: seminar.title,
            seminarDate: formattedDate,
            reservationNumber: duplicate.reservation_number,
            reservationId: duplicate.id,
            preSurveyUrl: `${appUrl}/survey/pre/${encodeSurveyToken(seminar_id, duplicate.id)}`,
            manageUrl,
            meetUrl: seminar.meet_url || undefined,
            calendarAddUrl: calendarAddUrl || undefined,
            topMessage: "すでに次の内容で登録されています。変更する場合は、メール内の変更・キャンセルリンクからお手続きください。",
            hasPreSurvey,
          },
          tenantKey
        );
      } catch (e) {
        console.error("[Booking] Duplicate resend email failed:", e);
      }
      return NextResponse.json(
        {
          id: duplicate.id,
          seminar_id,
          name,
          email,
          reservation_number: duplicate.reservation_number || undefined,
          meet_url: seminar.meet_url,
          seminar_title: seminar.title,
          seminar_date: seminar.date,
          already_registered: true,
        },
        { status: 201 }
      );
    }

    const now = new Date().toISOString();
    const id = uuidv4();
    const receiptCount = existingRegs.length;
    const reservationNumber = generateReservationNumber(seminar.date, seminar.id, receiptCount + 1);

    // 参加方法
    const participationMethod =
      seminar.format === "online"
        ? "online"
        : seminar.format === "venue"
          ? "venue"
          : seminar.format === "hybrid"
            ? (participation_method === "venue" || participation_method === "online" ? participation_method : "")
            : "";
    if (seminar.format === "hybrid" && !participationMethod) {
      return NextResponse.json(
        { error: "参加方法（会場またはオンライン）を選択してください" },
        { status: 400 }
      );
    }

    const registration: D1Registration = {
      id,
      seminar_id,
      tenant: tenantVal,
      reservation_number: reservationNumber,
      name,
      email,
      company: company || "",
      department: department || "",
      phone: phone || "",
      status: "confirmed",
      participation_method: participationMethod || "",
      pre_survey_completed: 0,
      post_survey_completed: 0,
      note: "",
      created_at: now,
    };

    await insertRegistrationToD1(registration);

    // current_bookings を更新
    await updateSeminarInD1(seminar_id, {
      current_bookings: seminar.current_bookings + 1,
      updated_at: now,
    });

    const preSurveyUrl = `${appUrl}/survey/pre/${encodeSurveyToken(seminar_id, id)}`;
    try {
      await sendReservationConfirmation(
        {
          to: email,
          name,
          seminarTitle: seminar.title,
          seminarDate: formattedDate,
          reservationNumber,
          reservationId: id,
          preSurveyUrl,
          manageUrl,
          meetUrl: seminar.meet_url || undefined,
          calendarAddUrl: calendarAddUrl || undefined,
          hasPreSurvey,
        },
        tenantKey
      );
      console.log(`[Booking] Confirmation email sent to ${email}`);
    } catch (emailError) {
      console.error("[Booking] Failed to send confirmation email:", emailError);
    }

    return NextResponse.json(
      {
        id,
        seminar_id,
        name,
        email,
        reservation_number: reservationNumber,
        meet_url: seminar.meet_url,
        seminar_title: seminar.title,
        seminar_date: seminar.date,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json({ error: "予約の作成に失敗しました" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT: 予約情報の更新
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { seminar_id, id, name, email, company, department, phone, participation_method, tenant, owner_email } = body;
    const tenantKey = tenant && isTenantKey(tenant) ? tenant : undefined;

    if (!seminar_id || !id) {
      return NextResponse.json({ error: "seminar_id と予約ID が必要です" }, { status: 400 });
    }

    const reg = await getRegistrationByIdFromD1(id);
    if (!reg) {
      return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
    }
    if (reg.status === "cancelled") {
      return NextResponse.json({ error: "この予約は既にキャンセルされています" }, { status: 400 });
    }

    // 管理者でない場合はメールアドレスで所有者確認
    const isAdmin = await verifyAdminRequest(request);
    if (!isAdmin) {
      if (!owner_email) {
        return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
      }
      if (owner_email.trim().toLowerCase() !== reg.email.trim().toLowerCase()) {
        return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
      }
    }

    const pmVal = participation_method === "venue" || participation_method === "online"
      ? participation_method
      : reg.participation_method;

    await updateRegistrationInD1(id, {
      name: name ?? reg.name,
      email: email ?? reg.email,
      company: company ?? reg.company,
      department: department ?? reg.department,
      phone: phone ?? reg.phone,
      participation_method: pmVal,
    });

    return NextResponse.json({
      id,
      seminar_id,
      name: name ?? reg.name,
      email: email ?? reg.email,
      company: company ?? reg.company,
      department: department ?? reg.department,
      phone: phone ?? reg.phone,
      participation_method: pmVal || undefined,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    return NextResponse.json({ error: "予約の更新に失敗しました" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE: 予約のキャンセル
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { seminar_id, id, tenant, email } = body;
    const tenantKey = tenant && isTenantKey(tenant) ? tenant : undefined;

    if (!seminar_id || !id) {
      return NextResponse.json({ error: "seminar_id と予約ID が必要です" }, { status: 400 });
    }

    const reg = await getRegistrationByIdFromD1(id);
    if (!reg) {
      return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
    }
    if (reg.status === "cancelled") {
      return NextResponse.json({ error: "この予約は既にキャンセルされています" }, { status: 400 });
    }

    const seminarRow = await getSeminarByIdFromD1(seminar_id);
    if (!seminarRow) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }
    const seminar = d1SeminarToSeminar(seminarRow);

    // 管理者でない場合はメールアドレスで所有者確認
    const isAdmin = await verifyAdminRequest(request);
    if (!isAdmin) {
      if (!email) {
        return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
      }
      if (email.trim().toLowerCase() !== reg.email.trim().toLowerCase()) {
        return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
      }
    }

    const now = new Date().toISOString();
    await updateRegistrationInD1(id, { status: "cancelled" });

    // current_bookings をデクリメント
    await updateSeminarInD1(seminar_id, {
      current_bookings: Math.max(0, seminar.current_bookings - 1),
      updated_at: now,
    });

    try {
      await sendCancellationNotification(
        {
          to: reg.email,
          name: reg.name,
          seminarTitle: seminar.title,
          reservationId: id,
          reservationNumber: reg.reservation_number || undefined,
        },
        tenantKey
      );
      console.log(`[Booking] Cancellation email sent to ${reg.email}`);
    } catch (emailError) {
      console.error("[Booking] Failed to send cancellation email:", emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json({ error: "予約のキャンセルに失敗しました" }, { status: 500 });
  }
}
