"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface NavGroup {
  type: "group";
  label: string;
  icon: string;
  items: NavItem[];
}

type NavEntry = NavItem | NavGroup;

const navEntries: NavEntry[] = [
  { path: "", label: "実施一覧", icon: "📊" },
  { path: "/reservations", label: "予約一覧", icon: "📋" },
  { path: "/member-domains", label: "会員企業ドメイン", icon: "📧" },
  { path: "/surveys", label: "アンケート結果", icon: "📝" },
  {
    type: "group",
    label: "メール配信",
    icon: "📨",
    items: [
      { path: "/email-templates", label: "テンプレート管理", icon: "📄" },
      { path: "/email-schedules", label: "配信スケジュール", icon: "🗓️" },
    ],
  },
  { path: "/newsletter", label: "メルマガ管理", icon: "📬" },
];

interface AdminSidebarProps {
  /** 管理画面のベースパス（例: /manage-console または /whgc-seminars/manage-console） */
  basePath?: string;
  /** 公開サイトへのリンク（例: /seminars または /whgc-seminars） */
  publicPath?: string;
}

export function AdminSidebar({
  basePath = "/manage-console",
  publicPath = "/seminars",
}: AdminSidebarProps) {
  const pathname = usePathname();

  // メール配信グループが現在のパスに含まれていれば初期展開
  const emailPaths = ["/email-templates", "/email-schedules"];
  const defaultOpen = emailPaths.some((p) => pathname.startsWith(`${basePath}${p}`));
  const [emailGroupOpen, setEmailGroupOpen] = useState(defaultOpen);

  return (
    <aside className="admin-sidebar flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar font-sans">
      <div className="px-5 py-5 pb-3">
        <Link
          href={basePath}
          className="text-lg font-bold tracking-tight text-sidebar-foreground"
        >
          管理画面
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 pb-4">
        {navEntries.map((entry) => {
          if ("type" in entry && entry.type === "group") {
            const isGroupActive = entry.items.some((item) =>
              pathname.startsWith(`${basePath}${item.path}`)
            );
            return (
              <div key={entry.label}>
                <button
                  onClick={() => setEmailGroupOpen((v) => !v)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[0.875rem] font-medium transition-colors",
                    isGroupActive
                      ? "bg-sidebar-primary/10 text-sidebar-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <span className="text-base">{entry.icon}</span>
                  <span className="flex-1 text-left">{entry.label}</span>
                  {emailGroupOpen
                    ? <ChevronDown className="h-4 w-4 opacity-60" />
                    : <ChevronRight className="h-4 w-4 opacity-60" />
                  }
                </button>
                {emailGroupOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                    {entry.items.map((item) => {
                      const href = `${basePath}${item.path}`;
                      const isActive = pathname.startsWith(href);
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={cn(
                            "flex items-center rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                            isActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const item = entry as NavItem;
          const href = `${basePath}${item.path}`;
          const isActive =
            item.path === ""
              ? pathname === basePath
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[0.875rem] font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-4">
        <Link
          href={publicPath}
          className="text-[0.8125rem] text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors"
        >
          公開サイトへ →
        </Link>
      </div>
    </aside>
  );
}
