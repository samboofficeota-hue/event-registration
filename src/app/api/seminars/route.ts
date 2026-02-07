import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getMasterData,
  appendMasterRow,
  createSeminarSpreadsheet,
  appendRow,
} from "@/lib/google/sheets";
import { createCalendarEvent } from "@/lib/google/calendar";
import { rowToSeminar } from "@/lib/seminars";
import { getSurveyQuestions } from "@/lib/survey/storage";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const withSurveyStatus = searchParams.get("with_survey_status") === "1";

    const rows = await getMasterData();
    let seminars = rows.slice(1).filter((row) => row[0]?.trim()).map(rowToSeminar);

    if (statusFilter) {
      seminars = seminars.filter((s) => s.status === statusFilter);
    }

    seminars.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (withSurveyStatus) {
      const withStatus = await Promise.all(
        seminars.map(async (s) => {
          if (!s.spreadsheet_id) {
            return { ...s, has_pre_survey: false, has_post_survey: false };
          }
          const [pre, post] = await Promise.all([
            getSurveyQuestions(s.spreadsheet_id, "pre"),
            getSurveyQuestions(s.spreadsheet_id, "post"),
          ]);
          return {
            ...s,
            has_pre_survey: Array.isArray(pre) && pre.length > 0,
            has_post_survey: Array.isArray(post) && post.length > 0,
          };
        })
      );
      return NextResponse.json(withStatus);
    }

    return NextResponse.json(seminars);
  } catch (error) {
    console.error("Error fetching seminars:", error);
    return NextResponse.json({ error: "セミナー一覧の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      date,
      duration_minutes,
      capacity,
      speaker,
      speaker_title,
      format,
      target,
      status,
    } = body;

    if (!title || !date || !speaker) {
      return NextResponse.json(
        { error: "必須項目（タイトル・日時・登壇者）が不足しています" },
        { status: 400 }
      );
    }
    const duration = Number(duration_minutes) || 60;
    const cap = Number(capacity) || 100;

    // 1. Google Calendar イベント作成 + Meet URL 生成
    let meetUrl = "";
    let calendarEventId = "";
    try {
      const calEvent = await createCalendarEvent(title, date, duration, description);
      meetUrl = calEvent.meetUrl;
      calendarEventId = calEvent.eventId;
    } catch (calError) {
      console.error("Calendar event creation failed:", calError);
    }

    // 2. セミナー専用スプレッドシートを自動作成
    let spreadsheetId = "";
    try {
      spreadsheetId = await createSeminarSpreadsheet(title);
    } catch (ssError) {
      console.error("Spreadsheet creation failed:", ssError);
      return NextResponse.json(
        { error: "セミナー用スプレッドシートの作成に失敗しました" },
        { status: 500 }
      );
    }

    const formatVal = ["venue", "online", "hybrid"].includes(format) ? format : "online";
    const targetVal = ["members_only", "public"].includes(target) ? target : "public";

    // 3. セミナー専用スプレッドシートの「イベント情報」シートにも書き込む
    // 列順: A:id B:title C:description D:date E:duration_minutes F:capacity
    //       G:current_bookings H:speaker I:meet_url J:calendar_event_id
    //       K:status L:spreadsheet_id M:肩書き N:開催形式 O:対象 P:画像URL Q:created_at R:updated_at
    const now = new Date().toISOString();
    const id = uuidv4();
    try {
      await appendRow(spreadsheetId, "イベント情報", [
        id,                   // A
        title,                // B
        description || "",    // C
        date,                 // D
        String(duration),     // E
        String(cap),          // F
        "0",                  // G: current_bookings
        speaker || "",        // H
        meetUrl,              // I
        calendarEventId,      // J
        status || "draft",    // K
        spreadsheetId,        // L
        speaker_title || "",  // M
        formatVal,            // N
        targetVal,            // O
        "",                   // P: image_url（画像登録時に更新）
        now,                  // Q: created_at
        now,                  // R: updated_at
      ]);
    } catch (err) {
      console.error("Failed to write event info:", err);
    }

    // 4. マスタースプレッドシートに登録
    const masterRow = [
      id,
      title,
      description || "",
      date,
      String(duration),
      String(cap),
      "0",
      speaker || "",
      meetUrl,
      calendarEventId,
      status || "draft",
      spreadsheetId,
      speaker_title || "",
      formatVal,
      targetVal,
      "",        // image_url（画像登録時に更新）
      now,
      now,
    ];

    await appendMasterRow(masterRow);

    return NextResponse.json(rowToSeminar(masterRow), { status: 201 });
  } catch (error) {
    console.error("Error creating seminar:", error);
    return NextResponse.json({ error: "セミナーの作成に失敗しました" }, { status: 500 });
  }
}
