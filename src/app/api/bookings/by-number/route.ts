import { NextRequest, NextResponse } from "next/server";
import { getSeminarByIdFromD1, getRegistrationByNumberFromD1 } from "@/lib/d1";
import { d1SeminarToSeminar } from "@/lib/seminars";
import { isValidReservationNumberFormat } from "@/lib/reservation-number";
import type { Reservation } from "@/lib/types";

/**
 * GET: 予約番号（＋メール）で予約を検索し、seminar_id と reservation_id を返す。
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const number = searchParams.get("number")?.trim();
    const emailParam = searchParams.get("email")?.trim().toLowerCase();

    if (!number) {
      return NextResponse.json({ error: "予約番号を入力してください" }, { status: 400 });
    }
    if (!isValidReservationNumberFormat(number)) {
      return NextResponse.json({ error: "予約番号が見つかりません" }, { status: 404 });
    }

    const reg = await getRegistrationByNumberFromD1(number);
    if (!reg || reg.status === "cancelled") {
      return NextResponse.json({ error: "予約番号が見つかりません" }, { status: 404 });
    }

    // メールアドレスで本人確認
    if (!emailParam || reg.email.trim().toLowerCase() !== emailParam) {
      return NextResponse.json({ error: "予約番号が見つかりません" }, { status: 404 });
    }

    const seminarRow = await getSeminarByIdFromD1(reg.seminar_id);
    if (!seminarRow) {
      return NextResponse.json({ error: "予約番号が見つかりません" }, { status: 404 });
    }
    const seminar = d1SeminarToSeminar(seminarRow);

    const participation = reg.participation_method?.trim();
    const reservation: Reservation = {
      id: reg.id,
      name: reg.name,
      email: reg.email,
      company: reg.company,
      department: reg.department,
      phone: reg.phone,
      status: reg.status as Reservation["status"],
      pre_survey_completed: reg.pre_survey_completed === 1,
      post_survey_completed: reg.post_survey_completed === 1,
      created_at: reg.created_at,
      note: reg.note,
      reservation_number: reg.reservation_number || undefined,
      participation_method:
        participation === "venue" || participation === "online" ? participation : undefined,
    };

    return NextResponse.json({
      seminar_id: seminar.id,
      reservation_id: reg.id,
      seminar: {
        id: seminar.id,
        title: seminar.title,
        date: seminar.date,
      },
      reservation,
    });
  } catch (error) {
    console.error("[bookings/by-number]", error);
    return NextResponse.json({ error: "予約番号が見つかりません" }, { status: 404 });
  }
}
