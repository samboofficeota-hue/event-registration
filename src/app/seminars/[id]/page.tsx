import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSeminarById } from "@/lib/seminars";

export const dynamic = "force-dynamic";

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
  const seminar = await getSeminarById(id);

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

      <Card className="overflow-hidden">
        <div className="h-56 overflow-hidden bg-gray-100">
          <img
            src={
              seminar.image_url
                ? seminar.image_url.replace(
                    /\/file\/d\/([^/]+)\/view/,
                    "/file/d/$1/export?format=png"
                  )
                : "/9553.png"
            }
            alt={seminar.title}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/9553.png";
            }}
          />
        </div>
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
            <div className="flex justify-between">
              <span className="font-medium">定員</span>
              <span>{seminar.capacity}名</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">残席</span>
              <span>{isFull ? "なし" : `${remaining}名`}</span>
            </div>
          </div>

          {seminar.meet_url && (seminar.format === "online" || seminar.format === "hybrid") && (
            <div className="rounded-lg border bg-blue-50 p-4">
              <p className="mb-2 text-sm font-medium text-blue-800">参加方法</p>
              <p className="mb-1 text-xs text-blue-600">
                {seminar.format === "online"
                  ? "オンライン開催です。以下のリンクから参加できます。"
                  : "ハイブリッド開催です。オンライン参加の場合は以下のリンクを使用してください。"}
              </p>
              <a
                href={seminar.meet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-700 hover:underline break-all"
              >
                {seminar.meet_url}
              </a>
            </div>
          )}

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
