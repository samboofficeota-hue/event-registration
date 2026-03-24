# オンラインセミナー予約サイト

オンラインセミナーの予約・管理システム。Cloudflare D1 をメインデータストアとし、Google Drive で画像を管理、Resend で HTML メールを配信する。

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フレームワーク | Next.js 16 (App Router) + TypeScript |
| デプロイ | Cloudflare Workers（`@opennextjs/cloudflare` v1.16） |
| データベース | Cloudflare D1（SQLite） |
| メール配信 | Resend（HTML + テキスト デュアル送信） |
| 画像ストレージ | Google Drive（Drive API v3） |
| ビデオ会議 | Google Meet（Calendar API v3 経由で自動生成） |
| UI | Tailwind CSS v4 + shadcn/ui |
| 認証 | JWT（HMAC-SHA256 / httpOnly Cookie） |

> **注意**: Cloudflare Workers の有料プラン（$5/月）が必要です。`@vercel/og` の WASM バンドルにより無料プランのサイズ上限（3 MiB）を超えます。

---

## アーキテクチャ概要

### データストア

```
Cloudflare D1（メイン）
  ├── seminars              … セミナー情報
  ├── registrations         … 予約・参加者情報
  ├── member_domains        … 会員企業ドメイン
  ├── email_templates       … メールテンプレート
  ├── email_schedules       … 配信スケジュール
  ├── email_send_logs       … 配信ログ
  ├── newsletter_subscribers … メルマガ購読者
  ├── newsletter_tags       … 購読者タグ
  └── newsletter_import_batches … CSVインポート履歴

Google Drive（補助）
  └── セミナー画像（JPEG/PNG）
```

### テナント構成

同一 Cloudflare Workers 上で 4 テナントをホストします。

| テナントキー | 公開パス | 管理パス | 状況 |
|--------------|----------|----------|------|
| `whgc-seminars` | `/whgc-seminars` | `/whgc-seminars/manage-console` | ✅ 実装済み |
| `kgri-pic-center` | `/kgri-pic-center` | `/kgri-pic-center/manage-console` | 設計済み・未実装 |
| `aff-events` | `/aff-events` | `/aff-events/manage-console` | 設計済み・未実装 |
| `pic-courses` | `/pic-courses` | `/pic-courses/manage-console` | 設計済み・未実装 |

共通管理（スーパー管理者）は `/super-manage-console` でホスト。

---

## URL 構造

### 公開サイト（各テナント）

| パス | 説明 |
|------|------|
| `/{テナント}` | セミナー一覧 |
| `/{テナント}/[id]` | セミナー詳細 |
| `/{テナント}/[id]/booking` | 予約フォーム |
| `/{テナント}/[id]/confirmation` | 予約完了 |
| `/{テナント}/[id]/manage` | 予約変更・キャンセル |
| `/{テナント}/[id]/pre-survey` | 事前アンケート |
| `/{テナント}/[id]/post-survey` | 事後アンケート |
| `/booking/manage` | 予約番号入力（テナント共通） |

### テナント管理画面

| パス | 説明 |
|------|------|
| `/{テナント}/manage-console` | 実施一覧（ダッシュボード） |
| `/{テナント}/manage-console/login` | ログイン（→ `/super-manage-console/login` へリダイレクト） |
| `/{テナント}/manage-console/reservations` | 予約一覧 |
| `/{テナント}/manage-console/seminars` | セミナー管理 |
| `/{テナント}/manage-console/seminars/new` | セミナー新規作成 |
| `/{テナント}/manage-console/seminars/[id]/edit` | セミナー編集 |
| `/{テナント}/manage-console/seminars/[id]/image` | 画像登録 |
| `/{テナント}/manage-console/member-domains` | 会員企業ドメイン管理 |
| `/{テナント}/manage-console/surveys` | アンケート結果 |
| `/{テナント}/manage-console/email-schedules` | メール配信スケジュール管理 |
| `/{テナント}/manage-console/email-templates` | メールテンプレート管理 |

### 共通管理画面（スーパー管理者専用）

| パス | 説明 |
|------|------|
| `/super-manage-console/login` | スーパー管理者ログイン |
| `/super-manage-console` | 実施一覧 |
| `/super-manage-console/newsletter` | メルマガ購読者管理 |
| `/super-manage-console/email-schedules` | 配信スケジュール管理 |
| `/super-manage-console/email-templates` | テンプレート管理 |
| `/super-manage-console/reservations` | 予約一覧 |
| `/super-manage-console/member-domains` | 会員企業ドメイン管理 |
| `/super-manage-console/surveys` | アンケート結果 |

---

## 認証・セキュリティ

### JWT 方式

- ログインは `/super-manage-console/login` で行う（テナント選択 + パスワード）
- 認証成功で `admin_token` Cookie（httpOnly, sameSite=lax, 24h）を発行
- JWT payload: `{ role, tenant?, iat, exp }`
  - テナント管理者: `tenant` フィールドあり（例: `"whgc-seminars"`）
  - スーパー管理者: `tenant` フィールドなし

### Middleware によるルート保護

- `/{テナント}/manage-console/*` → テナントJWTのみ許可（他テナント・スーパーJWT は拒否）
- `/super-manage-console/*` → `tenant` フィールドなしのJWTのみ許可（テナントJWTは拒否）
- レート制限: IP アドレスベースのブルートフォース対策

### ログアウト

- サイドバーのログアウトボタン → `POST /api/admin/logout`
- `admin_token` Cookie を `maxAge=0` で即時無効化

---

## データベース（D1）

### マイグレーション

```bash
# ローカル
wrangler d1 migrations apply event-registration-db --local

# 本番（リモート）
wrangler d1 migrations apply event-registration-db --remote
```

マイグレーションファイル:

| ファイル | 内容 |
|----------|------|
| `migrations/0001_email_system.sql` | メールテンプレート・スケジュール・送信ログ |
| `migrations/0002_seminars_registrations.sql` | セミナー・予約情報 |
| `migrations/0003_newsletter.sql` | メルマガ購読者・タグ・インポート履歴 |

### データエクスポート / ローカル→本番 同期

```bash
# ローカルDBをエクスポート
wrangler d1 export event-registration-db --local --output=local-dump.sql

# INSERT 行のみ抽出して本番に反映
grep "^INSERT INTO" local-dump.sql > inserts-only.sql
wrangler d1 execute event-registration-db --remote --file=inserts-only.sql
```

---

## メール配信

### 仕組み

1. 管理画面でテンプレートを作成（変数: `{{title}}`, `{{date}}`, `{{meet_url}}` 等）
2. セミナーごとに「配信スケジュール」を設定（送信日時・テンプレート紐付け）
3. テスト送信で文面確認 → 本番配信は Cron / 手動トリガー

### HTML メール

- `src/lib/email/bulk.ts` の `buildHtmlEmail()` で生成
- URLを自動リンク化、WHGC ブランドのレスポンシブテンプレート
- Resend で `html` + `text`（プレーンテキスト）の両方を送信

### API エンドポイント

| エンドポイント | 説明 |
|----------------|------|
| `GET /api/seminars/[id]/email-schedules` | スケジュール一覧 |
| `POST /api/seminars/[id]/email-schedules` | スケジュール作成 |
| `PATCH /api/seminars/[id]/email-schedules/[scheduleId]` | スケジュール更新 |
| `DELETE /api/seminars/[id]/email-schedules/[scheduleId]` | スケジュール削除 |
| `POST /api/email-schedules/[scheduleId]/send` | 配信実行 |
| `POST /api/email-schedules/[scheduleId]/test-send` | テスト送信 |
| `POST /api/email-schedules/process` | Cron トリガー（一括処理） |
| `GET /api/email-templates` | テンプレート一覧 |
| `POST /api/email-templates` | テンプレート作成 |
| `PATCH /api/email-templates/[id]` | テンプレート更新 |
| `DELETE /api/email-templates/[id]` | テンプレート削除 |

---

## メルマガ管理（スーパー管理者専用）

### 機能

- 購読者の追加・編集・削除
- タグによる属性管理・フィルタリング
- CSV 一括インポート（重複は自動スキップ）
- ステータス管理（`active` / `unsubscribed`）

### API エンドポイント

| エンドポイント | 説明 |
|----------------|------|
| `GET /api/newsletter/subscribers` | 一覧（検索・タグフィルタ・ページネーション） |
| `POST /api/newsletter/subscribers` | 購読者追加 |
| `PATCH /api/newsletter/subscribers/[id]` | 購読者更新 |
| `DELETE /api/newsletter/subscribers/[id]` | 購読者削除 |
| `POST /api/newsletter/import` | CSV 一括インポート |
| `GET /api/newsletter/tags` | タグ一覧（使用件数付き） |

---

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example` を `.env.local` にコピーして各値を設定します。

**必須**

| 変数名 | 説明 |
|--------|------|
| `ADMIN_JWT_SECRET` | JWT署名シークレット（ランダムな長文字列） |
| `ADMIN_PASSWORD` | スーパー管理者パスワード |
| `RESEND_API_KEY` | Resend の API キー |
| `RESEND_FROM` | 送信元メールアドレス（例: `info@example.com`） |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google サービスアカウントのメール |
| `GOOGLE_PRIVATE_KEY` | Google サービスアカウントの秘密鍵 |
| `GOOGLE_DRIVE_IMAGES_FOLDER_ID` | セミナー画像アップロード先 Drive フォルダID |

**テナントごと（whgc-seminars の例）**

| 変数名 | 説明 |
|--------|------|
| `TENANT_WHGC_SEMINARS_PASSWORD` | テナント管理者パスワード |
| `TENANT_WHGC_SEMINARS_DRIVE_IMAGES_FOLDER_ID` | テナント画像フォルダ（省略時は共通フォルダ） |

### 3. D1 データベースの初期化

```bash
# Cloudflare にDBを作成（初回のみ）
wrangler d1 create event-registration-db

# wrangler.toml の [[d1_databases]] の database_id を更新

# マイグレーション実行
wrangler d1 migrations apply event-registration-db --local   # ローカル
wrangler d1 migrations apply event-registration-db --remote  # 本番
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

---

## デプロイ（Cloudflare Workers）

### 重要: Pages ではなく Workers で動かす

このプロジェクトは `@opennextjs/cloudflare` により **Worker（`.open-next/worker.js`）** を出力します。Cloudflare Pages（静的ファイルホスティング）では動作しません。

**Workers として Git 連携する手順**

1. Cloudflare ダッシュボード → Workers & Pages → Create application → **Workers** として作成
2. Build 設定:
   - **Build command**: `npx opennextjs-cloudflare build`
   - **Deploy command**: `npx opennextjs-cloudflare deploy`
3. 環境変数を Workers の Settings → Variables and Secrets で設定

```bash
# ローカルから手動デプロイ
npm run deploy
```

---

## 管理ユーザー向けガイド

→ **[docs/admin-user-guide.md](docs/admin-user-guide.md)**
