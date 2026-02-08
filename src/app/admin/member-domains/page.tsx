"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, Plus, Mail } from "lucide-react";

export default function AdminMemberDomainsPage() {
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);

  async function loadDomains() {
    try {
      const res = await fetch("/api/member-domains");
      if (!res.ok) throw new Error("取得に失敗しました");
      const data = await res.json();
      setDomains(Array.isArray(data) ? data : []);
    } catch {
      toast.error("会員企業ドメインの取得に失敗しました");
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDomains();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const d = newDomain.trim().toLowerCase();
    if (!d) {
      toast.error("ドメインを入力してください");
      return;
    }
    if (domains.includes(d)) {
      toast.error("このドメインは既に登録されています");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/member-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "追加に失敗しました");
      }
      const list = await res.json();
      setDomains(Array.isArray(list) ? list : [...domains, d]);
      setNewDomain("");
      toast.success("ドメインを追加しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(domain: string) {
    setDeletingDomain(domain);
    try {
      const res = await fetch("/api/member-domains", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "削除に失敗しました");
      }
      const list = await res.json();
      setDomains(Array.isArray(list) ? list : domains.filter((d) => d !== domain));
      toast.success("ドメインを削除しました");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeletingDomain(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          会員企業ドメイン
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          メールアドレスの@より後ろのドメインで会員企業を判定します。後方一致のため、親ドメイン（例: duskin.co.jp）を登録すれば、サブドメイン（mail.duskin.co.jp など）のメールも会員として扱われます。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Mail className="w-5 h-5" />
            ドメイン一覧
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2 min-w-[200px]">
              <Label htmlFor="new-domain">追加するドメイン</Label>
              <Input
                id="new-domain"
                type="text"
                placeholder="例: glico.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                className="font-mono"
              />
            </div>
            <Button type="submit" disabled={adding}>
              <Plus className="w-4 h-4 mr-2" />
              {adding ? "追加中..." : "追加"}
            </Button>
          </form>

          {loading ? (
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              登録されたドメインはありません。上記から追加してください。
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ドメイン</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((d) => (
                    <TableRow key={d}>
                      <TableCell className="font-mono">{d}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(d)}
                          disabled={deletingDomain === d}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {deletingDomain === d ? "削除中..." : "削除"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
