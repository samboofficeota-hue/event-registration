# オンラインセミナー予約サイト

オンラインセミナーの予約・管理システム。Google スプレッドシートでデータを管理し、Google Meet でセミナーを実施する。

## 技術スタック

- **フレームワーク**: Next.js (App Router) + TypeScript
- **デプロイ**: Cloudflare Workers（`@opennextjs/cloudflare`）
- **データストア**: Google Spreadsheets (Sheets API v4)
- **ビデオ会議**: Google Meet (Calendar API v3 経由で自動生成)
- **UI**: Tailwind CSS v4 + shadcn/ui

## スプレッドシート構成

### 予約管理マスター（1ファイル）
- **「セミナー一覧」シート**: 全セミナーの基本情報を管理  
  ヘッダー行（列順）:  
  `ID | タイトル | 説明 | 開催日時 | 所要時間(分) | 定員 | 現在の予約数 | 登壇者 | Meet URL | Calendar Event ID | ステータス | スプレッドシートID | 肩書き | 開催形式 | 対象 | Googleカレンダー | 作成日時 | 更新日時`  
  - 開催形式: `venue`（会場）/ `online`（オンライン）/ `hybrid`（ハイブリッド）  
  - 対象: `members_only`（会員限定）/ `public`（一般公開）  
  - 既存のマスターを使う場合は、上記4列（肩書き・開催形式・対象・Googleカレンダー）を「スプレッドシートID」の右に追加し、「作成日時」「更新日時」を右にずらしてください。

### セミナー専用スプレッドシート（セミナーごとに自動作成）
- **「イベント情報」シート**: セミナーの詳細情報（肩書き・開催形式・対象・Googleカレンダー含む）
- **「予約情報」シート**: 予約者の氏名・メール・会社名など
- **「事前アンケート」シート**: 事前アンケート回答
- **「事後アンケート」シート**: 事後アンケート回答

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example` を `.env.local` にコピーして、各値を設定してください。

### 3. Google Cloud のセットアップ

1. Google Cloud Console でプロジェクト作成
2. Sheets API / Calendar API / Drive API を有効化
3. サービスアカウントを作成し、JSON キーをダウンロード
4. 環境変数にサービスアカウント情報を設定

### 4. マスタースプレッドシートの作成

1. Google スプレッドシートを新規作成（名前: 「予約管理マスター」）
2. 最初のシート名を「セミナー一覧」に変更
3. ヘッダー行を追加（上記「セミナー一覧」の列順を参照）
4. スプレッドシートIDを環境変数 `GOOGLE_SPREADSHEET_ID` に設定
5. サービスアカウントにスプレッドシートの編集権限を共有

### 5. 開発サーバーの起動

```bash
npm run dev
```

## デプロイ（Cloudflare）

### 根本原因：404 になる理由（Pages と Workers の違い）

**OpenNext は「Cloudflare Workers」向けです。Cloudflare Pages（Git 連携）向けではありません。**

| 種類 | URL 例 | 動き |
|------|--------|------|
| **Cloudflare Pages**（Git 連携） | `*.pages.dev` | ビルド出力ディレクトリを**静的ファイル**としてアップロードし、そのファイルだけを配信する。**Worker スクリプトは実行されない。** |
| **Cloudflare Workers**（Git 連携 = Workers Builds） | `*.workers.dev` | `wrangler.toml` の `main`（Worker スクリプト）を実行し、すべてのルートを動的に処理する。 |

このプロジェクトは OpenNext でビルドすると **Worker（`.open-next/worker.js`）＋ 静的アセット** が出力されます。  
**Pages プロジェクト**で同じリポジトリをビルドすると、「ビルド出力ディレクトリ」のファイルだけがアップロードされ、**Worker は動かず** `/` や `/seminars` などのルートに該当するファイルが存在しないため **404** になります。環境変数やルーティング設定の前に、「Pages ではなく Workers で動かす」ことが必要です。

### 正しいデプロイ方法（Workers を使う）

#### 方法 A：Cloudflare Workers に Git 連携（推奨）

1. **Workers & Pages** → **Create application** → **Import a repository** でリポジトリをインポートするとき、**「Workers」として**作成する（Pages の「Connect to Git」で作った既存の **Pages** プロジェクトは OpenNext では動きません）。
2. **Build 設定**（Settings → Builds）で以下を設定する。
   - **Build command**: `npx opennextjs-cloudflare build`
   - **Deploy command**: `npx opennextjs-cloudflare deploy`
3. ダッシュボードの **Worker 名** が `wrangler.toml` の `name`（`event-registration`）と一致していることを確認する。
4. デプロイ後の URL は **`https://event-registration.<あなたのサブドメイン>.workers.dev`** になります（`*.pages.dev` ではなく `*.workers.dev`）。

既に **Pages** プロジェクト（`event-registration.pages.dev`）がある場合は、**新しく Workers 用のプロジェクト**を作り、同じリポジトリを「Workers」として接続し直す必要があります。

#### 方法 B：ローカルまたは CI からデプロイ

```bash
npm run deploy
```

（内部で `opennextjs-cloudflare build` と `opennextjs-cloudflare deploy` を実行し、**Workers** にデプロイされます。URL は `*.workers.dev` です。）

### 環境変数

環境変数は Cloudflare ダッシュボード（Workers の **Settings** → **Variables and Secrets**）または `wrangler secret put <NAME>` で設定してください。

## 主要ページ

| パス | 説明 |
|------|------|
| `/seminars` | セミナー一覧（公開） |
| `/seminars/[id]` | セミナー詳細（公開） |
| `/seminars/[id]/booking` | 予約フォーム |
| `/seminars/[id]/pre-survey` | 事前アンケート |
| `/seminars/[id]/post-survey` | 事後アンケート |
| `/admin` | 管理ダッシュボード |
| `/admin/seminars` | セミナー管理 |
| `/admin/reservations` | 予約一覧 |
| `/admin/surveys` | アンケート結果 |
