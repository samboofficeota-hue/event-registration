"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SurveyForm } from "@/components/survey-form";
import { preSurveyQuestions } from "@/lib/survey-config";
import { toast } from "sonner";

export default function PreSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rid = searchParams.get("rid");

  if (!rid) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="mb-4 text-2xl font-bold">無効なリンクです</h1>
        <p className="text-muted-foreground">
          予約完了ページからアンケートにアクセスしてください。
        </p>
      </div>
    );
  }

  async function handleSubmit(answers: Record<string, string>) {
    const res = await fetch("/api/surveys/pre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservation_id: rid,
        seminar_id: id,
        answers,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "送信に失敗しました");
    }

    toast.success("事前アンケートを送信しました");
    router.push(`/seminars/${id}/confirmation?rid=${rid}`);
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>事前アンケート</CardTitle>
          <p className="text-sm text-muted-foreground">
            セミナーの準備のため、以下のアンケートにご回答ください。
          </p>
        </CardHeader>
        <CardContent>
          <SurveyForm
            questions={preSurveyQuestions}
            onSubmit={handleSubmit}
            submitLabel="アンケートを送信する"
          />
        </CardContent>
      </Card>
    </div>
  );
}
