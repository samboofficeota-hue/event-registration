"use client";

import Link from "next/link";

interface HeaderProps {
  /** テナント用のベースパス（例: /whgc-seminars）。未指定時は /seminars */
  basePath?: string;
}

export function Header({ basePath = "/seminars" }: HeaderProps) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link
          href="https://whgcforum.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-base font-bold text-gray-900"
        >
          WHGC ゲームチェンジャーズ・フォーラム
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href={basePath}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            セミナー一覧
          </Link>
        </nav>
      </div>
    </header>
  );
}
