import { NextRequest, NextResponse } from "next/server";
import { findMasterRowById } from "@/lib/google/sheets";
import { rowToSeminar } from "@/lib/seminars";
import { getSurveyQuestions } from "@/lib/survey/storage";
import {
  preSurveyQuestions,
  postSurveyQuestions,
} from "@/lib/survey-config";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const type = request.nextUrl.searchParams.get("type");

    if (type !== "pre" && type !== "post") {
      return NextResponse.json(
        { error: "type は pre または post を指定してください" },
        { status: 400 }
      );
    }

    const result = await findMasterRowById(id);
    if (!result) {
      return NextResponse.json(
        { error: "セミナーが見つかりません" },
        { status: 404 }
      );
    }

    const seminar = rowToSeminar(result.values);
    const spreadsheetId = seminar.spreadsheet_id;

    if (!spreadsheetId) {
      const fallback =
        type === "pre" ? preSurveyQuestions : postSurveyQuestions;
      return NextResponse.json({ questions: fallback });
    }

    const questions = await getSurveyQuestions(spreadsheetId, type);
    const resolved =
      questions ?? (type === "pre" ? preSurveyQuestions : postSurveyQuestions);

    return NextResponse.json({ questions: resolved });
  } catch (error) {
    console.error("Error fetching survey questions:", error);
    return NextResponse.json(
      { error: "アンケート設問の取得に失敗しました" },
      { status: 500 }
    );
  }
}
