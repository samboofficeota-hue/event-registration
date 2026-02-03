"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "ダッシュボード", icon: "📊" },
  { href: "/admin/seminars", label: "セミナー管理", icon: "📅" },
  { href: "/admin/reservations", label: "予約一覧", icon: "📋" },
  { href: "/admin/survey-questions", label: "アンケート作成", icon: "✏️" },
  { href: "/admin/surveys", label: "アンケート結果", icon: "📝" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-sidebar-border bg-sidebar p-4">
      <div className="mb-6">
        <Link href="/admin" className="text-lg font-bold text-sidebar-foreground">
          管理画面
        </Link>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 border-t border-sidebar-border pt-4">
        <Link
          href="/seminars"
          className="text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground"
        >
          公開サイトへ →
        </Link>
      </div>
    </aside>
  );
}
