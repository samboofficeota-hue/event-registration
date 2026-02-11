"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";

interface NoteArticle {
  title: string;
  url: string;
  image: string;
  pubDate: string;
  creator: string;
}

/** pubDate（RFC 2822）を「○日前 / ○週間前 / ○か月前」に変換 */
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return "今日";
  if (diffDays === 1) return "1日前";
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}週間前`;
  }
  const months = Math.floor(diffDays / 30);
  if (months < 12) return `${months}か月前`;
  const years = Math.floor(months / 12);
  return `${years}年前`;
}

const NOTE_USER = "whgc_official";

export function NoteArticlesSection() {
  const [articles, setArticles] = useState<NoteArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/note-articles?user=${NOTE_USER}&limit=3`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setArticles(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 記事がなければセクション自体非表示
  if (!loading && articles.length === 0) return null;

  return (
    <section className="content-container section-stack">
      {/* ヘッダー行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <Newspaper className="w-5 h-5" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            最近の活動報告
          </h2>
        </div>
        <a
          href={`https://note.com/${NOTE_USER}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          noteで全記事を見る
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* カードグリッド */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[var(--block-gap)]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl bg-muted aspect-[4/3]"
            />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[var(--block-gap)]">
          {articles.map((article) => (
            <a
              key={article.url}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-2xl overflow-hidden bg-card border border-border hover:shadow-xl transition-all duration-300"
            >
              {/* サムネイル */}
              <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                {article.image ? (
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Newspaper className="w-10 h-10" />
                  </div>
                )}
              </div>

              {/* テキスト */}
              <div className="p-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {formatRelativeDate(article.pubDate)}
                </p>
                <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-3 group-hover:text-primary transition-colors">
                  {article.title}
                </h3>
                <div className="flex items-center gap-2 pt-1">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] text-white font-bold">
                    W
                  </div>
                  <span className="text-xs text-muted-foreground">
                    WHGC公式
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* モバイル用リンク */}
      <a
        href={`https://note.com/${NOTE_USER}`}
        target="_blank"
        rel="noopener noreferrer"
        className="sm:hidden flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        noteで全記事を見る
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </section>
  );
}
