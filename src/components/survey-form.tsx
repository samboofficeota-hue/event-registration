"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { SurveyQuestion } from "@/lib/survey-config";

interface SurveyFormProps {
  questions: SurveyQuestion[];
  onSubmit: (answers: Record<string, string>) => Promise<void>;
  submitLabel?: string;
}

function RatingInput({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const min = question.min || 1;
  const max = question.max || 5;
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="flex gap-2">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(String(v))}
          className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-medium transition-colors ${
            value === String(v)
              ? "border-primary bg-primary text-primary-foreground"
              : "border-gray-300 hover:border-primary hover:bg-primary/10"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function NPSInput({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const min = question.min || 0;
  const max = question.max || 10;
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(String(v))}
            className={`flex h-9 w-9 items-center justify-center rounded border text-sm font-medium transition-colors ${
              value === String(v)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-gray-300 hover:border-primary hover:bg-primary/10"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>全くおすすめしない</span>
        <span>強くおすすめする</span>
      </div>
    </div>
  );
}

export function SurveyForm({ questions, onSubmit, submitLabel = "送信する" }: SurveyFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function updateAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate required fields
    for (const q of questions) {
      if (q.required && !answers[q.id]) {
        toast.error(`「${q.label}」は必須項目です`);
        return;
      }
    }

    setLoading(true);
    try {
      await onSubmit(answers);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "送信に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <Label>
            {q.label}
            {q.required && <span className="ml-1 text-red-500">*</span>}
          </Label>

          {q.type === "text" && (
            <Textarea
              value={answers[q.id] || ""}
              onChange={(e) => updateAnswer(q.id, e.target.value)}
              placeholder={q.placeholder}
              required={q.required}
            />
          )}

          {q.type === "rating" && (
            <RatingInput
              question={q}
              value={answers[q.id] || ""}
              onChange={(v) => updateAnswer(q.id, v)}
            />
          )}

          {q.type === "nps" && (
            <NPSInput
              question={q}
              value={answers[q.id] || ""}
              onChange={(v) => updateAnswer(q.id, v)}
            />
          )}

          {q.type === "select" && q.options && (
            <Select
              value={answers[q.id] || ""}
              onValueChange={(v) => updateAnswer(q.id, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {q.options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ))}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "送信中..." : submitLabel}
      </Button>
    </form>
  );
}
