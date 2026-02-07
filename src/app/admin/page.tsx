"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Seminar } from "@/lib/types";

const today = new Date();
today.setHours(0, 0, 0, 0);

function isPast(seminar: Seminar) {
  const d = new Date(seminar.date);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export default function AdminExecutionListPage() {
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/seminars")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSeminars(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const executed = seminars.filter(isPast);
  const totalParticipants = executed.reduce(
    (sum, s) => sum + s.current_bookings,
    0
  );

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">読み込み中...</p>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          実施一覧
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          実施済みのセミナーと、開催時の登録者数などの統計です。アンケート評価結果は今後表示予定です。
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              実施済みセミナー数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {executed.length}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              実施済みの総登録者数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {totalParticipants}名
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">
          実施済みセミナー
        </h2>
        {executed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            実施済みのセミナーはありません。
          </p>
        ) : (
          <div className="space-y-4">
            {executed.map((s) => (
              <Card key={s.id} className="shadow-sm">
                <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{s.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(s.date).toLocaleDateString("ja-JP", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        weekday: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      登録者 {s.current_bookings}/{s.capacity}名
                    </Badge>
                    <Badge variant="outline">{s.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      （アンケート評価結果は今後開発予定）
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
