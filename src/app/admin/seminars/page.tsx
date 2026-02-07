"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import type { Seminar } from "@/lib/types";

const statusLabels: Record<string, string> = {
  draft: "下書き",
  published: "公開中",
  cancelled: "キャンセル",
  completed: "完了",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  published: "default",
  cancelled: "destructive",
  completed: "secondary",
};

export default function AdminSeminarsPage() {
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadSeminars() {
    try {
      const res = await fetch("/api/seminars");
      const data = await res.json();
      if (Array.isArray(data)) setSeminars(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSeminars();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("このセミナーをキャンセルしますか？")) return;
    try {
      const res = await fetch(`/api/seminars/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("セミナーをキャンセルしました");
      loadSeminars();
    } catch {
      toast.error("キャンセルに失敗しました");
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">読み込み中...</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            セミナー管理
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            セミナーの作成・編集・公開を行います。
          </p>
        </div>
        <Link href="/admin/seminars/new">
          <Button>新規作成</Button>
        </Link>
      </header>

      <Table className="rounded-lg border border-border">
        <TableHeader>
          <TableRow>
            <TableHead>タイトル</TableHead>
            <TableHead>開催日</TableHead>
            <TableHead>定員</TableHead>
            <TableHead>予約数</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {seminars.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.title}</TableCell>
              <TableCell>
                {new Date(s.date).toLocaleDateString("ja-JP", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
              <TableCell>{s.capacity}</TableCell>
              <TableCell>{s.current_bookings}</TableCell>
              <TableCell>
                <Badge variant={statusVariants[s.status] || "outline"}>
                  {statusLabels[s.status] || s.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Link href={`/admin/seminars/${s.id}/edit`}>
                    <Button variant="outline" size="sm">
                      編集
                    </Button>
                  </Link>
                  {s.spreadsheet_id && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${s.spreadsheet_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        スプシ
                      </Button>
                    </a>
                  )}
                  {s.id && s.status !== "cancelled" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(s.id)}
                    >
                      キャンセル
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
