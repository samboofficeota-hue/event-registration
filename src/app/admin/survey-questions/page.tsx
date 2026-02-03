"use client";

import { useEffect, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { SurveyQuestion } from "@/lib/survey-config";
import type { Seminar } from "@/lib/types";
import { Trash2, Plus, SheetPlus } from "lucide-react";

const QUESTION_TYPES: { value: SurveyQuestion["type"]; label: string }[] = [
  { value: "rating", label: "評価（1〜5など）" },
  { value: "text", label: "自由記述" },
  { value: "select", label: "選択式" },
  { value: "nps", label: "NPS（0〜10）" },
];

const emptyQuestion = (): SurveyQuestion => ({
  id: "",
  label: "",
  type: "text",
  required: false,
  placeholder: "",
});

export default function AdminSurveyQuestionsPage() {
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [preQuestions, setPreQuestions] = useState<SurveyQuestion[]>([]);
  const [postQuestions, setPostQuestions] = useState<SurveyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPre, setSavingPre] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [ensuringSheets, setEnsuringSheets] = useState(false);

  useEffect(() => {
    fetch("/api/seminars")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSeminars(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const seminarsWithSheet = seminars.filter((s) => s.spreadsheet_id);

  useEffect(() => {
    if (!selectedId) {
      setPreQuestions([]);
      setPostQuestions([]);
      return;
    }
    setPreQuestions([]);
    setPostQuestions([]);
    Promise.all([
      fetch(`/api/seminars/${selectedId}/survey-questions?type=pre`).then(
        (r) => r.json()
      ),
      fetch(`/api/seminars/${selectedId}/survey-questions?type=post`).then(
        (r) => r.json()
      ),
    ])
      .then(([preRes, postRes]) => {
        if (preRes.questions) setPreQuestions(preRes.questions);
        if (postRes.questions) setPostQuestions(postRes.questions);
      })
      .catch(() => {
        toast.error("設問の読み込みに失敗しました");
      });
  }, [selectedId]);

  function updatePre(index: number, patch: Partial<SurveyQuestion>) {
    setPreQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q))
    );
  }

  function updatePost(index: number, patch: Partial<SurveyQuestion>) {
    setPostQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q))
    );
  }

  function addPre() {
    setPreQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function addPost() {
    setPostQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removePre(index: number) {
    setPreQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function removePost(index: number) {
    setPostQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  async function ensureSheets() {
    if (!selectedId) return;
    setEnsuringSheets(true);
    try {
      const res = await fetch(
        `/api/seminars/${selectedId}/ensure-survey-sheets`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "追加に失敗しました");
      if (data.addedPre || data.addedPost) {
        toast.success(data.message);
        Promise.all([
          fetch(`/api/seminars/${selectedId}/survey-questions?type=pre`).then(
            (r) => r.json()
          ),
          fetch(`/api/seminars/${selectedId}/survey-questions?type=post`).then(
            (r) => r.json()
          ),
        ]).then(([preRes, postRes]) => {
          if (preRes.questions) setPreQuestions(preRes.questions);
          if (postRes.questions) setPostQuestions(postRes.questions);
        });
      } else {
        toast.info(data.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "アンケートシートの追加に失敗しました");
    } finally {
      setEnsuringSheets(false);
    }
  }

  async function savePre() {
    if (!selectedId) return;
    setSavingPre(true);
    try {
      const res = await fetch(
        `/api/seminars/${selectedId}/survey-questions`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "pre", questions: preQuestions }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "保存に失敗しました");
      }
      toast.success("事前アンケート設問を保存しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSavingPre(false);
    }
  }

  async function savePost() {
    if (!selectedId) return;
    setSavingPost(true);
    try {
      const res = await fetch(
        `/api/seminars/${selectedId}/survey-questions`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "post", questions: postQuestions }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "保存に失敗しました");
      }
      toast.success("事後アンケート設問を保存しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSavingPost(false);
    }
  }

  if (loading) {
    return (
      <p className="text-muted-foreground">読み込み中...</p>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        アンケート作成
      </h1>

      <div className="mb-6 max-w-md">
        <Label className="mb-2 block">セミナーを選択</Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger>
            <SelectValue placeholder="セミナーを選んでください" />
          </SelectTrigger>
          <SelectContent>
            {seminarsWithSheet.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {seminars.length > 0 && seminarsWithSheet.length < seminars.length && (
          <p className="mt-1 text-sm text-muted-foreground">
            ※ スプレッドシートが作成されているセミナーのみ表示しています
          </p>
        )}
        {seminars.length > 0 && seminarsWithSheet.length === 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            スプレッドシートが紐づいたセミナーがありません。セミナー管理でセミナーを作成すると、ここでアンケート設問を編集できます。
          </p>
        )}
        {selectedId && (
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={ensureSheets}
              disabled={ensuringSheets}
            >
              <SheetPlus className="mr-2 h-4 w-4" />
              {ensuringSheets ? "追加中..." : "アンケートシートを追加"}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              既存のセミナー用スプレッドシートに「事前アンケート設問」「事後アンケート設問」シートがない場合に押してください。既にある場合は何もしません。
            </p>
          </div>
        )}
      </div>

      {!selectedId && (
        <p className="text-muted-foreground">
          セミナーを選択すると、事前・事後アンケートの設問を編集できます。
        </p>
      )}

      {selectedId && (
        <div className="space-y-8">
          <Card className="border border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">事前アンケート設問</CardTitle>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addPre}>
                  <Plus className="mr-1 h-4 w-4" />
                  設問を追加
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={savePre}
                  disabled={savingPre || preQuestions.length === 0}
                >
                  {savingPre ? "保存中..." : "保存する"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {preQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  設問がありません。「設問を追加」から追加してください。
                </p>
              ) : (
                preQuestions.map((q, index) => (
                  <QuestionEditor
                    key={`pre-${index}`}
                    question={q}
                    index={index}
                    onChange={(patch) => updatePre(index, patch)}
                    onRemove={() => removePre(index)}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border border-border bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">事後アンケート設問</CardTitle>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addPost}>
                  <Plus className="mr-1 h-4 w-4" />
                  設問を追加
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={savePost}
                  disabled={savingPost || postQuestions.length === 0}
                >
                  {savingPost ? "保存中..." : "保存する"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {postQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  設問がありません。「設問を追加」から追加してください。
                </p>
              ) : (
                postQuestions.map((q, index) => (
                  <QuestionEditor
                    key={`post-${index}`}
                    question={q}
                    index={index}
                    onChange={(patch) => updatePost(index, patch)}
                    onRemove={() => removePost(index)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
}: {
  question: SurveyQuestion;
  index: number;
  onChange: (patch: Partial<SurveyQuestion>) => void;
  onRemove: () => void;
}) {
  const optionsStr = (question.options || []).join(", ");

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          設問 {index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>設問ID</Label>
          <Input
            value={question.id}
            onChange={(e) => onChange({ id: e.target.value })}
            placeholder="例: q1_interest_level"
          />
        </div>
        <div className="space-y-1">
          <Label>タイプ</Label>
          <Select
            value={question.type}
            onValueChange={(v) => onChange({ type: v as SurveyQuestion["type"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>質問文（ラベル）</Label>
        <Input
          value={question.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="画面上に表示する質問文"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`required-${index}`}
          checked={question.required}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="h-4 w-4 rounded border-border"
        />
        <Label htmlFor={`required-${index}`} className="cursor-pointer">
          必須
        </Label>
      </div>
      {(question.type === "rating" || question.type === "nps") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>最小値</Label>
            <Input
              type="number"
              value={question.min ?? ""}
              onChange={(e) =>
                onChange({
                  min:
                    e.target.value === ""
                      ? undefined
                      : parseInt(e.target.value, 10),
                })
              }
              placeholder="1"
            />
          </div>
          <div className="space-y-1">
            <Label>最大値</Label>
            <Input
              type="number"
              value={question.max ?? ""}
              onChange={(e) =>
                onChange({
                  max:
                    e.target.value === ""
                      ? undefined
                      : parseInt(e.target.value, 10),
                })
              }
              placeholder={question.type === "nps" ? "10" : "5"}
            />
          </div>
        </div>
      )}
      {question.type === "select" && (
        <div className="space-y-1">
          <Label>選択肢（カンマ区切り）</Label>
          <Input
            value={optionsStr}
            onChange={(e) =>
              onChange({
                options: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="例: 初めて, 1年未満, 3年以上"
          />
        </div>
      )}
      {(question.type === "text" || question.type === "select") && (
        <div className="space-y-1">
          <Label>プレースホルダ（任意）</Label>
          <Input
            value={question.placeholder ?? ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            placeholder="例: 自由にご記入ください"
          />
        </div>
      )}
    </div>
  );
}
