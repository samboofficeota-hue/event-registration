"use client";

import { motion } from "framer-motion";
import { Clock, MapPin, Users, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Seminar } from "@/lib/types";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface SeminarCardProps {
  seminar: Seminar;
  index: number;
  /** カードクリック時に呼ばれるコールバック */
  onSelect: (seminar: Seminar) => void;
}

/** Google Drive ファイルURLを直接画像URL に変換 */
function resolveImageUrl(url: string | undefined): string {
  if (!url) return "/9553.png";

  // 既に uc?export=download 形式なら そのまま返す
  if (url.includes("uc?export=download")) {
    return url;
  }

  // /file/d/{id}/view 形式から変換
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) {
    return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }

  // マッチしない場合は汎用画像
  return "/9553.png";
}

/** duration_minutes を「○時間○分」に変換 */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

/** 開催形式のカラーマッピング */
const formatColors: Record<string, string> = {
  online: "bg-cyan-500 text-white",
  venue: "bg-purple-600 text-white",
  hybrid: "bg-pink-500 text-white",
};

export function SeminarCard({ seminar, index, onSelect }: SeminarCardProps) {
  const isFull = seminar.current_bookings >= seminar.capacity;
  const isPast = new Date(seminar.date) < new Date();
  const spotsLeft = seminar.capacity - seminar.current_bookings;
  const isAlmostFull = spotsLeft > 0 && spotsLeft < 20;

  const date = new Date(seminar.date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(seminar)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(seminar); } }}
        className="cursor-pointer"
      >
        <Card className="group overflow-hidden hover:shadow-2xl transition-all duration-300 border-0 bg-card flex flex-col h-full">
          {/* 画像エリア（16:9固定、白背景） */}
          <div className="relative w-full aspect-[16/9] overflow-hidden bg-white">
            <img
              src={resolveImageUrl(seminar.image_url)}
              alt={seminar.title}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/9553.png";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            {/* 開催形式バッジ */}
            <Badge
              className={`absolute top-4 left-4 ${formatColors[seminar.format] || "bg-purple-600 text-white"}`}
            >
              {seminar.format === "online"
                ? "オンライン"
                : seminar.format === "venue"
                  ? "会場"
                  : "ハイブリッド"}
            </Badge>

            {/* 残りわずかバッジ */}
            {isAlmostFull && !isPast && (
              <Badge className="absolute top-4 right-4 bg-destructive text-destructive-foreground animate-pulse">
                残りわずか！
              </Badge>
            )}

            {/* 満席・終了バッジ */}
            {(isFull || isPast) && (
              <Badge className="absolute top-4 right-4 bg-gray-600 text-white">
                {isFull ? "満席" : "終了"}
              </Badge>
            )}

            {/* 日付オーバーライ */}
            <div className="absolute bottom-4 left-4 text-white">
              <div className="text-2xl font-bold">
                {format(date, "d", { locale: ja })}
              </div>
              <div className="text-sm opacity-90">
                {format(date, "M月 (E)", { locale: ja })}
              </div>
            </div>
          </div>

          {/* コンテンツ */}
          <CardContent className="p-5 flex flex-col flex-1">
            <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
              {seminar.title}
            </h3>

            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              {seminar.description}
            </p>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 text-primary" />
                <span>
                  {format(date, "M月d日 (E) HH:mm", { locale: ja })} ・{" "}
                  {formatDuration(seminar.duration_minutes)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 text-pink-500" />
                <span className="truncate">
                  {seminar.format === "online"
                    ? "オンライン開催"
                    : seminar.format === "hybrid"
                      ? "会場・オンライン(ハイブリッド)"
                      : "会場開催"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4 text-cyan-500" />
                <span>
                  登壇者: {seminar.speaker}
                  {seminar.speaker_title && (
                    <span className="text-muted-foreground">
                      （{seminar.speaker_title}）
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* 対象タグ */}
            <div className="flex flex-wrap gap-2 mb-4">
              {seminar.target === "members_only" && (
                <Badge variant="secondary" className="text-xs">
                  会員限定
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                残席: {isFull ? "なし" : `${spotsLeft}名`}
              </Badge>
            </div>

            {/* フッター */}
            <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">
                  {seminar.current_bookings}/{seminar.capacity}人
                </span>{" "}
                参加予定
              </div>
              <Button
                size="sm"
                className="rounded-full text-white"
                style={{
                  background:
                    "linear-gradient(to right, hsl(262, 83%, 58%), hsl(330, 81%, 60%))",
                }}
              >
                詳細を見る
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
