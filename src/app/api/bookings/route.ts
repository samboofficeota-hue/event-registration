import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { findMasterRowById, appendRow, updateCell, findRowById, updateRow } from "@/lib/google/sheets";
import { sendReservationConfirmation, sendCancellationNotification } from "@/lib/email/resend";
import type { Seminar } from "@/lib/types";

// マスタースプレッドシート列順: A~R (新レイアウトは18列、P:画像URL)
function rowToSeminar(row: string[]): Seminar {
  const isNewLayout = row.length >= 18;
  return {
    id: row[0] || "",
    title: row[1] || "",
    description: row[2] || "",
    date: row[3] || "",
    duration_minutes: parseInt(row[4] || "0", 10),
    capacity: parseInt(row[5] || "0", 10),
    current_bookings: parseInt(row[6] || "0", 10),
    speaker: row[7] || "",
    meet_url: row[8] || "",
    calendar_event_id: row[9] || "",
    status: (row[10] as Seminar["status"]) || "draft",
    spreadsheet_id: row[11] || "",
    speaker_title: isNewLayout ? row[12] || "" : "",
    format: (isNewLayout ? row[13] : "online") as Seminar["format"],
    target: (isNewLayout ? row[14] : "public") as Seminar["target"],
    image_url: isNewLayout ? row[15] || "" : "",
    created_at: isNewLayout ? row[16] || "" : row[12] || "",
    updated_at: isNewLayout ? row[17] || "" : row[13] || "",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { seminar_id, name, email, company, department, phone } = body;

    if (!seminar_id || !name || !email) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    // マスターからセミナー情報を取得
    const seminarResult = await findMasterRowById(seminar_id);
    if (!seminarResult) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }

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

    const now = new Date().toISOString();
    const id = uuidv4();

    // セミナー専用スプレッドシートの「予約情報」シートに追記
    // 列順: ID, 氏名, メールアドレス, 会社名, 部署, 電話番号, ステータス,
    //       事前アンケート回答済, 事後アンケート回答済, 予約日時, 備考
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
      "", // 備考
    ];

    await appendRow(seminar.spreadsheet_id, "予約情報", reservationRow);

    // マスターの current_bookings をインクリメント (G列 = index 6)
    await updateCell(
      process.env.GOOGLE_SPREADSHEET_ID!,
      "セミナー一覧",
      seminarResult.rowIndex,
      6,
      String(seminar.current_bookings + 1)
    );

    // メール送信: 予約確認メール
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const preSurveyUrl = `${appUrl}/seminars/${seminar_id}/pre-survey?rid=${id}`;

      // 日時のフォーマット
      const date = new Date(seminar.date);
      const formattedDate = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

      await sendReservationConfirmation({
        to: email,
        name,
        seminarTitle: seminar.title,
        seminarDate: formattedDate,
        reservationId: id,
        preSurveyUrl,
        meetUrl: seminar.meet_url || undefined,
      });

      console.log(`[Booking] Confirmation email sent to ${email}`);
    } catch (emailError) {
      // メール送信失敗はログに記録するが、予約自体は成功として返す
      console.error("[Booking] Failed to send confirmation email:", emailError);
    }

    return NextResponse.json(
      {
        id,
        seminar_id,
        name,
        email,
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
async function resolveBooking(seminarId: string, reservationId: string) {
  const seminarResult = await findMasterRowById(seminarId);
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
    const { seminar_id, id, name, email, company, department, phone } = body;

    if (!seminar_id || !id) {
      return NextResponse.json({ error: "seminar_id と予約ID が必要です" }, { status: 400 });
    }

    const result = await resolveBooking(seminar_id, id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { seminar, reservationResult } = result;
    const row = reservationResult.values;

    // 更新される項目のみ書き換え、それ以外は現在の値を維持
    const updated = [
      row[0],                          // ID
      name ?? row[1],                  // 氏名
      email ?? row[2],                 // メールアドレス
      company ?? row[3],               // 会社名
      department ?? row[4],            // 部署
      phone ?? row[5],                 // 電話番号
      row[6],                          // ステータス
      row[7],                          // 事前アンケート回答済
      row[8],                          // 事後アンケート回答済
      row[9],                          // 予約日時
      row[10] || "",                   // 備考
    ];

    // セミナー専用スプレッドシートの該当行を更新
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
    const { seminar_id, id } = body;

    if (!seminar_id || !id) {
      return NextResponse.json({ error: "seminar_id と予約ID が必要です" }, { status: 400 });
    }

    const result = await resolveBooking(seminar_id, id);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { seminar, seminarResult, reservationResult } = result;
    const row = reservationResult.values;

    // ステータスを cancelled に変更
    const updated = [
      row[0], row[1], row[2], row[3], row[4], row[5],
      "cancelled",
      row[7], row[8], row[9],
      row[10] || "",
    ];

    await updateRow(seminar.spreadsheet_id, "予約情報", reservationResult.rowIndex, updated);

    // マスターの current_bookings をデクリメント
    const currentBookings = parseInt(seminarResult.values[6] || "0", 10);
    await updateCell(
      process.env.GOOGLE_SPREADSHEET_ID!,
      "セミナー一覧",
      seminarResult.rowIndex,
      6,
      String(Math.max(0, currentBookings - 1))
    );

    // メール送信: キャンセル確認メール
    try {
      await sendCancellationNotification({
        to: row[2], // メールアドレス
        name: row[1], // 氏名
        seminarTitle: seminar.title,
        reservationId: id,
      });

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
