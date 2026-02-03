"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { Seminar } from "@/lib/types";
import { ClipboardList, FileQuestion, Copy, Link2 } from "lucide-react";

/** アンケートURL1行（表示＋コピー） */
function SurveyUrlRow({ label, path }: { label: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const fullUrl =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  const handleCopy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2 rounded-md bg-background px-3 py-2 border border-border">
      <span className="text-sm text-muted-foreground shrink-0 w-24">{label}</span>
      <code className="text-xs text-foreground truncate flex-1 min-w-0" title={fullUrl}>
        {fullUrl}
      </code>
      <Button type="button" variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={handleCopy}>
        <Copy className="h-4 w-4" />
        <span className="sr-only">コピー</span>
      </Button>
      {copied && <span className="text-xs text-green-600 shrink-0">コピーしました</span>}
    </div>
  );
}

/** Google Drive ファイルURLを直接画像URLに変換 */
function resolveImageUrl(url: string | undefined): string {
  if (!url) return "/9553.png";

  // 既に uc?export=view 形式なら そのまま返す
  if (url.includes("uc?export=view") || url.includes("uc?export=download")) {
    // download形式の場合はview形式に変換（より安定）
    return url.replace("uc?export=download", "uc?export=view");
  }

  // /file/d/{id}/view 形式から変換
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) {
    const fileId = match[1];
    // サムネイル画像URLを使用（より軽量で高速）
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }

  // マッチしない場合は汎用画像
  return "/9553.png";
}

export default function EditSeminarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [seminar, setSeminar] = useState<Seminar | null>(null);
  const [status, setStatus] = useState("draft");
  const [format, setFormat] = useState<"venue" | "online" | "hybrid">("online");
  const [target, setTarget] = useState<"members_only" | "public">("public");
  const [surveyPre, setSurveyPre] = useState<{ status: "loading" | "set" | "empty" | "none" | "error"; count?: number }>({ status: "loading" });
  const [surveyPost, setSurveyPost] = useState<{ status: "loading" | "set" | "empty" | "none" | "error"; count?: number }>({ status: "loading" });

  useEffect(() => {
    fetch(`/api/seminars/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setSeminar(data);
        setStatus(data.status || "draft");
        setFormat(data.format || "online");
        setTarget(data.target || "public");
      });
  }, [id]);

  useEffect(() => {
    if (!seminar?.id || !seminar.spreadsheet_id) {
      setSurveyPre({ status: "none" });
      setSurveyPost({ status: "none" });
      return;
    }
    setSurveyPre({ status: "loading" });
    setSurveyPost({ status: "loading" });
    Promise.all([
      fetch(`/api/seminars/${seminar.id}/survey-questions?type=pre`).then((r) => r.json()),
      fetch(`/api/seminars/${seminar.id}/survey-questions?type=post`).then((r) => r.json()),
    ])
      .then(([preRes, postRes]) => {
        const preList = preRes?.questions && Array.isArray(preRes.questions) ? preRes.questions : [];
        const postList = postRes?.questions && Array.isArray(postRes.questions) ? postRes.questions : [];
        setSurveyPre(preList.length > 0 ? { status: "set", count: preList.length } : { status: "empty" });
        setSurveyPost(postList.length > 0 ? { status: "set", count: postList.length } : { status: "empty" });
      })
      .catch(() => {
        setSurveyPre({ status: "error" });
        setSurveyPost({ status: "error" });
      });
  }, [seminar?.id, seminar?.spreadsheet_id]);

  if (!seminar) {
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const dateDate = formData.get("date_date") as string;
    const dateTime = formData.get("date_time") as string;
    const date = dateDate && dateTime ? `${dateDate}T${dateTime}:00` : "";
    const data = {
      title: formData.get("title"),
      description: formData.get("description"),
      date,
      duration_minutes: Number(formData.get("duration_minutes")),
      capacity: Number(formData.get("capacity")),
      speaker: formData.get("speaker"),
      speaker_title: formData.get("speaker_title") || "",
      format,
      target,
      status,
    };

    try {
      const res = await fetch(`/api/seminars/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "更新に失敗しました");
      }

      toast.success("セミナーを更新しました");
      router.push("/admin/seminars");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  // 開催日・時刻をローカル時刻で分割（編集用の初期値）
  const d = seminar.date ? new Date(seminar.date) : null;
  const dateDateValue = d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    : "";
  const dateTimeValue = d
    ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    : "";

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-foreground">セミナー編集</h1>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">セミナー情報</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">タイトル *</Label>
              <Input
                id="title"
                name="title"
                defaultValue={seminar.title}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">説明</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={seminar.description}
                rows={4}
              />

              {/* 画像サムネイル表示 */}
              {seminar.image_url && (
                <div className="mt-4">
                  <Label className="text-sm text-muted-foreground">登録済み画像</Label>
                  <div className="mt-2 rounded-lg border border-border overflow-hidden bg-card max-w-md">
                    <img
                      src={resolveImageUrl(seminar.image_url)}
                      alt={seminar.title}
                      className="w-full h-auto object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/9553.png";
                      }}
                    />
                  </div>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/seminars/${id}/image`)}
              >
                {seminar.image_url ? "画像を変更" : "画像登録"}
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date_date">開催日 *</Label>
                <Input
                  id="date_date"
                  name="date_date"
                  type="date"
                  defaultValue={dateDateValue}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_time">開催時刻 *</Label>
                <Input
                  id="date_time"
                  name="date_time"
                  type="time"
                  defaultValue={dateTimeValue}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="duration_minutes">所要時間（分）</Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  min="15"
                  defaultValue={seminar.duration_minutes}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">定員</Label>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="1"
                  defaultValue={seminar.capacity}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="speaker">登壇者 *</Label>
                <Input
                  id="speaker"
                  name="speaker"
                  defaultValue={seminar.speaker}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="speaker_title">肩書き</Label>
                <Input
                  id="speaker_title"
                  name="speaker_title"
                  defaultValue={seminar.speaker_title}
                  placeholder="例：株式会社〇〇 代表取締役"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="format">開催形式</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as "venue" | "online" | "hybrid")}>
                  <SelectTrigger id="format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="venue">会場</SelectItem>
                    <SelectItem value="online">オンライン</SelectItem>
                    <SelectItem value="hybrid">ハイブリッド</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="target">対象</Label>
                <Select value={target} onValueChange={(v) => setTarget(v as "members_only" | "public")}>
                  <SelectTrigger id="target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="members_only">会員限定</SelectItem>
                    <SelectItem value="public">一般公開</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(seminar.meet_url || seminar.calendar_event_id) && (
              <div className="rounded-lg bg-muted p-3 space-y-3 border border-border">
                {seminar.calendar_event_id && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Calendar Event ID
                    </p>
                    <p className="text-sm font-mono text-foreground break-all">
                      {seminar.calendar_event_id}
                    </p>
                  </div>
                )}
                {seminar.meet_url && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Google Meet URL
                    </p>
                    <a
                      href={seminar.meet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline break-all"
                    >
                      {seminar.meet_url}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* アンケート設定ステータス */}
            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  アンケート設定
                </span>
                <Link href={`/admin/survey-questions?seminarId=${id}`}>
                  <Button type="button" variant="outline" size="sm">
                    設問を編集
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 rounded-md bg-background/80 px-3 py-2 border border-border">
                  <FileQuestion className="h-4 w-4 text-sky-500 shrink-0" />
                  <span className="text-muted-foreground">事前アンケート</span>
                  <span className="ml-auto">
                    {surveyPre.status === "loading" && (
                      <span className="text-muted-foreground">確認中...</span>
                    )}
                    {surveyPre.status === "none" && (
                      <Badge variant="secondary">シートなし</Badge>
                    )}
                    {surveyPre.status === "set" && (
                      <Badge className="bg-sky-500/90 text-white">設定済み ({surveyPre.count}問)</Badge>
                    )}
                    {surveyPre.status === "empty" && (
                      <Badge variant="outline">未設定</Badge>
                    )}
                    {surveyPre.status === "error" && (
                      <Badge variant="destructive">取得失敗</Badge>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-background/80 px-3 py-2 border border-border">
                  <FileQuestion className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-muted-foreground">事後アンケート</span>
                  <span className="ml-auto">
                    {surveyPost.status === "loading" && (
                      <span className="text-muted-foreground">確認中...</span>
                    )}
                    {surveyPost.status === "none" && (
                      <Badge variant="secondary">シートなし</Badge>
                    )}
                    {surveyPost.status === "set" && (
                      <Badge className="bg-amber-500/90 text-white">設定済み ({surveyPost.count}問)</Badge>
                    )}
                    {surveyPost.status === "empty" && (
                      <Badge variant="outline">未設定</Badge>
                    )}
                    {surveyPost.status === "error" && (
                      <Badge variant="destructive">取得失敗</Badge>
                    )}
                  </span>
                </div>
              </div>

              {/* 参加者用アンケートURL（管理者がメール等で参加者に送る用） */}
              <div className="mt-4 pt-4 border-t border-border space-y-3">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Link2 className="h-3.5 w-3.5" />
                  参加者用アンケートURL（予約IDを置き換えて参加者に送信）
                </p>
                <SurveyUrlRow
                  label="事前アンケート"
                  path={`/seminars/${id}/pre-survey?rid=【予約ID】`}
                />
                <SurveyUrlRow
                  label="事後アンケート"
                  path={`/seminars/${id}/post-survey?rid=【予約ID】`}
                />
                <p className="text-xs text-muted-foreground">
                  予約IDは「予約一覧」で各予約のIDを確認し、上記の【予約ID】部分を置き換えてください。
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>ステータス</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">下書き</SelectItem>
                  <SelectItem value="published">公開</SelectItem>
                  <SelectItem value="completed">完了</SelectItem>
                  <SelectItem value="cancelled">キャンセル</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button type="submit" disabled={loading}>
                {loading ? "更新中..." : "更新する"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/seminars")}
              >
                一覧に戻る
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
