"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SurveyForm } from "@/components/survey-form";
import { postSurveyQuestions } from "@/lib/survey-config";
import { toast } from "sonner";

export default function PostSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const rid = searchParams.get("rid");
  const [submitted, setSubmitted] = useState(false);

  if (!rid) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="mb-4 text-2xl font-bold">無効なリンクです</h1>
        <p className="text-muted-foreground">
          正しいリンクからアンケートにアクセスしてください。
        </p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <Card>
          <CardContent className="py-8">
            <h2 className="mb-2 text-xl font-bold text-green-600">
              ご回答ありがとうございました
            </h2>
            <p className="text-muted-foreground">
              アンケートの回答を受け付けました。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleSubmit(answers: Record<string, string>) {
    const res = await fetch("/api/surveys/post", {
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

    toast.success("事後アンケートを送信しました");
    setSubmitted(true);
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>事後アンケート</CardTitle>
          <p className="text-sm text-muted-foreground">
            セミナーにご参加いただきありがとうございました。ぜひご感想をお聞かせください。
          </p>
        </CardHeader>
        <CardContent>
          <SurveyForm
            questions={postSurveyQuestions}
            onSubmit={handleSubmit}
            submitLabel="アンケートを送信する"
          />
        </CardContent>
      </Card>
    </div>
  );
}
