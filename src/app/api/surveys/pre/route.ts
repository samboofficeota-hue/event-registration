import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { findMasterRowById, findRowById, appendRow, updateCell } from "@/lib/google/sheets";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reservation_id, seminar_id, answers } = body;

    if (!reservation_id || !seminar_id || !answers) {
      return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
    }

    // マスターからセミナー情報取得 → spreadsheet_id を得る
    const seminarResult = await findMasterRowById(seminar_id);
    if (!seminarResult) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }
    const spreadsheetId = seminarResult.values[11];
    if (!spreadsheetId) {
      return NextResponse.json({ error: "スプレッドシートが見つかりません" }, { status: 500 });
    }

    // セミナー専用スプレッドシートの「予約情報」シートで予約を確認
    const reservation = await findRowById(spreadsheetId, "予約情報", reservation_id);
    if (!reservation) {
      return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
    }

    // 事前アンケート回答済チェック (H列 = index 7)
    if (reservation.values[7] === "TRUE") {
      return NextResponse.json({ error: "事前アンケートは回答済みです" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const id = uuidv4();

    // 「事前アンケート」シートに追記
    // 列順: ID, 予約ID, 関心度(1-5), 期待すること, 関連経験, 事前質問, 回答日時, 備考
    const row = [
      id,
      reservation_id,
      answers.q1_interest_level || "",
      answers.q2_expectations || "",
      answers.q3_experience || "",
      answers.q4_questions || "",
      now,
      "",
    ];

    await appendRow(spreadsheetId, "事前アンケート", row);

    // 予約情報の事前アンケート回答済フラグを更新 (H列 = index 7)
    await updateCell(spreadsheetId, "予約情報", reservation.rowIndex, 7, "TRUE");

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Error submitting pre-survey:", error);
    return NextResponse.json({ error: "アンケートの送信に失敗しました" }, { status: 500 });
  }
}
