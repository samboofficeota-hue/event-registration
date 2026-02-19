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
          {/* 画像エリア（16:9、天地合わせ・左右余白白） */}
          <div className="relative flex w-full items-center justify-center overflow-hidden aspect-[16/9] bg-white">
            <img
              src={resolveImageUrl(seminar.image_url)}
              alt={seminar.title}
              className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/9553.png";
              }}
            />
          </div>

          {/* コンテンツ（block-stack-tight + global.css の行間: line-height 1.5〜1.6） */}
          <CardContent className="p-5 flex flex-col flex-1 block-stack-tight">
            <h3 className="line-clamp-2 whitespace-pre-line text-lg font-bold leading-relaxed text-foreground group-hover:text-primary transition-colors">
              {normalizeLineBreaks(seminar.title)}
            </h3>

            <p className="line-clamp-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {normalizeLineBreaks(seminar.description)}
            </p>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold leading-relaxed text-foreground">
                <Clock className="w-4 h-4 shrink-0 text-primary" />
                <span>
                  {format(date, "M月d日(E)HH:mm", { locale: ja })}〜{seminar.end_time || ""}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm leading-relaxed text-foreground">
                <MapPin className="w-4 h-4 shrink-0 text-pink-500" />
                <span className="truncate">
                  {seminar.format === "online"
                    ? "オンライン開催"
                    : seminar.format === "hybrid"
                      ? "会場・オンライン(ハイブリッド)"
                      : "会場開催"}
                </span>
              </div>
              <div className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                <Users className="mt-0.5 w-4 shrink-0 text-cyan-500" />
                <div className="min-w-0">
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
            {seminar.target && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  {seminar.target === "members_only" ? "会員限定" : "一般公開"}
                </Badge>
              </div>
            )}

            {/* フッター */}
            <div className="mt-auto flex items-center justify-between border-t border-border pt-4 flex-shrink-0">
              <div className="text-sm leading-relaxed text-foreground">
                定員 <span className="font-medium">{seminar.capacity}名</span>
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
