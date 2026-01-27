import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rid?: string }>;
}) {
  const { id } = await params;
  const { rid } = await searchParams;
  const seminar = await getSeminar(id);

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-green-600">
            予約が完了しました
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {seminar && (
            <div className="rounded-lg bg-gray-50 p-4 space-y-2">
              <h3 className="font-medium">{seminar.title}</h3>
              <p className="text-sm text-muted-foreground">
                {formatDate(seminar.date)}
              </p>
              <p className="text-sm text-muted-foreground">
                所要時間: {seminar.duration_minutes}分
              </p>
              {seminar.meet_url && (
                <div className="mt-3 rounded border bg-white p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Google Meet リンク
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

          <p className="text-sm text-muted-foreground text-center">
            セミナー当日までに、事前アンケートにご回答ください。
          </p>

          {rid && (
            <Link href={`/seminars/${id}/pre-survey?rid=${rid}`} className="block">
              <Button className="w-full" variant="outline">
                事前アンケートに回答する
              </Button>
            </Link>
          )}

          <Link href="/seminars" className="block">
            <Button className="w-full" variant="secondary">
              セミナー一覧に戻る
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
