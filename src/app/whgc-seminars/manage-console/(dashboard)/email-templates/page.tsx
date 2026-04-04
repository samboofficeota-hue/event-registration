"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { EmailTemplate } from "@/lib/d1";

// ─── テンプレート分類 ────────────────────────────────────────
const ANNOUNCE_IDS = ["announce_30", "announce_14", "announce_7"];
const REMINDER_IDS = ["reminder_30", "reminder_7", "reminder_1", "followup_1"];

const TEMPLATE_LABELS: Record<string, string> = {
  // 【告知集客用】
  announce_30: "30日前告知",
  announce_14: "2週間前告知",
  announce_7:  "1週間前告知",
  // 【予約者向け】
  reminder_30: "2週間前リマインド",
  reminder_7:  "7日前リマインド",
  reminder_1:  "前日リマインド",
  followup_1:  "御礼・アンケート",
};

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  announce_30: "開催30日前にメルマガ登録者へ送信する集客告知メール",
  announce_14: "開催2週間前にメルマガ登録者へ送信する集客告知メール",
  announce_7:  "開催1週間前にメルマガ登録者へ送信する集客告知メール",
  reminder_30: "開催2週間前に参加登録者へ送信するセミナー案内メール",
  reminder_7:  "開催7日前に参加登録者へ送信するリマインドメール",
  reminder_1:  "開催前日に参加登録者へ送信するリマインドメール",
  followup_1:  "開催翌日に参加登録者へ送信する御礼・アンケート案内メール",
};

// 告知集客用の変数（メルマガ登録者向け、個人識別子なし）
const ANNOUNCE_VARS = [
  { key: "{{seminar_title}}", desc: "セミナータイトル" },
  { key: "{{date}}",          desc: "開催日時" },
  { key: "{{format}}",        desc: "開催形式" },
  { key: "{{speaker}}",       desc: "登壇者名" },
  { key: "{{description}}",   desc: "セミナー説明" },
  { key: "{{registration_url}}", desc: "申込URL" },
];

// 予約者向けの変数（参加者個人情報あり）
const REMINDER_VARS = [
  { key: "{{name}}",          desc: "参加者名" },
  { key: "{{seminar_title}}", desc: "セミナータイトル" },
  { key: "{{date}}",          desc: "開催日時" },
  { key: "{{format}}",        desc: "開催形式" },
  { key: "{{speaker}}",       desc: "登壇者名" },
  { key: "{{description}}",   desc: "セミナー説明" },
  { key: "{{meet_url_line}}", desc: "Meet URL行（あれば）" },
  { key: "{{registration_url}}", desc: "申込URL" },
  { key: "{{survey_url}}",    desc: "アンケートURL" },
];

type TabType = "announce" | "reminder";

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabType>("announce");

  useEffect(() => {
    fetch("/api/email-templates")
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => toast.error("テンプレートの読み込みに失敗しました"));
  }, []);

  function startEdit(template: EmailTemplate) {
    setEditing({ ...template });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/email-templates/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editing.name,
          subject: editing.subject,
          body: editing.body,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated: EmailTemplate = await res.json();
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditing(null);
      toast.success("テンプレートを保存しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const isAnnounceTab = tab === "announce";
  const currentIds = isAnnounceTab ? ANNOUNCE_IDS : REMINDER_IDS;
  const currentVars = isAnnounceTab ? ANNOUNCE_VARS : REMINDER_VARS;

  // 表示するテンプレートを現在のタブに合わせて並び替え
  const displayTemplates = currentIds
    .map((id) => templates.find((t) => t.id === id))
    .filter((t): t is EmailTemplate => !!t);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ページヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">メールテンプレート管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          送信タイミングごとにメールの件名・本文を編集できます
        </p>
      </div>

      {/* タブ */}
      <div className="flex gap-0 border-b border-border">
        <button
          onClick={() => { setTab("announce"); setEditing(null); }}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "announce"
              ? "border-orange-500 text-orange-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-orange-400 inline-block" />
            告知集客用
          </span>
        </button>
        <button
          onClick={() => { setTab("reminder"); setEditing(null); }}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "reminder"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-400 inline-block" />
            予約者向け
          </span>
        </button>
      </div>

      {/* タブ説明 */}
      <div className={`rounded-lg px-4 py-3 text-xs text-muted-foreground border ${
        isAnnounceTab ? "bg-orange-50 border-orange-100" : "bg-blue-50 border-blue-100"
      }`}>
        {isAnnounceTab
          ? "📢 メルマガ登録者へ送る集客・告知メールのテンプレートです。登録リストを指定して一斉配信します。"
          : "👤 セミナー予約済みの参加者へ送るリマインド・フォローアップメールのテンプレートです。登録者ごとに個別送信されます。"
        }
      </div>

      {/* 使用可能な変数 */}
      <Card className="border border-border bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">使用可能な変数</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {currentVars.map((v) => (
              <span key={v.key} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs">
                <code className="font-mono text-primary">{v.key}</code>
                <span className="text-muted-foreground">= {v.desc}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* テンプレート一覧 */}
      {templates.length === 0 && (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      )}

      {templates.length > 0 && displayTemplates.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <p className="text-sm">このカテゴリのテンプレートが見つかりません</p>
        </div>
      )}

      <div className="space-y-4">
        {displayTemplates.map((template) => (
          <Card
            key={template.id}
            className={`border bg-card ${
              isAnnounceTab ? "border-orange-100" : "border-blue-100"
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-foreground flex items-center gap-2">
                    <span className={`size-2 rounded-full shrink-0 ${isAnnounceTab ? "bg-orange-400" : "bg-blue-400"}`} />
                    {TEMPLATE_LABELS[template.id] ?? template.name}
                  </CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground pl-4">
                    {TEMPLATE_DESCRIPTIONS[template.id] ?? ""}
                  </p>
                </div>
                {editing?.id !== template.id && (
                  <Button size="sm" variant="outline" onClick={() => startEdit(template)}>
                    編集
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editing?.id === template.id ? (
                /* 編集フォーム */
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`subject-${template.id}`}>件名</Label>
                    <Input
                      id={`subject-${template.id}`}
                      value={editing.subject}
                      onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`body-${template.id}`}>本文</Label>
                    <Textarea
                      id={`body-${template.id}`}
                      value={editing.body}
                      onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                      rows={16}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? "保存中..." : "保存する"}
                    </Button>
                    <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                /* プレビュー */
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">件名：</span>
                    {template.subject}
                  </p>
                  <pre className="max-h-40 overflow-y-auto rounded-md bg-muted p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                    {template.body}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
