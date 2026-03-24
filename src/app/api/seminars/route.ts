import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createCalendarEvent } from "@/lib/google/calendar";
import { createSeminarSpreadsheet } from "@/lib/google/sheets";
import { d1SeminarToSeminar } from "@/lib/seminars";
import { getSurveyQuestions } from "@/lib/survey/storage";
import { isTenantKey, getTenantConfig } from "@/lib/tenant-config";
import { verifyAdminRequest } from "@/lib/auth";
import { generateEmailSchedules } from "@/lib/email/generate-schedules";
import {
  getD1,
  getSeminarsByTenantFromD1,
  insertSeminarToD1,
  type D1Seminar,
} from "@/lib/d1";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenant = searchParams.get("tenant") || "default";
    const statusFilter = searchParams.get("status") || undefined;
    const withSurveyStatus = searchParams.get("with_survey_status") === "1";
    const isAdmin = await verifyAdminRequest(request);

    // 正規化: tenant が有効なキーでなければ "default"
    const tenantKey = isTenantKey(tenant) ? tenant : "default";

    const rows = await getSeminarsByTenantFromD1(tenantKey, statusFilter);
    let seminars = rows.map(d1SeminarToSeminar);

    seminars.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 非管理者には招待コードを返さない
    if (!isAdmin) {
      seminars = seminars.map((s) => ({ ...s, invitation_code: "" }));
    }

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
  const ok = await verifyAdminRequest(request);
  if (!ok) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const {
      title,
      description,
      date,
      end_time,
      capacity,
      speaker,
      speaker_title,
      speaker_reference_url,
      format,
      target,
      status,
      invitation_code,
      tenant,
    } = body;
    const tenantKey = tenant && isTenantKey(tenant) ? tenant : "default";

    if (!title || !date || !speaker) {
      return NextResponse.json(
        { error: "必須項目（タイトル・日時・登壇者）が不足しています" },
        { status: 400 }
      );
    }

    const endTimeVal = (end_time || "").toString().trim();
    const cap = Number(capacity) || 100;

    // 1. Google Calendar イベント作成 + Meet URL 生成
    let meetUrl = "";
    let calendarEventId = "";
    try {
      const calEvent = await createCalendarEvent(title, date, endTimeVal, description);
      meetUrl = calEvent.meetUrl;
      calendarEventId = calEvent.eventId;
    } catch (calError) {
      console.error("Calendar event creation failed:", calError);
    }

    // 2. セミナー専用スプレッドシートを作成（アンケート用）
    const tenantConfig = tenantKey !== "default" ? getTenantConfig(tenantKey) : null;
    const tenantFolderId = tenantConfig?.driveFolderId || undefined;
    let spreadsheetId = "";
    try {
      spreadsheetId = await createSeminarSpreadsheet(title, tenantFolderId);
    } catch (ssError) {
      console.error("Spreadsheet creation failed:", ssError);
      return NextResponse.json(
        { error: "セミナー用スプレッドシートの作成に失敗しました" },
        { status: 500 }
      );
    }

    const formatVal = ["venue", "online", "hybrid"].includes(format) ? format : "online";
    const targetVal = ["members_only", "public"].includes(target) ? target : "public";
    const now = new Date().toISOString();
    const id = uuidv4();
    const invitationCodeVal = (invitation_code ?? "").toString().trim();

    const seminar: D1Seminar = {
      id,
      tenant: tenantKey,
      title,
      description: description || "",
      date,
      end_time: endTimeVal,
      capacity: cap,
      current_bookings: 0,
      speaker: speaker || "",
      speaker_title: speaker_title || "",
      speaker_reference_url: speaker_reference_url || "",
      format: formatVal,
      target: targetVal,
      invitation_code: invitationCodeVal,
      image_url: "",
      meet_url: meetUrl,
      calendar_event_id: calendarEventId,
      status: status || "draft",
      spreadsheet_id: spreadsheetId,
      created_at: now,
      updated_at: now,
    };

    // 3. D1 に登録
    await insertSeminarToD1(seminar);

    // 4. メール配信スケジュールを自動生成
    if (date) {
      generateEmailSchedules(id, date).catch(() => {});
    }

    return NextResponse.json(d1SeminarToSeminar(seminar), { status: 201 });
  } catch (error) {
    console.error("Error creating seminar:", error);
    return NextResponse.json({ error: "セミナーの作成に失敗しました" }, { status: 500 });
  }
}
