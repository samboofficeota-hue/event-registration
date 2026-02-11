import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getMasterData,
  getMasterDataForTenant,
  appendMasterRow,
  appendMasterRowForTenant,
  createSeminarSpreadsheet,
  appendRow,
  ensureMasterHeaders,
  ensureSeminarSpreadsheetHeaders,
} from "@/lib/google/sheets";
import { createCalendarEvent } from "@/lib/google/calendar";
import { rowToSeminar } from "@/lib/seminars";
import { getSurveyQuestions } from "@/lib/survey/storage";
import { isTenantKey, getTenantConfig } from "@/lib/tenant-config";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenant = searchParams.get("tenant");
    const statusFilter = searchParams.get("status");
    const withSurveyStatus = searchParams.get("with_survey_status") === "1";

    // マスタースプレッドシートのヘッダーを最新形式に自動修正
    const tenantKeyGet = tenant && isTenantKey(tenant) ? tenant : undefined;
    try {
      if (tenantKeyGet) {
        const tc = getTenantConfig(tenantKeyGet);
        if (tc) await ensureMasterHeaders(tc.masterSpreadsheetId);
      } else {
        const defaultMasterId = process.env.GOOGLE_SPREADSHEET_ID;
        if (defaultMasterId) await ensureMasterHeaders(defaultMasterId);
      }
    } catch (headerErr) {
      console.error("Failed to ensure master headers (GET):", headerErr);
    }

    const rows = tenant
      ? await getMasterDataForTenant(tenant)
      : await getMasterData();
    if (!rows) {
      return NextResponse.json(
        tenant ? [] : { error: "マスターデータの取得に失敗しました" },
        { status: tenant ? 200 : 500 }
      );
    }
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
    const tenantKey = tenant && isTenantKey(tenant) ? tenant : undefined;

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

    // 2. セミナー専用スプレッドシートを自動作成（テナントの場合はテナント用フォルダに配置）
    const tenantConfig = tenantKey ? getTenantConfig(tenantKey) : null;
    const tenantFolderId = tenantConfig?.driveFolderId || undefined;
    console.log("[seminars/POST] tenantKey:", tenantKey, "driveFolderId:", tenantConfig?.driveFolderId, "tenantFolderId:", tenantFolderId);
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

    // 2.5. マスタースプレッドシートのヘッダーを最新形式に自動修正
    try {
      if (tenantConfig) {
        await ensureMasterHeaders(tenantConfig.masterSpreadsheetId);
      } else {
        const defaultMasterId = process.env.GOOGLE_SPREADSHEET_ID;
        if (defaultMasterId) await ensureMasterHeaders(defaultMasterId);
      }
    } catch (headerErr) {
      console.error("Failed to ensure master headers:", headerErr);
    }

    // 3. セミナー専用スプレッドシートの「イベント情報」シートにも書き込む
    // 列順: A:id … R:updated_at S:参考URL
    const now = new Date().toISOString();
    const id = uuidv4();
    const invitationCodeVal = (invitation_code ?? "").toString().trim();
    try {
      await appendRow(spreadsheetId, "イベント情報", [
        id,
        title,
        description || "",
        date,
        endTimeVal,
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
        invitationCodeVal,    // P: 招待コード
        "",                   // Q: image_url
        now,                  // R: created_at
        now,                  // S: updated_at
        speaker_reference_url || "",  // T: 参考URL
      ]);
    } catch (err) {
      console.error("Failed to write event info:", err);
    }

    // 4. マスタースプレッドシートに登録（20列: 招待コードをP列に追加）
    const masterRow = [
      id,
      title,
      description || "",
      date,
      endTimeVal,
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
      invitationCodeVal,
      "",
      now,
      now,
      speaker_reference_url || "",
    ];

    if (tenantKey) {
      await appendMasterRowForTenant(tenantKey, masterRow);
    } else {
      await appendMasterRow(masterRow);
    }

    return NextResponse.json(rowToSeminar(masterRow), { status: 201 });
  } catch (error) {
    console.error("Error creating seminar:", error);
    return NextResponse.json({ error: "セミナーの作成に失敗しました" }, { status: 500 });
  }
}
