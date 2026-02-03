"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import type { Seminar } from "@/lib/types";

export default function ConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rid = searchParams.get("rid") ?? searchParams.get("booking_id");
  const [seminar, setSeminar] = useState<Seminar | null>(null);

  useEffect(() => {
    if (!rid) {
      router.push("/");
      return;
    }

    fetch(`/api/seminars/${id}`)
      .then((res) => res.json())
      .then((data) => setSeminar(data))
      .catch(() => router.push("/"));
  }, [id, rid, router]);

  if (!seminar) {
    return (
      <div className="container mx-auto px-4 py-20">
        <p className="text-center text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  const date = new Date(seminar.date);

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      {/* 成功アイコン */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold mb-2">予約が完了しました</h1>
        <p className="text-muted-foreground">
          ご登録いただいたメールアドレスに確認メールを送信しました。
        </p>
      </div>

      {/* 予約情報カード */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>予約情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 予約ID */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">予約ID</p>
            <p className="font-mono text-sm font-medium">{rid}</p>
          </div>

          {/* セミナー情報 */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">セミナー名</p>
            <p className="font-medium text-lg">{seminar.title}</p>
          </div>

          {/* 開催日時 */}
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">開催日時</p>
              <p className="font-medium">
                {format(date, "yyyy年M月d日 (E) HH:mm", { locale: ja })}
              </p>
            </div>
          </div>

          {/* 所要時間 */}
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-pink-500" />
            <div>
              <p className="text-xs text-muted-foreground">所要時間</p>
              <p className="font-medium">{seminar.duration_minutes}分</p>
            </div>
          </div>

          {/* Meet URL */}
          {seminar.meet_url && (seminar.format === "online" || seminar.format === "hybrid") && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-900 mb-2">
                オンライン参加URL
              </p>
              <a
                href={seminar.meet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-700 hover:underline break-all"
              >
                {seminar.meet_url}
              </a>
              <p className="text-xs text-blue-600 mt-2">
                ※ 開催日時になりましたら、上記URLからご参加ください
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 注意事項 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">ご確認ください</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• 確認メールが届かない場合は、迷惑メールフォルダをご確認ください。</p>
          <p>• 予約のキャンセルや変更は、確認メールに記載されているリンクから行えます。</p>
          <p>• セミナー開催日の前日に、リマインドメールをお送りします。</p>
          {seminar.format === "venue" && (
            <p>• 会場開催の詳細は、確認メールをご確認ください。</p>
          )}
        </CardContent>
      </Card>

      {/* ボタン */}
      <div className="flex gap-3">
        <Button
          size="lg"
          onClick={() => router.push("/")}
          className="flex-1"
        >
          セミナー一覧に戻る
        </Button>
      </div>
    </div>
  );
}
