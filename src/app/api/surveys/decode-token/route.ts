import { NextRequest, NextResponse } from "next/server";
import { decodeSurveyToken } from "@/lib/survey-token";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const decoded = decodeSurveyToken(token);
  if (!decoded) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  return NextResponse.json({
    seminarId: decoded.seminarId,
    reservationId: decoded.reservationId,
  });
}
