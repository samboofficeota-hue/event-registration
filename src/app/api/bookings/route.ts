import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { findMasterRowById, appendRow, updateCell } from "@/lib/google/sheets";
import type { Seminar } from "@/lib/types";

// マスタースプレッドシート列順: A~R (新レイアウトは18列)
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
    calendar_link: isNewLayout ? row[15] || "" : "",
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
