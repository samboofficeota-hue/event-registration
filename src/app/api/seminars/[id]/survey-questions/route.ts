import { NextRequest, NextResponse } from "next/server";
import {
  findMasterRowById,
  setSheetValues,
  SURVEY_QUESTION_SHEET_HEADER,
  surveyQuestionToRow,
} from "@/lib/google/sheets";
import { rowToSeminar } from "@/lib/seminars";
import { getSurveyQuestions } from "@/lib/survey/storage";
import {
  preSurveyQuestions,
  postSurveyQuestions,
} from "@/lib/survey-config";
import type { SurveyQuestion } from "@/lib/survey-config";

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { type, questions: questionsBody } = body as {
      type: "pre" | "post";
      questions: SurveyQuestion[];
    };

    if (type !== "pre" && type !== "post") {
      return NextResponse.json(
        { error: "type は pre または post を指定してください" },
        { status: 400 }
      );
    }

    if (!Array.isArray(questionsBody)) {
      return NextResponse.json(
        { error: "questions は配列で指定してください" },
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
      return NextResponse.json(
        { error: "このセミナーにはスプレッドシートが紐づいていません" },
        { status: 400 }
      );
    }

    const sheetName =
      type === "pre" ? "事前アンケート設問" : "事後アンケート設問";
    const rows = [
      SURVEY_QUESTION_SHEET_HEADER,
      ...questionsBody.map((q, i) => surveyQuestionToRow(q, i + 1)),
    ];
    await setSheetValues(spreadsheetId, sheetName, rows);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving survey questions:", error);
    return NextResponse.json(
      { error: "アンケート設問の保存に失敗しました" },
      { status: 500 }
    );
  }
}
