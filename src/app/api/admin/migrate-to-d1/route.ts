/**
 * 一回限りの Sheets → D1 移行 API
 * POST /api/admin/migrate-to-d1
 *
 * 実行後は必要に応じてこのファイルを削除してください。
 * 管理者認証必須。
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/auth";
import { getMasterData, getMasterDataForTenant, getSheetData } from "@/lib/google/sheets";
import { rowToSeminar } from "@/lib/seminars";
import {
  getD1,
  insertSeminarToD1,
  insertRegistrationToD1,
  type D1Seminar,
  type D1Registration,
} from "@/lib/d1";
import { TENANT_KEYS } from "@/lib/tenant-config";

function rowToRegistration(
  row: string[],
  seminarId: string,
  tenant: string
): D1Registration {
  const r = [...row];
  while (r.length < 13) r.push("");
  return {
    id: r[0],
    seminar_id: seminarId,
    tenant,
    reservation_number: r[11] || "",
    name: r[1] || "",
    email: r[2] || "",
    company: r[3] || "",
    department: r[4] || "",
    phone: r[5] || "",
    status: r[6] || "confirmed",
    pre_survey_completed: r[7] === "TRUE" ? 1 : 0,
    post_survey_completed: r[8] === "TRUE" ? 1 : 0,
    created_at: r[9] || new Date().toISOString(),
    note: r[10] || "",
    participation_method: r[12] || "",
  };
}

export async function POST(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const db = await getD1();
  const results: Record<string, { seminars: number; registrations: number; errors: string[] }> = {};

  // default テナント + 各テナントをループ
  const tenants: Array<{ key: string; label: string }> = [
    { key: "default", label: "default" },
    ...TENANT_KEYS.map((t) => ({ key: t, label: t })),
  ];

  for (const { key: tenantKey } of tenants) {
    results[tenantKey] = { seminars: 0, registrations: 0, errors: [] };

    let rows: string[][] = [];
    try {
      if (tenantKey === "default") {
        rows = await getMasterData();
      } else {
        const r = await getMasterDataForTenant(tenantKey);
        rows = r ?? [];
      }
    } catch (e) {
      results[tenantKey].errors.push(`マスターデータ取得失敗: ${e}`);
      continue;
    }

    const seminarRows = rows.slice(1).filter((r) => r[0]?.trim());

    for (const row of seminarRows) {
      const seminar = rowToSeminar(row);
      const d1Seminar: D1Seminar = {
        id: seminar.id,
        tenant: tenantKey,
        title: seminar.title,
        description: seminar.description,
        date: seminar.date,
        end_time: seminar.end_time,
        capacity: seminar.capacity,
        current_bookings: seminar.current_bookings,
        speaker: seminar.speaker,
        speaker_title: seminar.speaker_title,
        speaker_reference_url: seminar.speaker_reference_url,
        format: seminar.format,
        target: seminar.target,
        invitation_code: seminar.invitation_code,
        image_url: seminar.image_url,
        meet_url: seminar.meet_url,
        calendar_event_id: seminar.calendar_event_id,
        status: seminar.status,
        spreadsheet_id: seminar.spreadsheet_id,
        created_at: seminar.created_at || new Date().toISOString(),
        updated_at: seminar.updated_at || new Date().toISOString(),
      };

      try {
        // 既存データは上書き（UPSERT）
        await db.prepare(`
          INSERT INTO seminars (
            id, tenant, title, description, date, end_time,
            capacity, current_bookings, speaker, speaker_title,
            speaker_reference_url, format, target, invitation_code,
            image_url, meet_url, calendar_event_id, status,
            spreadsheet_id, created_at, updated_at
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET
            title=excluded.title, description=excluded.description,
            date=excluded.date, end_time=excluded.end_time,
            capacity=excluded.capacity, current_bookings=excluded.current_bookings,
            speaker=excluded.speaker, speaker_title=excluded.speaker_title,
            speaker_reference_url=excluded.speaker_reference_url,
            format=excluded.format, target=excluded.target,
            invitation_code=excluded.invitation_code, image_url=excluded.image_url,
            meet_url=excluded.meet_url, calendar_event_id=excluded.calendar_event_id,
            status=excluded.status, spreadsheet_id=excluded.spreadsheet_id,
            updated_at=excluded.updated_at
        `).bind(
          d1Seminar.id, d1Seminar.tenant, d1Seminar.title, d1Seminar.description,
          d1Seminar.date, d1Seminar.end_time, d1Seminar.capacity, d1Seminar.current_bookings,
          d1Seminar.speaker, d1Seminar.speaker_title, d1Seminar.speaker_reference_url,
          d1Seminar.format, d1Seminar.target, d1Seminar.invitation_code,
          d1Seminar.image_url, d1Seminar.meet_url, d1Seminar.calendar_event_id,
          d1Seminar.status, d1Seminar.spreadsheet_id, d1Seminar.created_at, d1Seminar.updated_at
        ).run();
        results[tenantKey].seminars++;
      } catch (e) {
        results[tenantKey].errors.push(`seminar ${seminar.id} insert失敗: ${e}`);
        continue;
      }

      // 予約情報を移行
      if (!seminar.spreadsheet_id) continue;
      let reservationRows: string[][] = [];
      try {
        reservationRows = await getSheetData(seminar.spreadsheet_id, "予約情報");
      } catch {
        // 予約シートが存在しない場合はスキップ
        continue;
      }

      for (const resRow of reservationRows.slice(1).filter((r) => r[0]?.trim())) {
        const reg = rowToRegistration(resRow, seminar.id, tenantKey);
        try {
          await db.prepare(`
            INSERT INTO registrations (
              id, seminar_id, tenant, reservation_number,
              name, email, company, department, phone,
              status, participation_method,
              pre_survey_completed, post_survey_completed,
              note, created_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
              status=excluded.status,
              name=excluded.name, email=excluded.email,
              company=excluded.company, department=excluded.department,
              phone=excluded.phone,
              participation_method=excluded.participation_method,
              pre_survey_completed=excluded.pre_survey_completed,
              post_survey_completed=excluded.post_survey_completed,
              note=excluded.note
          `).bind(
            reg.id, reg.seminar_id, reg.tenant, reg.reservation_number,
            reg.name, reg.email, reg.company, reg.department, reg.phone,
            reg.status, reg.participation_method,
            reg.pre_survey_completed, reg.post_survey_completed,
            reg.note, reg.created_at
          ).run();
          results[tenantKey].registrations++;
        } catch (e) {
          results[tenantKey].errors.push(`registration ${reg.id} insert失敗: ${e}`);
        }
      }
    }
  }

  return NextResponse.json({ success: true, results });
}
