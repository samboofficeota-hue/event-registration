import { NextRequest, NextResponse } from "next/server";
import {
  findReservationByNumber,
  findReservationByNumberForTenant,
  getSheetData,
  getMasterData,
  getMasterDataForTenant,
} from "@/lib/google/sheets";
import { rowToSeminar } from "@/lib/seminars";
import { isValidReservationNumberFormat } from "@/lib/reservation-number";
import { isTenantKey, getTenantConfig } from "@/lib/tenant-config";
import type { Reservation } from "@/lib/types";

function rowToReservation(row: string[]): Reservation {
  return {
    id: row[0] || "",
    name: row[1] || "",
    email: row[2] || "",
    company: row[3] || "",
    department: row[4] || "",
    phone: row[5] || "",
    status: (row[6] as Reservation["status"]) || "confirmed",
    pre_survey_completed: row[7] === "TRUE",
    post_survey_completed: row[8] === "TRUE",
    created_at: row[9] || "",
    note: row[10] || "",
    reservation_number: row[11] || undefined,
  };
}

/**
 * GET: 予約番号で予約を検索し、seminar_id と reservation_id を返す。
 * 照合結果は区別しない（見つからない場合も同じメッセージ）。
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const number = searchParams.get("number")?.trim();
    const tenant = searchParams.get("tenant");
    const tenantKey = tenant && isTenantKey(tenant) ? tenant : undefined;

    if (!number) {
      return NextResponse.json(
        { error: "予約番号を入力してください" },
        { status: 400 }
      );
    }

    if (!isValidReservationNumberFormat(number)) {
      return NextResponse.json(
        { error: "予約番号が見つかりません" },
        { status: 404 }
      );
    }

    const tenantConfig = tenantKey ? getTenantConfig(tenantKey) : null;
    const index = tenantConfig
      ? await findReservationByNumberForTenant(tenantConfig.masterSpreadsheetId, number)
      : await findReservationByNumber(number);
    if (!index) {
      return NextResponse.json(
        { error: "予約番号が見つかりません" },
        { status: 404 }
      );
    }

    const masterRows = tenantKey
      ? await getMasterDataForTenant(tenantKey)
      : await getMasterData();
    if (!masterRows) {
      return NextResponse.json(
        { error: "予約番号が見つかりません" },
        { status: 404 }
      );
    }
    const seminarRow = masterRows.slice(1).find(
      (r) => (r[11] || "").trim() === index.spreadsheet_id
    );
    if (!seminarRow) {
      return NextResponse.json(
        { error: "予約番号が見つかりません" },
        { status: 404 }
      );
    }

    const seminar = rowToSeminar(seminarRow);
    const reservationRows = await getSheetData(
      index.spreadsheet_id,
      "予約情報"
    );
    const reservationRow = reservationRows
      .slice(1)
      .find((r) => (r[0] || "").trim() === index.reservation_id);
    if (!reservationRow) {
      return NextResponse.json(
        { error: "予約番号が見つかりません" },
        { status: 404 }
      );
    }

    if (reservationRow[6] === "cancelled") {
      return NextResponse.json(
        { error: "予約番号が見つかりません" },
        { status: 404 }
      );
    }

    const reservation = rowToReservation(reservationRow);

    return NextResponse.json({
      seminar_id: seminar.id,
      reservation_id: index.reservation_id,
      seminar: {
        id: seminar.id,
        title: seminar.title,
        date: seminar.date,
      },
      reservation,
    });
  } catch (error) {
    console.error("[bookings/by-number]", error);
    return NextResponse.json(
      { error: "予約番号が見つかりません" },
      { status: 404 }
    );
  }
}
