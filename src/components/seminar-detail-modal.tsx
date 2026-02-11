"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  X,
  Ticket,
  ArrowLeft,
  CheckCircle,
  MapPin,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Seminar } from "@/lib/types";
import { TENANT_KEYS } from "@/lib/tenant-config";
import { normalizeLineBreaks } from "@/lib/utils";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface SeminarDetailModalProps {
  seminar: Seminar | null;
  onClose: () => void;
  /** テナント用のベースパス（例: /whgc-seminars）。未指定時は /seminars */
  basePath?: string;
}

/** Google Drive ファイルURLを直接画像URLに変換 */
function resolveImageUrl(url: string | undefined): string {
  if (!url) return "/9553.png";

  if (url.includes("uc?export=view") || url.includes("uc?export=download")) {
    return url.replace("uc?export=download", "uc?export=view");
  }

  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) {
    const fileId = match[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }

  return "/9553.png";
}

/** 開催形式の日本語表記 */
function formatLabelText(f: string): string {
  if (f === "online") return "オンライン";
  if (f === "hybrid") return "ハイブリッド";
  return "会場";
}

/** 開催形式のカラー */
const formatColors: Record<string, string> = {
  online: "bg-cyan-500 text-white",
  venue: "bg-purple-600 text-white",
  hybrid: "bg-pink-500 text-white",
};

type ModalView = "detail" | "booking" | "confirmation";

export function SeminarDetailModal({
  seminar,
  onClose,
  basePath = "/seminars",
}: SeminarDetailModalProps) {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<ModalView>("detail");

  const pathname = usePathname();
  // テナントキー: セミナーデータに付与された tenant を最優先し、basePath・pathname から補完
  const tenantKeyFromBasePath =
    basePath !== "/seminars" ? basePath.replace(/^\//, "") : undefined;
  const tenantKeyFromPath = pathname
    ? TENANT_KEYS.find((t) => pathname.startsWith(`/${t}`))
    : undefined;
  const tenantKey =
    (seminar && "tenant" in seminar && seminar.tenant)
      ? seminar.tenant
      : (tenantKeyFromBasePath ?? tenantKeyFromPath);

  // Booking form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    department: "",
    phone: "",
  });
  const [emailConfirm, setEmailConfirm] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMemberOnlyModal, setShowMemberOnlyModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirmation state
  const [reservationNumber, setReservationNumber] = useState<string | null>(
    null
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset view when seminar changes
  const seminarId = seminar?.id ?? null;
  useEffect(() => {
    if (seminarId) {
      setView("detail");
      setFormData({
        name: "",
        email: "",
        company: "",
        department: "",
        phone: "",
      });
      setEmailConfirm("");
      setInvitationCode("");
      setReservationNumber(null);
      setFormError(null);
    }
  }, [seminarId]);

  const handleClose = () => {
    onClose();
  };

  if (!mounted || !seminar) return null;

  const isFull = seminar.current_bookings >= seminar.capacity;
  const isPast = new Date(seminar.date) < new Date();
  const date = new Date(seminar.date);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!seminar) return;
    setFormError(null);

    if (!formData.name || !formData.email || !formData.company) {
      setFormError("お名前、メールアドレス、会社名は必須です");
      return;
    }

    const email = formData.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      setFormError("有効なメールアドレスを入力してください");
      return;
    }

    if (email !== emailConfirm.trim()) {
      setFormError("メールアドレスが一致しません。もう一度ご確認ください。");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seminar_id: seminar.id,
          ...formData,
          email: formData.email.trim(),
          invitation_code: invitationCode.trim() || undefined,
          // 会員判定・セミナー取得に必須。セミナーに付与された tenant または basePath/pathname から送信
          ...(tenantKey ? { tenant: tenantKey } : {}),
        }),
      });

      if (res.status === 403) {
        setShowMemberOnlyModal(true);
        return;
      }

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "予約に失敗しました");
      }

      const booking = await res.json();

      setFormError(null);
      setReservationNumber(booking.reservation_number || booking.id);
      setView("confirmation");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "予約に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }

  // ----- Detail View (既存) -----
  const detailContent = (
    <>
      {/* ヒーロー：メイン画像 ＋ メインタイトル */}
      <header
        className="flex flex-shrink-0 flex-col mb-12 lg:mb-8"
        aria-label="ヒーロー"
      >
        <div className="relative w-full overflow-hidden bg-neutral-800 aspect-[16/9]">
          <img
            src={resolveImageUrl(seminar.image_url)}
            alt={seminar.title}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/9553.png";
            }}
          />
        </div>
        <div className="w-full max-w-[1280px] mx-auto bg-white px-8 lg:px-12 pt-6 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-gray-900 min-w-0 flex-1 whitespace-pre-line md:text-4xl">
              {normalizeLineBreaks(seminar.title)}
            </h2>
            <Badge
              className={`flex-shrink-0 ${formatColors[seminar.format] ?? "bg-purple-600 text-white"}`}
            >
              {formatLabelText(seminar.format)}
            </Badge>
          </div>
          {(isFull || isPast) && (
            <div className="pt-2">
              <Badge variant="destructive">
                {isFull ? "満席" : "終了済み"}
              </Badge>
            </div>
          )}
        </div>
      </header>

      {/* セミナー詳細セクション */}
      <section
        className="section-stack flex-shrink-0 bg-white pt-6 pb-8 lg:pt-8 lg:pb-10"
        aria-label="詳細"
      >
        <div className="w-full max-w-[1280px] mx-auto px-8 lg:px-12">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* 左カラム */}
            <div className="lg:col-span-2 section-stack">
              <div>
                <p className="whitespace-pre-line text-gray-600 leading-relaxed text-lg">
                  {normalizeLineBreaks(seminar.description)}
                </p>
              </div>

              <div className="block-stack">
                <div className="text-2xl text-gray-900">
                  講師： <span className="font-bold">{seminar.speaker}</span>
                </div>
                {seminar.speaker_title && (
                  <p className="text-gray-600">{seminar.speaker_title}</p>
                )}
                {seminar.speaker_reference_url && (
                  <a
                    href={seminar.speaker_reference_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline break-all text-sm"
                  >
                    参考URL
                  </a>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-sm">
                  定員 {seminar.capacity}名
                </Badge>
                <Badge
                  variant={
                    seminar.target === "members_only" ? "default" : "secondary"
                  }
                  className="text-sm"
                >
                  {seminar.target === "members_only" ? "会員限定" : "一般公開"}
                </Badge>
              </div>
            </div>

            {/* 右カラム: セミナー情報 */}
            <div className="block-stack">
              <div className="seminar-detail-card overflow-hidden border border-gray-200 bg-white p-6 block-stack">
                <h3 className="text-lg font-semibold text-gray-900">
                  セミナー情報
                </h3>
                <div className="block-stack-tight">
                  <div>
                    <p className="text-xs text-gray-500">タイトル</p>
                    <p className="font-medium text-gray-900 whitespace-pre-line">
                      {normalizeLineBreaks(seminar.title)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-gray-100 p-3">
                    <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">開催日</p>
                      <p className="font-medium text-gray-900 text-sm">
                        {format(date, "yyyy年M月d日 (E)", { locale: ja })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl bg-gray-100 p-3">
                    <Clock className="w-5 h-5 text-pink-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">時間</p>
                      <p className="font-medium text-gray-900 text-sm">
                        {format(date, "HH:mm", { locale: ja })} ～{" "}
                        {seminar.end_time || ""}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">開催形式</p>
                    <p className="font-medium text-gray-900 text-sm">
                      {formatLabelText(seminar.format)}
                    </p>
                  </div>
                </div>

                {!isFull && !isPast ? (
                  <Button
                    size="lg"
                    className="w-full text-white rounded-xl h-14 text-lg font-semibold"
                    style={{
                      background:
                        "linear-gradient(to right, hsl(262, 83%, 58%), hsl(330, 81%, 60%))",
                    }}
                    onClick={() => setView("booking")}
                  >
                    <Ticket className="w-5 h-5 mr-2" />
                    申し込む
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="w-full rounded-xl h-14 text-lg font-semibold"
                    disabled
                  >
                    {isFull ? "満席です" : "開催済みです"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );

  // ----- Booking View -----
  const bookingContent = (
    <>
      {/* ヘッダー背景 */}
      <div className="bg-white px-8 lg:px-12 pt-6 pb-4">
        <button
          onClick={() => setView("detail")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          セミナー詳細に戻る
        </button>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
          セミナー予約
        </h2>
      </div>

      {/* フォームセクション */}
      <section className="bg-white pt-4 pb-8 lg:pb-10">
        <div className="w-full max-w-2xl mx-auto px-8 lg:px-12">
          {/* セミナー情報カード */}
          <Card className="seminar-detail-card mb-8 overflow-hidden">
            <div className="h-1.5 rounded-t-xl bg-primary" />
            <CardHeader>
              <CardTitle className="whitespace-pre-line">
                {normalizeLineBreaks(seminar.title)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">開催日</p>
                      <p className="font-medium">
                        {format(date, "yyyy年M月d日 (E)", { locale: ja })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-pink-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">時間</p>
                      <p className="font-medium">
                        {format(date, "HH:mm", { locale: ja })} ～{" "}
                        {seminar.end_time || ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">開催形式</p>
                      <p className="font-medium">
                        {formatLabelText(seminar.format)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">講師</p>
                      <p>
                        <span className="font-bold">{seminar.speaker}</span> 氏
                      </p>
                      {seminar.speaker_title && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {seminar.speaker_title}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {seminar.target === "members_only"
                      ? "会員限定"
                      : "一般公開"}
                    {"　"}
                    定員 {seminar.capacity}名
                    {seminar.current_bookings >= seminar.capacity
                      ? "（満席）"
                      : "（残席あり）"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 申し込みフォーム */}
          <Card className="seminar-detail-card overflow-hidden">
            <div className="h-1.5 rounded-t-xl bg-primary" />
            <CardHeader>
              <CardTitle>ご参加者情報</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="modal-name">
                    お名前 <span className="text-red-500">*</span>
                  </Label>
                  <input
                    id="modal-name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modal-email">
                    メールアドレス <span className="text-red-500">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    （会社のメールアドレスでご登録ください）
                  </p>
                  <input
                    id="modal-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modal-emailConfirm">
                    メールアドレス（確認）{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <input
                    id="modal-emailConfirm"
                    name="emailConfirm"
                    type="email"
                    required
                    autoComplete="off"
                    value={emailConfirm}
                    onChange={(e) => setEmailConfirm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modal-company">
                    会社名 <span className="text-red-500">*</span>
                  </Label>
                  <input
                    id="modal-company"
                    name="company"
                    type="text"
                    required
                    value={formData.company}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modal-department">部署名</Label>
                  <input
                    id="modal-department"
                    name="department"
                    type="text"
                    value={formData.department}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {seminar.target === "members_only" && (
                  <div className="space-y-2">
                    <Label htmlFor="modal-invitation_code">招待コード</Label>
                    <p className="text-xs text-muted-foreground">
                      会員でない場合は、お手元の招待コードを入力してください。
                    </p>
                    <input
                      id="modal-invitation_code"
                      name="invitation_code"
                      type="text"
                      value={invitationCode}
                      onChange={(e) => setInvitationCode(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      autoComplete="off"
                    />
                  </div>
                )}

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    ※
                    予約完了後、登録されたメールアドレスに確認メールが送信されます。
                    <br />※
                    キャンセルする場合は、確認メールに記載されているリンクからお手続きください。
                  </p>
                </div>

                {/* インラインエラー表示 */}
                {formError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                <div className="flex flex-col items-center pt-4">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={loading}
                    className="w-full max-w-md text-white rounded-xl h-14 text-lg font-semibold"
                    style={{
                      background:
                        "linear-gradient(to right, hsl(262, 83%, 58%), hsl(330, 81%, 60%))",
                    }}
                  >
                    {loading ? "送信中..." : "この内容で申し込む"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setView("detail")}
                    className="mt-4 text-sm text-muted-foreground hover:underline"
                  >
                    キャンセルする
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 会員限定アラートモーダル（403 時に表示・反応がなく見える問題を解消） */}
      <Dialog open={showMemberOnlyModal} onOpenChange={setShowMemberOnlyModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              このセミナーは会員限定のものとなります
            </DialogTitle>
            <DialogDescription>
              会員企業のメールアドレスでお申し込みいただくか、招待コードをお持ちの場合は入力のうえお申し込みください。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowMemberOnlyModal(false)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  // ----- Confirmation View -----
  const confirmationContent = (
    <>
      <div className="bg-white min-h-full">
        <div className="w-full max-w-2xl mx-auto px-8 lg:px-12 py-12">
          {/* 成功アイコン */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold mb-2 text-gray-900">
              予約が完了しました
            </h2>
            <p className="text-muted-foreground">
              ご登録いただいたメールアドレスに確認メールを送信しました。
            </p>
          </div>

          {/* 予約情報カード */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>予約情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">予約番号</p>
                <p className="font-mono text-sm font-medium">
                  {reservationNumber}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  変更・キャンセルはメール内のリンクからお手続きください。
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  セミナー名
                </p>
                <p className="whitespace-pre-line font-medium text-lg">
                  {normalizeLineBreaks(seminar.title)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">開催日時</p>
                  <p className="font-medium">
                    {format(date, "yyyy年M月d日 (E) HH:mm", { locale: ja })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-pink-500" />
                <div>
                  <p className="text-xs text-muted-foreground">終了時刻</p>
                  <p className="font-medium">{seminar.end_time || ""}</p>
                </div>
              </div>

              {seminar.meet_url &&
                (seminar.format === "online" ||
                  seminar.format === "hybrid") && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 mb-2">
                      オンライン参加URL
                    </p>
                    <a
                      href={seminar.meet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-700 hover:underline break-all"
                    >
                      {seminar.meet_url}
                    </a>
                    <p className="text-xs text-blue-600 mt-2">
                      ※ 開催日時になりましたら、上記URLからご参加ください
                    </p>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* 注意事項 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">ご確認ください</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                •
                確認メールが届かない場合は、迷惑メールフォルダをご確認ください。
              </p>
              <p>
                •
                予約のキャンセルや変更は、確認メールに記載されているリンクから行えます。
              </p>
              <p>
                • セミナー開催日の前日に、リマインドメールをお送りします。
              </p>
              {seminar.format === "venue" && (
                <p>
                  • 会場開催の詳細は、確認メールをご確認ください。
                </p>
              )}
            </CardContent>
          </Card>

          {/* ボタン */}
          <div className="flex gap-3">
            <Button size="lg" onClick={handleClose} className="flex-1">
              セミナー一覧に戻る
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  // Select current view content
  let currentContent: React.ReactNode;
  if (view === "booking") {
    currentContent = bookingContent;
  } else if (view === "confirmation") {
    currentContent = confirmationContent;
  } else {
    currentContent = detailContent;
  }

  const modalContent = (
    <AnimatePresence>
      {/* オーバーレイ */}
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 bg-black z-[100]"
        onClick={handleClose}
      />

      {/* モーダルコンテナ */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="fixed inset-0 z-[101] flex justify-center overflow-y-auto"
      >
        <div className="w-full lg:w-[70%] min-h-full bg-black relative">
          {/* 閉じるボタン */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-[102] w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>

          {currentContent}

          {/* フッター（detail と booking ビューのみ） */}
          {view !== "confirmation" && (
            <footer className="bg-white border-t border-gray-200 py-8">
              <div className="content-container text-center text-gray-500">
                <p>© 2026 Seminar Hub. All rights reserved.</p>
              </div>
            </footer>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
