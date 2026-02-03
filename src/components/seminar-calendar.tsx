"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Seminar } from "@/lib/types";
import { format, isSameDay, getDaysInMonth, getDay } from "date-fns";
import { ja } from "date-fns/locale";

interface SeminarCalendarProps {
  seminars: Seminar[];
  /** セミナークリック時に呼ばれるコールバック（指定時はモーダル表示、未指定時は従来のページ遷移） */
  onSelectSeminar?: (seminar: Seminar) => void;
}

/** 開催形式の色バー */
const formatColors: Record<string, string> = {
  online: "bg-cyan-500",
  venue: "bg-purple-600",
  hybrid: "bg-pink-500",
};

export function SeminarCalendar({ seminars, onSelectSeminar }: SeminarCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(currentMonth);
  // 1日目の曜日（0=日曜）
  const firstDayOfWeek = getDay(new Date(year, month, 1));

  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

  /** 指定日にセミナーがあるか */
  const getSeminarsOnDate = (day: number) => {
    const target = new Date(year, month, day);
    return seminars.filter((s) => isSameDay(new Date(s.date), target));
  };

  /** 前月へ */
  const prevMonth = () =>
    setCurrentMonth(new Date(year, month - 1, 1));
  /** 次月へ */
  const nextMonth = () =>
    setCurrentMonth(new Date(year, month + 1, 1));

  /** 選択日のセミナー */
  const seminarsOnSelected = selectedDate
    ? seminars.filter((s) => isSameDay(new Date(s.date), selectedDate))
    : [];

  const today = new Date();

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* カレンダー */}
      <Card className="border border-border bg-card rounded-xl">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            カレンダー
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 年月ナビ */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-base font-semibold text-foreground">
              {format(currentMonth, "yyyy年M月", { locale: ja })}
            </span>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 mb-2">
            {weekdays.map((d) => (
              <div
                key={d}
                className="text-center text-xs text-muted-foreground py-1 font-medium"
              >
                {d}
              </div>
            ))}
          </div>

          {/* 日付グリッド */}
          <div className="grid grid-cols-7 gap-y-1">
            {/* 空白スペース（1日目の前） */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* 各日付 */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const date = new Date(year, month, day);
              const hasSeminar = getSeminarsOnDate(day).length > 0;
              const isToday = isSameDay(date, today);
              const isSelected = selectedDate && isSameDay(date, selectedDate);

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(date)}
                  className={[
                    "relative aspect-square flex flex-col items-center justify-center text-sm rounded-full transition-all",
                    isSelected
                      ? "bg-primary text-white font-bold"
                      : isToday
                        ? "border-2 border-primary text-primary font-semibold"
                        : "text-foreground hover:bg-muted",
                    hasSeminar && !isSelected ? "font-semibold" : "",
                  ].join(" ")}
                >
                  {day}
                  {/* セミナードット */}
                  {hasSeminar && (
                    <span
                      className={[
                        "absolute bottom-0.5 w-1.5 h-1.5 rounded-full",
                        isSelected ? "bg-white" : "bg-primary",
                      ].join(" ")}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* 例 */}
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span>セミナー開催日</span>
          </div>
        </CardContent>
      </Card>

      {/* 選択日のセミナー一覧 */}
      <Card className="border border-border bg-card rounded-xl">
        <CardHeader>
          <CardTitle className="text-xl font-bold">
            {selectedDate
              ? format(selectedDate, "M月d日 (E)", { locale: ja })
              : "日付を選択してください"}
            のセミナー
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            {seminarsOnSelected.length > 0 ? (
              <motion.div
                key={selectedDate?.toISOString()}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {seminarsOnSelected.map((seminar) => {
                  const content = (
                    <motion.div
                      className="p-4 rounded-xl border border-border hover:border-primary hover:shadow-lg transition-all bg-card cursor-pointer"
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="flex gap-4">
                        {/* 開催形式カラーバー */}
                        <div
                          className={`w-1 rounded-full ${formatColors[seminar.format] || "bg-primary"}`}
                        />
                        <div className="flex-1">
                          <Badge variant="secondary" className="mb-2 text-xs">
                            {seminar.format === "online"
                              ? "オンライン"
                              : seminar.format === "venue"
                                ? "会場"
                                : "ハイブリッド"}
                          </Badge>
                          <h4 className="font-semibold text-foreground mb-2">
                            {seminar.title}
                          </h4>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(seminar.date), "HH:mm", {
                                locale: ja,
                              })}
                              ~
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {seminar.speaker}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                  return onSelectSeminar ? (
                    <button
                      key={seminar.id}
                      type="button"
                      onClick={() => onSelectSeminar(seminar)}
                      className="w-full text-left"
                    >
                      {content}
                    </button>
                  ) : (
                    <Link
                      key={seminar.id}
                      href={`/seminars/${seminar.id}`}
                      prefetch={false}
                    >
                      {content}
                    </Link>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 text-muted-foreground"
              >
                <div className="text-4xl mb-4">📅</div>
                <p>
                  {selectedDate
                    ? "この日のセミナーはありません"
                    : "左のカレンダーから日付を選択してください"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
