"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { Seminar } from "@/lib/types";

export default function SeminarImagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [seminar, setSeminar] = useState<Seminar | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetch(`/api/seminars/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setSeminar(data);
        if (data.image_url) {
          setPreview(data.image_url);
        }
      });
  }, [id]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 5 * 1024 * 1024) {
      toast.error("ファイルサイズは5MB以内にしてください");
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(selected.type)) {
      toast.error("許可されているファイル形式: JPEG, PNG, GIF, WebP");
      return;
    }

    setFile(selected);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selected);
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch(`/api/seminars/${id}/image`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "アップロードに失敗しました");
      }

      toast.success("画像を登録しました");
      setFile(null);
      router.push(`/admin/seminars/${id}/edit`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "アップロードに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  if (!seminar) {
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">セミナー画像登録</h1>

      <Card>
        <CardHeader>
          <CardTitle>{seminar.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 現在の画像（登録済みの場合） */}
          {seminar.image_url && !file && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">現在の画像</Label>
              <div className="rounded border overflow-hidden">
                <img
                  src={seminar.image_url.replace(
                    /\/file\/d\/([^/]+)\/view/,
                    "/file/d/$1/export?format=png"
                  )}
                  alt={seminar.title}
                  className="w-full max-h-64 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          )}

          {/* プレビュー（新規選択時） */}
          {file && preview && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">プレビュー</Label>
              <div className="rounded border overflow-hidden">
                <img
                  src={preview}
                  alt="プレビュー"
                  className="w-full max-h-64 object-contain"
                />
              </div>
            </div>
          )}

          {/* ファイル選択 */}
          <div className="space-y-2">
            <Label htmlFor="image-input">
              画像ファイル <span className="text-muted-foreground text-xs">(JPEG, PNG, GIF, WebP / 5MB以内)</span>
            </Label>
            <input
              id="image-input"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
          </div>

          {/* ボタン */}
          <div className="flex gap-2">
            <Button type="button" disabled={loading || !file} onClick={handleUpload}>
              {loading ? "アップロード中..." : "画像を登録する"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/seminars/${id}/edit`)}
            >
              キャンセル
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
