"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import type { Seminar } from "@/lib/types";

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
      <h1 className="mb-6 text-2xl font-bold">セミナー編集</h1>

      <Card>
        <CardHeader>
          <CardTitle>セミナー情報</CardTitle>
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
                  <div className="mt-2 rounded border overflow-hidden bg-white max-w-md">
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
              <div className="rounded bg-gray-50 p-3 space-y-3">
                {seminar.calendar_event_id && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Calendar Event ID
                    </p>
                    <p className="text-sm font-mono text-gray-700 break-all">
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
                      className="text-sm text-blue-600 hover:underline break-all"
                    >
                      {seminar.meet_url}
                    </a>
                  </div>
                )}
              </div>
            )}

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
