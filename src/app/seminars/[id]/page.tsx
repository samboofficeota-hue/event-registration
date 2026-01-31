import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Seminar } from "@/lib/types";

async function getSeminar(id: string): Promise<Seminar | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/seminars/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SeminarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const seminar = await getSeminar(id);

  if (!seminar) {
    notFound();
  }

  const isFull = seminar.current_bookings >= seminar.capacity;
  const isPast = new Date(seminar.date) < new Date();
  const remaining = seminar.capacity - seminar.current_bookings;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/seminars"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← セミナー一覧に戻る
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-2xl">{seminar.title}</CardTitle>
            <div className="flex gap-2">
              {isFull && <Badge variant="destructive">満席</Badge>}
              {isPast && <Badge variant="secondary">終了</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{seminar.description}</p>

          <div className="space-y-2 rounded-lg bg-gray-50 p-4">
            <div className="flex justify-between">
              <span className="font-medium">開催日時</span>
              <span>{formatDate(seminar.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">所要時間</span>
              <span>{seminar.duration_minutes}分</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">登壇者</span>
              <span>
                {seminar.speaker}
                {seminar.speaker_title ? `（${seminar.speaker_title}）` : ""}
              </span>
            </div>
            {seminar.format && (
              <div className="flex justify-between">
                <span className="font-medium">開催形式</span>
                <span>
                  {seminar.format === "venue"
                    ? "会場"
                    : seminar.format === "hybrid"
                      ? "ハイブリッド"
                      : "オンライン"}
                </span>
              </div>
            )}
            {seminar.target && (
              <div className="flex justify-between">
                <span className="font-medium">対象</span>
                <span>{seminar.target === "members_only" ? "会員限定" : "一般公開"}</span>
              </div>
            )}
            {seminar.calendar_link && (
              <div className="flex justify-between items-center">
                <span className="font-medium">Google カレンダー</span>
                <a
                  href={seminar.calendar_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm break-all"
                >
                  カレンダーに追加
                </a>
              </div>
            )}
            <div className="flex justify-between">
              <span className="font-medium">定員</span>
              <span>{seminar.capacity}名</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">残席</span>
              <span>{isFull ? "なし" : `${remaining}名`}</span>
            </div>
          </div>

          {!isFull && !isPast && (
            <Link href={`/seminars/${seminar.id}/booking`}>
              <Button className="w-full" size="lg">
                予約する
              </Button>
            </Link>
          )}

          {isFull && (
            <p className="text-center text-sm text-muted-foreground">
              このセミナーは満席です。
            </p>
          )}

          {isPast && (
            <p className="text-center text-sm text-muted-foreground">
              このセミナーは終了しました。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
