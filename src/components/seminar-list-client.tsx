"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { SeminarCard } from "@/components/seminar-card";
import { SeminarDetailModal } from "@/components/seminar-detail-modal";
import type { Seminar } from "@/lib/types";

interface SeminarListClientProps {
  seminars: Seminar[];
  /** テナント用のベースパス（例: /whgc-seminars）。未指定時は /seminars */
  basePath?: string;
}

const targetCategories = [
  { key: "all", label: "すべて" },
  { key: "members_only", label: "会員限定" },
  { key: "public", label: "一般公開" },
];

export function SeminarListClient({
  seminars,
  basePath = "/seminars",
}: SeminarListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTarget, setSelectedTarget] = useState("all");
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
      // 対象フィルタ
      if (selectedTarget !== "all" && s.target !== selectedTarget) return false;
      return true;
    });
  }, [seminars, selectedTarget]);

  return (
    <>
      {/* コンテンツセクション */}
      <section
        id="seminar-list"
        className="content-container section-stack"
      >
        {/* フィルタボタン */}
        <div className="flex justify-center gap-3">
          {targetCategories.map((cat) => (
            <Badge
              key={cat.key}
              variant={selectedTarget === cat.key ? "default" : "outline"}
              className={[
                "cursor-pointer px-5 py-2 text-sm rounded-full transition-all",
                selectedTarget === cat.key
                  ? "text-white"
                  : "hover:bg-muted",
              ].join(" ")}
              style={
                selectedTarget === cat.key
                  ? {
                      background:
                        "linear-gradient(to right, hsl(262, 83%, 58%), hsl(330, 81%, 60%))",
                    }
                  : undefined
              }
              onClick={() => setSelectedTarget(cat.key)}
            >
              {cat.label}
            </Badge>
          ))}
        </div>

        {/* 見出し */}
        <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center">
          ご参加受付中のプログラム一覧
        </h2>

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
          <div className="text-center py-20">
            <p className="text-muted-foreground">
              現在、受付中のプログラムはありません
            </p>
          </div>
        )}
      </section>

      {/* フッター */}
      <footer className="bg-card border-t border-border py-8">
        <div className="content-container text-center text-muted-foreground">
          <p>© WHGC 2026 All Rights Reserved.</p>
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
