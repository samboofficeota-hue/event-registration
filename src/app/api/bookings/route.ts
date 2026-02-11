import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  findMasterRowById,
  findMasterRowByIdForTenant,
  appendRow,
  updateCell,
  findRowById,
  updateRow,
  getSheetData,
  appendReservationIndex,
  appendReservationIndexToMaster,
} from "@/lib/google/sheets";
import { sendReservationConfirmation, sendCancellationNotification } from "@/lib/email/resend";
import { rowToSeminar } from "@/lib/seminars";
import { isMemberDomainEmail } from "@/lib/member-domains";
import { generateReservationNumber } from "@/lib/reservation-number";
import { getTenantConfig, isTenantKey } from "@/lib/tenant-config";
import { getSurveyQuestions } from "@/lib/survey/storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seminar_id, name, email, company, department, phone, invitation_code, tenant } = body;
    const emailTrimmed = (email || "").trim().toLowerCase();
    const tenantKey = tenant && isTenantKey(tenant) ? tenant : undefined;

    if (!seminar_id || !name || !email) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    const seminarResult = tenantKey
      ? await findMasterRowByIdForTenant(tenantKey, seminar_id)
      : await findMasterRowById(seminar_id);
    if (!seminarResult) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }

    const tenantConfig = tenantKey ? getTenantConfig(tenantKey) : null;
    const masterSpreadsheetId = tenantConfig?.masterSpreadsheetId ?? process.env.GOOGLE_SPREADSHEET_ID!;

    const seminar = rowToSeminar(seminarResult.values);

    if (seminar.status !== "published") {
      return NextResponse.json({ error: "このセミナーは現在予約を受け付けていません" }, { status: 400 });
    }

    if (seminar.current_bookings >= seminar.capacity) {
      return NextResponse.json({ error: "定員に達しました" }, { status: 400 });
    }

    if (!seminar.spreadsheet_id) {
      return NextResponse.json({ error: "セミナー用スプレッドシートが見つかりません" }, { status: 500 });
    }

    // 会員限定セミナー: 会員企業ドメイン or 招待コードで受付
    if (seminar.target === "members_only") {
      const isMember = await isMemberDomainEmail(email, tenantKey);
      if (!isMember) {
        const code = (invitation_code || "").trim();
        const expected = (seminar.invitation_code || "").trim().toLowerCase();
        if (!expected || code.toLowerCase() !== expected) {
          return NextResponse.json(
            { error: "このセミナーは会員限定です。会員企業のメールアドレスでお申し込みください。" },
            { status: 403 }
          );
        }
      }
    }

    // 重複申込チェック（同一セミナー・同一メール・確定）
    const existingRows = await getSheetData(seminar.spreadsheet_id, "予約情報");
    const duplicate = existingRows.slice(1).find(
      (r) => r[2]?.trim().toLowerCase() === emailTrimmed && r[6] === "confirmed"
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const manageUrl = tenantKey
      ? `${appUrl}/${tenantKey}/booking/manage`
      : `${appUrl}/booking/manage`;
    const date = new Date(seminar.date);
    const formattedDate = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

    // Googleカレンダー「イベントを追加」URL（予約完了メールの「カレンダーに登録」用）
    // スプレッドシートの日時は JST で扱うため、JST → UTC に変換して dates を生成する
    const buildCalendarAddUrl = (): string | undefined => {
      if (!seminar.date) return undefined;
      const m = String(seminar.date).match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
      if (!m) return undefined;
      const [, y, mo, d, h, min] = m.map(Number);
      // 日時を JST として解釈し、UTC のミリ秒に変換（JST = UTC+9 → 9時間引く）
      const jstMs = Date.UTC(y, mo - 1, d, h, min, 0);
      const utcStart = new Date(jstMs - 9 * 60 * 60 * 1000);
      // end_time ("HH:mm") から終了UTC を計算
      const endMatch = (seminar.end_time || "").match(/^(\d{2}):(\d{2})$/);
      const endH = endMatch ? Number(endMatch[1]) : h + 1;
      const endMin = endMatch ? Number(endMatch[2]) : min;
      const jstEndMs = Date.UTC(y, mo - 1, d, endH, endMin, 0);
      const utcEnd = new Date(jstEndMs - 9 * 60 * 60 * 1000);
      const fmt = (date: Date) =>
        `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}${String(date.getUTCSeconds()).padStart(2, "0")}Z`;
      const params = new URLSearchParams({
        action: "TEMPLATE",
        text: seminar.title || "セミナー",
        dates: `${fmt(utcStart)}/${fmt(utcEnd)}`,
      });
      if (seminar.meet_url) params.set("location", seminar.meet_url);
      return `https://calendar.google.com/calendar/render?${params.toString()}`;
    };
    const calendarAddUrl = buildCalendarAddUrl();

    // 事前アンケートの存在確認
    let hasPreSurvey = false;
    if (seminar.spreadsheet_id) {
      try {
        const preQuestions = await getSurveyQuestions(seminar.spreadsheet_id, "pre");
        hasPreSurvey = Array.isArray(preQuestions) && preQuestions.length > 0;
      } catch {
        hasPreSurvey = false;
      }
    }

    if (duplicate) {
      const existingId = duplicate[0];
      const existingNumber = duplicate[11] || "";
      try {
        await sendReservationConfirmation(
          {
            to: email,
            name,
            seminarTitle: seminar.title,
            seminarDate: formattedDate,
            reservationNumber: existingNumber,
            reservationId: existingId,
            preSurveyUrl: tenantKey
              ? `${appUrl}/${tenantKey}/${seminar_id}/pre-survey?rid=${existingId}`
              : `${appUrl}/seminars/${seminar_id}/pre-survey?rid=${existingId}`,
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
          id: existingId,
          seminar_id,
          name,
          email,
          reservation_number: existingNumber || undefined,
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

    const receiptCount = Math.max(0, existingRows.length - 1);
    const reservationNumber = generateReservationNumber(
      seminar.date,
      seminar.id,
      receiptCount + 1
    );

    const reservationRow = [
      id,
      name,
      email,
      company || "",
      department || "",
      phone || "",
      "confirmed",
      "FALSE",
      "FALSE",
      now,
      "",
      reservationNumber,
    ];

    await appendRow(seminar.spreadsheet_id, "予約情報", reservationRow);
    if (tenantKey && tenantConfig) {
      await appendReservationIndexToMaster(
        tenantConfig.masterSpreadsheetId,
        reservationNumber,
        seminar.spreadsheet_id,
        id
      );
    } else {
      await appendReservationIndex(reservationNumber, seminar.spreadsheet_id, id);
    }

    await updateCell(
      masterSpreadsheetId,
      "セミナー一覧",
      seminarResult.rowIndex,
      6,
      String(seminar.current_bookings + 1)
    );

    const preSurveyUrlForNew = tenantKey
      ? `${appUrl}/${tenantKey}/${seminar_id}/pre-survey?rid=${id}`
      : `${appUrl}/seminars/${seminar_id}/pre-survey?rid=${id}`;

    try {
      await sendReservationConfirmation(
        {
          to: email,
          name,
          seminarTitle: seminar.title,
          seminarDate: formattedDate,
          reservationNumber,
          reservationId: id,
          preSurveyUrl: preSurveyUrlForNew,
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
// 共通: セミナー情報と予約行を検索して返す
// ---------------------------------------------------------------------------
async function resolveBooking(
  seminarId: string,
  reservationId: string,
  tenant?: string
) {
  const seminarResult =
    tenant && isTenantKey(tenant)
      ? await findMasterRowByIdForTenant(tenant, seminarId)
      : await findMasterRowById(seminarId);
  if (!seminarResult) return { error: "セミナーが見つかりません", status: 404 } as const;

  const seminar = rowToSeminar(seminarResult.values);
  if (!seminar.spreadsheet_id) {
    return { error: "セミナー用スプレッドシートが見つかりません", status: 500 } as const;
  }

  const reservationResult = await findRowById(seminar.spreadsheet_id, "予約情報", reservationId);
  if (!reservationResult) return { error: "予約が見つかりません", status: 404 } as const;

  if (reservationResult.values[6] === "cancelled") {
    return { error: "この予約は既にキャンセルされています", status: 400 } as const;
  }

  return { seminar, seminarResult, reservationResult } as const;
}

// ---------------------------------------------------------------------------
// PUT: 予約情報の更新（氏名・メール・会社名・部署・電話番号）
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { seminar_id, id, name, email, company, department, phone, tenant } = body;
    const tenantKey = tenant && isTenantKey(tenant) ? tenant : undefined;

    if (!seminar_id || !id) {
      return NextResponse.json({ error: "seminar_id と予約ID が必要です" }, { status: 400 });
    }

    const result = await resolveBooking(seminar_id, id, tenantKey);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { seminar, reservationResult } = result;
    const row = reservationResult.values;

    const updated = [
      row[0],
      name ?? row[1],
      email ?? row[2],
      company ?? row[3],
      department ?? row[4],
      phone ?? row[5],
      row[6],
      row[7],
      row[8],
      row[9],
      row[10] || "",
      row[11] || "", // 予約番号
    ];

    await updateRow(seminar.spreadsheet_id, "予約情報", reservationResult.rowIndex, updated);

    return NextResponse.json({
      id,
      seminar_id,
      name: updated[1],
      email: updated[2],
      company: updated[3],
      department: updated[4],
      phone: updated[5],
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
    const { seminar_id, id, tenant } = body;
    const tenantKey = tenant && isTenantKey(tenant) ? tenant : undefined;

    if (!seminar_id || !id) {
      return NextResponse.json({ error: "seminar_id と予約ID が必要です" }, { status: 400 });
    }

    const result = await resolveBooking(seminar_id, id, tenantKey);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { seminar, seminarResult, reservationResult } = result;
    const row = reservationResult.values;

    const updated = [
      row[0], row[1], row[2], row[3], row[4], row[5],
      "cancelled",
      row[7], row[8], row[9],
      row[10] || "",
      row[11] || "", // 予約番号
    ];

    await updateRow(seminar.spreadsheet_id, "予約情報", reservationResult.rowIndex, updated);

    // マスターの current_bookings をデクリメント
    const tenantConfig = tenantKey ? getTenantConfig(tenantKey) : null;
    const masterSpreadsheetIdForDelete =
      tenantConfig?.masterSpreadsheetId ?? process.env.GOOGLE_SPREADSHEET_ID!;
    const currentBookings = parseInt(seminarResult.values[6] || "0", 10);
    await updateCell(
      masterSpreadsheetIdForDelete,
      "セミナー一覧",
      seminarResult.rowIndex,
      6,
      String(Math.max(0, currentBookings - 1))
    );

    try {
      await sendCancellationNotification(
        {
          to: row[2],
          name: row[1],
          seminarTitle: seminar.title,
          reservationId: id,
          reservationNumber: row[11] || undefined,
        },
        tenantKey
      );

      console.log(`[Booking] Cancellation email sent to ${row[2]}`);
    } catch (emailError) {
      // メール送信失敗はログに記録するが、キャンセル自体は成功として返す
      console.error("[Booking] Failed to send cancellation email:", emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json({ error: "予約のキャンセルに失敗しました" }, { status: 500 });
  }
}
