"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Grid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeminarCard } from "@/components/seminar-card";
import { SeminarCalendar } from "@/components/seminar-calendar";
import { SeminarDetailModal } from "@/components/seminar-detail-modal";
import type { Seminar } from "@/lib/types";

interface SeminarListClientProps {
  seminars: Seminar[];
  /** テナント用のベースパス（例: /whgc-seminars）。未指定時は /seminars */
  basePath?: string;
}

/** フィルタカテゴリ定義 */
const formatCategories = [
  { key: "all", label: "すべて" },
  { key: "online", label: "オンライン" },
  { key: "venue", label: "会場" },
  { key: "hybrid", label: "ハイブリッド" },
];

const targetCategories = [
  { key: "all", label: "全対象" },
  { key: "public", label: "一般公開" },
  { key: "members_only", label: "会員限定" },
];

export function SeminarListClient({
  seminars,
  basePath = "/seminars",
}: SeminarListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("all");
  const [selectedTarget, setSelectedTarget] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "calendar">("grid");
  const [selectedSeminar, setSelectedSeminar] = useState<Seminar | null>(null);

  // クエリ ?id=xxx でセミナー詳細モーダルを開く（申し込みページから「セミナー詳細に戻る」用）
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    const seminar = seminars.find((s) => s.id === id);
    if (seminar) setSelectedSeminar(seminar);
  }, [searchParams, seminars]);

  useEffect(() => {
    if (selectedSeminar) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedSeminar]);

  const handleCloseModal = useCallback(() => {
    setSelectedSeminar(null);
    if (searchParams.get("id")) router.replace(basePath);
  }, [searchParams, router, basePath]);

  const filteredSeminars = useMemo(() => {
    return seminars.filter((s) => {
      // 検索キーワード
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = s.title.toLowerCase().includes(q);
        const matchDesc = s.description.toLowerCase().includes(q);
        const matchSpeaker = s.speaker.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchSpeaker) return false;
      }
      // 開催形式フィルタ
      if (selectedFormat !== "all" && s.format !== selectedFormat) return false;
      // 対象フィルタ
      if (selectedTarget !== "all" && s.target !== selectedTarget) return false;
      return true;
    });
  }, [seminars, searchQuery, selectedFormat, selectedTarget]);

  return (
    <>
      {/* 検索・フィルタセクション */}
      <section className="content-container -mt-8 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl shadow-2xl p-6 md:p-8"
        >
          {/* 検索バー＋ビュー切り替え */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="セミナーを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 text-lg border-2 border-border focus:border-primary rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                className="h-12 w-12 rounded-xl"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="w-5 h-5" />
              </Button>
              <Button
                variant={viewMode === "calendar" ? "default" : "outline"}
                size="icon"
                className="h-12 w-12 rounded-xl"
                onClick={() => setViewMode("calendar")}
              >
                <List className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* 開催形式カテゴリバッジ */}
          <div className="flex flex-wrap gap-2 mb-3">
            {formatCategories.map((cat) => (
              <Badge
                key={cat.key}
                variant={selectedFormat === cat.key ? "default" : "outline"}
                className={[
                  "cursor-pointer px-4 py-2 text-sm rounded-full transition-all",
                  selectedFormat === cat.key
                    ? "text-white"
                    : "hover:bg-muted",
                ].join(" ")}
                style={
                  selectedFormat === cat.key
                    ? {
                        background:
                          "linear-gradient(to right, hsl(262, 83%, 58%), hsl(330, 81%, 60%))",
                      }
                    : undefined
                }
                onClick={() => setSelectedFormat(cat.key)}
              >
                {cat.label}
              </Badge>
            ))}
          </div>

          {/* 対象カテゴリバッジ */}
          <div className="flex flex-wrap gap-2">
            {targetCategories.map((cat) => (
              <Badge
                key={cat.key}
                variant={selectedTarget === cat.key ? "default" : "outline"}
                className={[
                  "cursor-pointer px-3 py-1 text-xs rounded-full transition-all",
                  selectedTarget === cat.key
                    ? "bg-cyan-500 text-white"
                    : "hover:bg-muted",
                ].join(" ")}
                onClick={() => setSelectedTarget(cat.key)}
              >
                {cat.label}
              </Badge>
            ))}
          </div>
        </motion.div>
      </section>

      {/* コンテンツセクション */}
      <section
        id="seminar-list"
        className="content-container section-stack"
      >
        {viewMode === "grid" ? (
          <>
            {/* 件数表示 */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, hsl(262, 83%, 58%), hsl(330, 81%, 60%))",
                  }}
                >
                  {filteredSeminars.length}件
                </span>
                のセミナー
              </h2>
            </div>

            {filteredSeminars.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[var(--block-gap)]">
                {filteredSeminars.map((seminar, index) => (
                  <SeminarCard
                    key={seminar.id}
                    seminar={seminar}
                    index={index}
                    onSelect={setSelectedSeminar}
                  />
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20"
              >
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  セミナーが見つかりません
                </h3>
                <p className="text-muted-foreground">
                  検索条件を変更してお試しください
                </p>
              </motion.div>
            )}
          </>
        ) : (
          <>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                カレンダービュー
              </h2>
              <p className="text-muted-foreground mt-2">
                日付をクリックしてセミナーを確認
              </p>
            </div>
            <SeminarCalendar
              seminars={filteredSeminars}
              onSelectSeminar={setSelectedSeminar}
            />
          </>
        )}
      </section>

      {/* フッター */}
      <footer className="bg-card border-t border-border py-8">
        <div className="content-container text-center text-muted-foreground">
          <p>© 2026 Seminar Hub. All rights reserved.</p>
        </div>
      </footer>

      <SeminarDetailModal
        seminar={selectedSeminar}
        onClose={handleCloseModal}
        basePath={basePath}
      />
    </>
  );
}
