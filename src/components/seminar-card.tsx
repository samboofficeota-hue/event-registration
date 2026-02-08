"use client";

import { motion } from "framer-motion";
import { Clock, MapPin, Users, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Seminar } from "@/lib/types";
import { normalizeLineBreaks } from "@/lib/utils";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface SeminarCardProps {
  seminar: Seminar;
  index: number;
  /** カードクリック時に呼ばれるコールバック（詳細をモーダルで表示） */
  onSelect: (seminar: Seminar) => void;
}

/** Google Drive ファイルURLを直接画像URL に変換 */
function resolveImageUrl(url: string | undefined): string {
  if (!url) return "/9553.png";

  // 既に uc?export=view 形式なら そのまま返す
  if (url.includes("uc?export=view") || url.includes("uc?export=download")) {
    // download形式の場合はview形式に変換（より安定）
    return url.replace("uc?export=download", "uc?export=view");
  }

  // /file/d/{id}/view 形式から変換
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) {
    const fileId = match[1];
    // サムネイル画像URLを使用（より軽量で高速）
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }

  // マッチしない場合は汎用画像
  return "/9553.png";
}

/** duration_minutes を「○分」で表示（例: 90分） */
function formatDuration(minutes: number): string {
  return `${minutes}分`;
}

export function SeminarCard({ seminar, index, onSelect }: SeminarCardProps) {
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
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(seminar);
          }
        }}
        className="cursor-pointer h-full"
      >
        <Card className="group overflow-hidden hover:shadow-2xl transition-all duration-300 border border-border bg-card flex flex-col h-full">
          {/* 画像エリア（16:9。画像は天地に合わせて表示、左右余白は白） */}
          <div className="relative flex w-full items-center justify-center overflow-hidden bg-white aspect-[16/9]">
            <img
              src={resolveImageUrl(seminar.image_url)}
              alt={seminar.title}
              className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/9553.png";
              }}
            />
          </div>

          {/* コンテンツ（block-stack-tight でブロック間隔を統一） */}
          <CardContent className="p-5 flex flex-col flex-1 block-stack-tight">
            <h3 className="line-clamp-2 whitespace-pre-line text-lg font-bold text-foreground group-hover:text-primary transition-colors">
              {normalizeLineBreaks(seminar.title)}
            </h3>

            <p className="line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
              {normalizeLineBreaks(seminar.description)}
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Clock className="w-4 h-4 shrink-0 text-primary" />
                <span>
                  {format(date, "M月d日(E)HH:mm", { locale: ja })}・
                  {formatDuration(seminar.duration_minutes)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <MapPin className="w-4 h-4 shrink-0 text-pink-500" />
                <span className="truncate">
                  {seminar.format === "online"
                    ? "オンライン開催"
                    : seminar.format === "hybrid"
                      ? "会場・オンライン(ハイブリッド)"
                      : "会場開催"}
                </span>
              </div>
              <div className="flex items-start gap-2 text-sm text-foreground">
                <Users className="mt-0.5 w-4 shrink-0 text-cyan-500" />
                <div>
                  <div>
                    登壇者： <span className="font-bold">{seminar.speaker}</span> 氏
                  </div>
                  {seminar.speaker_title && (
                    <div className="mt-0.5 text-foreground">
                      {seminar.speaker_title}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 対象タグ */}
            {seminar.target === "members_only" && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  会員限定
                </Badge>
              </div>
            )}

            {/* フッター */}
            <div className="mt-auto flex items-center justify-between border-t border-border pt-4 flex-shrink-0">
              <div className="text-sm text-foreground">
                <span className="font-medium">
                  {seminar.current_bookings}/{seminar.capacity}人
                </span>
                参加予定
              </div>
              <Button
                size="sm"
                className="seminar-card-cta rounded-full border-0 text-white shadow-sm"
              >
                詳細を見る
                <ArrowRight className="ml-1 w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
