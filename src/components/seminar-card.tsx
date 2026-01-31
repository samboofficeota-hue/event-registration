"use client";

import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Seminar } from "@/lib/types";

interface SeminarCardProps {
  seminar: Seminar;
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

export function SeminarCard({ seminar }: SeminarCardProps) {
  const isFull = seminar.current_bookings >= seminar.capacity;
  const isPast = new Date(seminar.date) < new Date();
  const remaining = seminar.capacity - seminar.current_bookings;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg">{seminar.title}</CardTitle>
          {isFull && <Badge variant="destructive">満席</Badge>}
          {isPast && <Badge variant="secondary">終了</Badge>}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="mb-3 text-sm text-muted-foreground line-clamp-2">
          {seminar.description}
        </p>
        <div className="space-y-1 text-sm">
          <p>
            <span className="font-medium">日時:</span> {formatDate(seminar.date)}
          </p>
          <p>
            <span className="font-medium">時間:</span> {seminar.duration_minutes}分
          </p>
          <p>
            <span className="font-medium">登壇者:</span>{" "}
            {seminar.speaker}
            {seminar.speaker_title ? `（${seminar.speaker_title}）` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {seminar.format && seminar.format !== "online" && (
              <Badge variant="outline">
                {seminar.format === "venue" ? "会場" : seminar.format === "hybrid" ? "ハイブリッド" : "オンライン"}
              </Badge>
            )}
            {seminar.target === "members_only" && (
              <Badge variant="secondary">会員限定</Badge>
            )}
          </div>
          <p>
            <span className="font-medium">残席:</span>{" "}
            {isFull ? "なし" : `${remaining}/${seminar.capacity}`}
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Link href={`/seminars/${seminar.id}`} className="w-full">
          <Button className="w-full" disabled={isFull || isPast}>
            {isFull ? "満席" : isPast ? "終了" : "詳細・予約"}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
