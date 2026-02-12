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
import { ImagePlus } from "lucide-react";

const TENANT = "whgc-seminars";
const ADMIN_BASE = "/whgc-seminars/admin";

/** Google Drive ファイルURLを直接画像URLに変換 */
function resolveImageUrl(url: string | undefined): string {
  if (!url) return "/9553.png";

  if (url.includes("uc?export=view") || url.includes("uc?export=download")) {
    return url.replace("uc?export=download", "uc?export=view");
  }

  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) {
    const fileId = match[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }

  return "/9553.png";
}

export default function WhgcSeminarsEditSeminarPage({
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
  const [invitationCode, setInvitationCode] = useState("");

  useEffect(() => {
    fetch(`/api/seminars/${id}?tenant=${TENANT}`)
      .then((res) => res.json())
      .then((data) => {
        setSeminar(data);
        setStatus(data.status || "draft");
        setFormat(data.format || "online");
        setTarget(data.target || "public");
        setInvitationCode(data.invitation_code || "");
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
      end_time: formData.get("end_time") || "",
      capacity: Number(formData.get("capacity")),
      speaker: formData.get("speaker"),
      speaker_title: formData.get("speaker_title") || "",
      speaker_reference_url: formData.get("speaker_reference_url") || "",
      format,
      target,
      status,
      invitation_code: invitationCode.trim() || "",
      tenant: TENANT,
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
      router.push(`${ADMIN_BASE}/seminars`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新に失敗しました");
    } finally {
      setLoading(false);
    }
  }

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

      <Card className="admin-card">
        <CardHeader>
          <CardTitle className="text-foreground">セミナー情報</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">タイトル *（改行で2行まで反映）</Label>
              <Textarea
                id="title"
                name="title"
                rows={2}
                defaultValue={seminar.title}
                placeholder="1〜2行で入力。改行はそのまま表示に反映されます。"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">説明（改行はそのまま表示に反映）</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={seminar.description}
                rows={6}
                placeholder="改行はそのまま表示に反映されます。&lt;br&gt; でも改行できます。"
              />
            </div>

            {/* 画像セクション */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">セミナー画像</Label>
              {seminar.image_url ? (
                <div className="rounded-lg border border-border overflow-hidden bg-muted/30 max-w-md">
                  <img
                    src={resolveImageUrl(seminar.image_url)}
                    alt={seminar.title}
                    className="w-full h-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/9553.png";
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4 max-w-md">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <ImagePlus className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">画像が未登録です</p>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push(`${ADMIN_BASE}/seminars/${id}/image`)}
              >
                {seminar.image_url ? "画像を変更" : "画像を登録"}
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
                <Label htmlFor="end_time">終了時刻 *</Label>
                <Input
                  id="end_time"
                  name="end_time"
                  type="time"
                  defaultValue={seminar.end_time}
                  required
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
            <div className="space-y-2">
              <Label htmlFor="speaker_reference_url">講師参考URL</Label>
              <Input
                id="speaker_reference_url"
                name="speaker_reference_url"
                type="url"
                defaultValue={seminar.speaker_reference_url ?? ""}
                placeholder="https://..."
              />
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

            <div className="space-y-2">
              <Label htmlFor="invitation_code">招待コード</Label>
              <p className="text-xs text-muted-foreground">
                会員限定セミナーで、非会員が申し込む際に使用するコード（例: whgc2026）。空欄の場合は招待なし。
              </p>
              <Input
                id="invitation_code"
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
                placeholder="例: whgc2026"
                className="font-mono"
              />
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

            <div className="flex gap-3 flex-wrap pt-2">
              <Button type="submit" size="lg" disabled={loading} className="px-8">
                {loading ? "更新中..." : "更新する"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => router.push(`${ADMIN_BASE}/seminars`)}
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
