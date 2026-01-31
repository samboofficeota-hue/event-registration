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

export default function NewSeminarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("draft");
  const [format, setFormat] = useState<"venue" | "online" | "hybrid">("online");
  const [target, setTarget] = useState<"members_only" | "public">("public");

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
      duration_minutes: Number(formData.get("duration_minutes")) || 60,
      capacity: Number(formData.get("capacity")) || 100,
      speaker: formData.get("speaker"),
      speaker_title: formData.get("speaker_title") || "",
      format,
      target,
      status,
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

      toast.success("セミナーを作成しました");
      router.push("/admin/seminars");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "作成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">セミナー新規作成</h1>

      <Card>
        <CardHeader>
          <CardTitle>セミナー情報</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">タイトル *</Label>
              <Input id="title" name="title" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">説明</Label>
              <Textarea id="description" name="description" rows={4} />
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
                <Label htmlFor="duration_minutes">所要時間（分）</Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  min="15"
                  defaultValue="60"
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

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "作成中..." : "作成する"}
              </Button>
              <Button
                type="button"
                variant="outline"
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
