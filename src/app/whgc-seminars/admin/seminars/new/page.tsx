"use client";

import { useState } from "react";
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
import { ImagePlus } from "lucide-react";

const TENANT = "whgc-seminars";
const ADMIN_BASE = "/whgc-seminars/admin";

export default function WhgcSeminarsNewSeminarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("draft");
  const [format, setFormat] = useState<"venue" | "online" | "hybrid">("online");
  const [target, setTarget] = useState<"members_only" | "public">("public");
  const [invitationCode, setInvitationCode] = useState("");

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
      capacity: Number(formData.get("capacity")) || 100,
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
      const res = await fetch("/api/seminars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "作成に失敗しました");
      }

      const created = await res.json();
      toast.success("セミナーを作成しました。続けて画像を登録できます。");
      router.push(`${ADMIN_BASE}/seminars/${created.id}/image`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "作成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-foreground">セミナー新規作成</h1>

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
                placeholder="1〜2行で入力。改行はそのまま表示に反映されます。"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">説明（改行はそのまま表示に反映）</Label>
              <Textarea
                id="description"
                name="description"
                rows={6}
                placeholder="改行はそのまま表示に反映されます。&lt;br&gt; でも改行できます。"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date_date">開催日 *</Label>
                <Input
                  id="date_date"
                  name="date_date"
                  type="date"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_time">開催時刻 *</Label>
                <Input
                  id="date_time"
                  name="date_time"
                  type="time"
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
                  defaultValue="100"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="speaker">登壇者 *</Label>
                <Input id="speaker" name="speaker" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="speaker_title">肩書き</Label>
                <Input id="speaker_title" name="speaker_title" placeholder="例：株式会社〇〇 代表取締役" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="speaker_reference_url">講師参考URL</Label>
              <Input
                id="speaker_reference_url"
                name="speaker_reference_url"
                type="url"
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

            {/* 画像登録案内 */}
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">セミナー画像</p>
                  <p className="text-xs text-muted-foreground">
                    セミナー作成後、画像登録ページへ移動します。
                  </p>
                </div>
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
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" size="lg" disabled={loading} className="px-8">
                {loading ? "作成中..." : "作成する"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => router.back()}
              >
                キャンセル
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
