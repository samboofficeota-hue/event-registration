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

  useEffect(() => {
    fetch(`/api/seminars/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setSeminar(data);
        setStatus(data.status || "draft");
      });
  }, [id]);

  if (!seminar) {
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title"),
      description: formData.get("description"),
      date: formData.get("date"),
      duration_minutes: Number(formData.get("duration_minutes")),
      capacity: Number(formData.get("capacity")),
      speaker: formData.get("speaker"),
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

  // Format datetime-local value
  const dateValue = seminar.date
    ? new Date(seminar.date).toISOString().slice(0, 16)
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">開催日時 *</Label>
                <Input
                  id="date"
                  name="date"
                  type="datetime-local"
                  defaultValue={dateValue}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration_minutes">所要時間（分） *</Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  min="15"
                  defaultValue={seminar.duration_minutes}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="capacity">定員 *</Label>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="1"
                  defaultValue={seminar.capacity}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="speaker">登壇者</Label>
                <Input
                  id="speaker"
                  name="speaker"
                  defaultValue={seminar.speaker}
                />
              </div>
            </div>

            {seminar.meet_url && (
              <div className="rounded bg-gray-50 p-3">
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

            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "更新中..." : "更新する"}
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
