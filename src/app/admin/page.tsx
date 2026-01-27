"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Seminar } from "@/lib/types";

export default function AdminDashboard() {
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

  const published = seminars.filter((s) => s.status === "published");
  const upcoming = published.filter((s) => new Date(s.date) > new Date());
  const totalBookings = seminars.reduce((sum, s) => sum + s.current_bookings, 0);

  if (loading) {
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">ダッシュボード</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              セミナー総数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{seminars.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              今後のセミナー
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{upcoming.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              総予約数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalBookings}</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-4 text-lg font-semibold">直近のセミナー</h2>
      {upcoming.length === 0 ? (
        <p className="text-muted-foreground">今後のセミナーはありません。</p>
      ) : (
        <div className="space-y-3">
          {upcoming.slice(0, 5).map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(s.date).toLocaleDateString("ja-JP", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">
                    {s.current_bookings}/{s.capacity}名
                  </Badge>
                  <Badge>{s.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
