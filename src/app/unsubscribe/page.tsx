"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function UnsubscribeInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [status, setStatus] = useState<"confirm" | "loading" | "done" | "error" | "invalid">(
    id ? "confirm" : "invalid"
  );
  const [email, setEmail] = useState("");

  async function handleUnsubscribe() {
    if (!id) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEmail(data.email ?? "");
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f4f4f5",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, 'Yu Gothic', sans-serif",
    }}>
      <div style={{
        maxWidth: 480,
        width: "100%",
        backgroundColor: "#ffffff",
        borderRadius: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}>
        {/* ヘッダー */}
        <div style={{ backgroundColor: "#18181b", padding: "20px 32px" }}>
          <p style={{ margin: 0, color: "#ffffff", fontSize: 15, fontWeight: 600, letterSpacing: "0.04em" }}>
            WHGC ゲームチェンジャーズ・フォーラム
          </p>
        </div>

        {/* コンテンツ */}
        <div style={{ padding: "40px 32px" }}>
          {status === "invalid" && (
            <>
              <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700, color: "#18181b" }}>
                無効なリンクです
              </h1>
              <p style={{ margin: 0, color: "#71717a", fontSize: 14, lineHeight: 1.8 }}>
                このリンクは無効または期限切れです。<br />
                お手元のメールに記載されたリンクをご確認ください。
              </p>
            </>
          )}

          {status === "confirm" && (
            <>
              <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700, color: "#18181b" }}>
                メルマガ配信停止
              </h1>
              <p style={{ margin: "0 0 24px", color: "#71717a", fontSize: 14, lineHeight: 1.8 }}>
                WHGC ゲームチェンジャーズ・フォーラムからのメールマガジンの配信を停止します。<br />
                よろしければ下のボタンをクリックしてください。
              </p>
              <button
                onClick={handleUnsubscribe}
                style={{
                  display: "inline-block",
                  padding: "12px 28px",
                  backgroundColor: "#18181b",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                配信停止を確定する
              </button>
              <p style={{ margin: "16px 0 0", color: "#a1a1aa", fontSize: 12 }}>
                ※ 再度受信を希望される場合は、事務局（info@allianceforum.org）までご連絡ください。
              </p>
            </>
          )}

          {status === "loading" && (
            <p style={{ margin: 0, color: "#71717a", fontSize: 14 }}>処理中…</p>
          )}

          {status === "done" && (
            <>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
              }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 40,
                  backgroundColor: "#f0fdf4",
                  borderRadius: "50%",
                  fontSize: 20,
                }}>✓</span>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#18181b" }}>
                  配信停止が完了しました
                </h1>
              </div>
              <p style={{ margin: 0, color: "#71717a", fontSize: 14, lineHeight: 1.8 }}>
                {email && <><strong style={{ color: "#18181b" }}>{email}</strong> への<br /></>}
                メールマガジンの配信を停止しました。<br />
                今後このアドレスへのメール配信は行われません。<br /><br />
                再度受信を希望される場合は、<br />
                事務局（<a href="mailto:info@allianceforum.org" style={{ color: "#6366f1" }}>info@allianceforum.org</a>）までご連絡ください。
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700, color: "#18181b" }}>
                エラーが発生しました
              </h1>
              <p style={{ margin: "0 0 16px", color: "#71717a", fontSize: 14, lineHeight: 1.8 }}>
                配信停止の処理に失敗しました。<br />
                時間をおいて再度お試しいただくか、事務局までご連絡ください。
              </p>
              <button
                onClick={handleUnsubscribe}
                style={{
                  display: "inline-block",
                  padding: "10px 24px",
                  backgroundColor: "#f4f4f5",
                  color: "#18181b",
                  border: "1px solid #e4e4e7",
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                再試行
              </button>
            </>
          )}
        </div>

        {/* フッター */}
        <div style={{
          padding: "16px 32px",
          backgroundColor: "#fafafa",
          borderTop: "1px solid #e4e4e7",
        }}>
          <p style={{ margin: 0, color: "#a1a1aa", fontSize: 11, lineHeight: 1.8 }}>
            WHGC ゲームチェンジャーズ・フォーラム事務局<br />
            <a href="mailto:info@allianceforum.org" style={{ color: "#a1a1aa" }}>info@allianceforum.org</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f4f4f5" }}>
        <p style={{ color: "#71717a" }}>読み込み中…</p>
      </div>
    }>
      <UnsubscribeInner />
    </Suspense>
  );
}
