# サービス構造とプログラム構造

運用上でページおよびスプレッドシートを複製する際の参照用に、サービス構造とプログラム構造を整理したドキュメントです。

---

## 1. サービス構造（データ・外部サービス）

### 1.1 スプレッドシートの構成

| 種類 | 数 | 識別方法 | 主な用途 |
|------|----|----------|----------|
| **予約管理マスター** | **1ファイル** | 環境変数 `GOOGLE_SPREADSHEET_ID` | セミナー一覧・会員ドメイン・予約番号インデックス |
| **セミナー専用** | セミナーごとに1ファイル | マスター「セミナー一覧」の列「スプレッドシートID」に保存 | 予約情報・アンケート・イベント情報 |

**マスタースプレッドシート内のシート（タブ）:**

| シート名 | 用途 |
|----------|------|
| セミナー一覧 | 全セミナーの基本情報。各セミナーの「スプレッドシートID」で個別ファイルを参照 |
| 会員企業ドメイン | 会員判定用メールドメイン一覧（なければ自動作成） |
| 予約番号インデックス | 予約番号 → spreadsheet_id, reservation_id の検索用（なければ自動作成） |

**セミナー専用スプレッドシート内のシート:**

| シート名 | 用途 |
|----------|------|
| イベント情報 | セミナー詳細（1行目ヘッダー、2行目以降は1行＝1セミナーのコピー） |
| 予約情報 | 予約者氏名・メール・会社名・予約番号など |
| 事前アンケート / 事後アンケート | 回答データ |
| 事前アンケート設問 / 事後アンケート設問 | 設問定義（デフォルト設問を書き込む） |

### 1.2 スプレッドシートIDの流れ

```
環境変数 GOOGLE_SPREADSHEET_ID
    ↓
マスタースプレッドシート
    ├── セミナー一覧（各行に spreadsheet_id 列あり）
    │       ↓
    │   セミナー専用スプレッドシート（Drive で別ファイル）
    ├── 会員企業ドメイン
    └── 予約番号インデックス
```

- **マスター参照**: すべて `src/lib/google/sheets.ts` の `getMasterSpreadsheetId()` → `process.env.GOOGLE_SPREADSHEET_ID` で取得。
- **個別セミナー参照**: マスター「セミナー一覧」の `findMasterRowById(id)` で行を取得 → `row[11]`（spreadsheet_id）を使用。

### 1.3 環境変数（スプレッドシート・Drive 関連）

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `GOOGLE_SPREADSHEET_ID` | ○ | 予約管理マスターのスプレッドシートID。**ここが「1ファイル」の根拠** |
| `GOOGLE_DRIVE_FOLDER_ID` | 任意 | セミナー専用スプレッドシートを格納する Drive フォルダID |
| `GOOGLE_DRIVE_IMAGES_FOLDER_ID` | 任意 | セミナー画像アップロード先フォルダID |

その他: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_PRIVATE_KEY_ID`, `GOOGLE_CALENDAR_ID`, `GOOGLE_IMPERSONATE_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`, `NEXT_PUBLIC_APP_URL` など（`.env.local.example` 参照）。

### 1.4 セミナー専用スプレッドシートの作成タイミング

- **作成**: 管理画面でセミナーを新規作成（`POST /api/seminars`）時に `createSeminarSpreadsheet(title)` で自動作成。
- **保存**: 作成された `spreadsheetId` がマスター「セミナー一覧」の該当行の「スプレッドシートID」列に書き込まれる。

---

## 2. プログラム構造（Next.js App Router）

### 2.1 ディレクトリ構成（抜粋）

```
src/
├── app/
│   ├── layout.tsx, page.tsx, globals.css    # ルート
│   ├── admin/                                # 管理画面（/admin 以下）
│   │   ├── layout.tsx, page.tsx
│   │   ├── login/page.tsx
│   │   ├── member-domains/page.tsx
│   │   ├── reservations/page.tsx
│   │   ├── seminars/
│   │   │   ├── page.tsx, new/page.tsx
│   │   │   └── [id]/edit/page.tsx, image/page.tsx
│   │   ├── survey-questions/page.tsx
│   │   └── surveys/page.tsx
│   ├── api/                                  # API ルート
│   │   ├── auth/route.ts
│   │   ├── bookings/route.ts, by-number/route.ts
│   │   ├── member-domains/route.ts
│   │   ├── reservations/route.ts
│   │   ├── seminars/
│   │   │   ├── route.ts                      # GET一覧, POST新規（ここで createSeminarSpreadsheet 呼び出し）
│   │   │   └── [id]/route.ts, image/route.ts, ensure-survey-sheets/route.ts, survey-questions/route.ts
│   │   └── surveys/post/, pre/, results/
│   ├── booking/manage/page.tsx               # 予約管理（予約番号でアクセス）
│   └── seminars/                             # 公開ページ
│       ├── layout.tsx, page.tsx
│       └── [id]/page.tsx, booking/page.tsx, confirmation/page.tsx, manage/page.tsx, pre-survey/page.tsx, post-survey/page.tsx
├── components/                               # UI コンポーネント
├── lib/                                      # ビジネスロジック・外部連携
│   ├── google/sheets.ts                      # スプレッドシート操作の中心
│   ├── google/auth.ts, calendar.ts
│   ├── seminars.ts                           # マスター行 ↔ Seminar 型
│   ├── types.ts                              # Seminar, Reservation 等の型
│   ├── member-domains.ts, reservation-number.ts
│   ├── survey/storage.ts, survey-config.ts
│   └── email/resend.ts
└── middleware.ts                             # /admin の認証
```

### 2.2 ページ（ルート）一覧

| パス | ファイル | 説明 |
|------|----------|------|
| `/` | `app/page.tsx` | トップ |
| `/seminars` | `app/seminars/page.tsx` | セミナー一覧（公開） |
| `/seminars/[id]` | `app/seminars/[id]/page.tsx` | セミナー詳細 |
| `/seminars/[id]/booking` | `app/seminars/[id]/booking/page.tsx` | 予約フォーム |
| `/seminars/[id]/confirmation` | `app/seminars/[id]/confirmation/page.tsx` | 予約完了 |
| `/seminars/[id]/manage` | `app/seminars/[id]/manage/page.tsx` | 予約者向け管理 |
| `/seminars/[id]/pre-survey` | `app/seminars/[id]/pre-survey/page.tsx` | 事前アンケート |
| `/seminars/[id]/post-survey` | `app/seminars/[id]/post-survey/page.tsx` | 事後アンケート |
| `/booking/manage` | `app/booking/manage/page.tsx` | 予約番号入力で予約管理 |
| `/admin` | `app/admin/page.tsx` | 管理ダッシュボード |
| `/admin/login` | `app/admin/login/page.tsx` | 管理ログイン |
| `/admin/seminars` | `app/admin/seminars/page.tsx` | セミナー管理 |
| `/admin/seminars/new` | `app/admin/seminars/new/page.tsx` | セミナー新規作成 |
| `/admin/seminars/[id]/edit` | `app/admin/seminars/[id]/edit/page.tsx` | セミナー編集 |
| `/admin/seminars/[id]/image` | `app/admin/seminars/[id]/image/page.tsx` | セミナー画像 |
| `/admin/reservations` | `app/admin/reservations/page.tsx` | 予約一覧 |
| `/admin/member-domains` | `app/admin/member-domains/page.tsx` | 会員企業ドメイン |
| `/admin/survey-questions` | `app/admin/survey-questions/page.tsx` | アンケート設問 |
| `/admin/surveys` | `app/admin/surveys/page.tsx` | アンケート結果 |

### 2.3 スプレッドシートを参照しているコードの位置

| 処理 | 参照箇所 | 使うID |
|------|----------|--------|
| マスター「セミナー一覧」の読み書き | `src/lib/google/sheets.ts`（getMasterData, appendMasterRow, updateMasterRow, findMasterRowById） | `GOOGLE_SPREADSHEET_ID` |
| マスター「会員企業ドメイン」 | `src/lib/google/sheets.ts`（ensureMemberDomainsSheet, getMemberDomains, addMemberDomain, removeMemberDomain） | `GOOGLE_SPREADSHEET_ID` |
| マスター「予約番号インデックス」 | `src/lib/google/sheets.ts`（ensureReservationIndexSheet, appendReservationIndex, findReservationByNumber） | `GOOGLE_SPREADSHEET_ID` |
| セミナー新規作成で個別スプレッドシート作成 | `src/app/api/seminars/route.ts`（POST 内で createSeminarSpreadsheet） | 新規作成して返る spreadsheetId をマスターに保存 |
| 予約の作成・更新・キャンセル | `src/app/api/bookings/route.ts` | マスターから取得した seminar.spreadsheet_id + マスターの「セミナー一覧」行（current_bookings 更新で GOOGLE_SPREADSHEET_ID 使用） |
| 予約番号で予約検索 | `src/app/api/bookings/by-number/route.ts` | findReservationByNumber → マスター「予約番号インデックス」→ 取得した spreadsheet_id で個別シート参照 |
| アンケート設問・回答の読み書き | `src/lib/survey/storage.ts` 等 / API surveys, ensure-survey-sheets 等 | 各セミナーの spreadsheet_id |
| 管理画面の予約一覧・セミナー編集 | 各種 API 経由 | マスター + 各 seminar.spreadsheet_id |

**重要**: マスターのスプレッドシートIDは **`src/lib/google/sheets.ts` の `getMasterSpreadsheetId()` のみ**から参照している（`process.env.GOOGLE_SPREADSHEET_ID`）。一方、`src/app/api/bookings/route.ts` では「セミナー一覧」の行更新時に `process.env.GOOGLE_SPREADSHEET_ID!` を直接参照している箇所が 2 か所ある（POST 時の current_bookings 増加、DELETE 時の減少）。

---

## 3. 運用で「ページ・スプレッドシートを複製」する場合のポイント

- **マスターを複製する場合**: 新しいマスター用スプレッドシートを用意し、そのIDを **環境変数 `GOOGLE_SPREADSHEET_ID`** に設定する。デプロイ環境ごとに異なる値にすれば、同じコードベースで「別マスター」を参照できる。
- **セミナー専用スプレッドシート**: セミナーごとに既に1ファイルずつ作成されている。テンプレートとして複製する場合は、`createSeminarSpreadsheet` のシート構成・ヘッダー（`src/lib/google/sheets.ts`）に合わせる必要がある。
- **ページの複製**: Next.js のページは `src/app` 以下のファイル構造で決まる。同じURL構造で「別環境」を用意する場合は、デプロイ（および `NEXT_PUBLIC_APP_URL` や `GOOGLE_SPREADSHEET_ID`）を分ける形になる。同一リポジトリ内で「別ルート」を増やす場合は、`app` 以下に新規ディレクトリ・ページを追加する形になる。

上記を踏まえ、必要に応じて「複製手順書」や「環境別設定一覧」を別ドキュメントで用意すると運用しやすいです。

### 3.1 Google Drive 上でフォルダを作成・移行する

- **フォルダ作成・一覧・移動**: `src/lib/google/drive.ts` に `createFolder` / `listChildren` / `moveFileToFolder` を用意している。Google Drive API でフォルダ作成とファイル移動が可能。
- **「セミナー運営システム」内を master_folder にまとめる**: スクリプト `scripts/move-to-master-folder.ts` を利用する。
  1. 親フォルダ（「セミナー運営システム」）の直下のアイテム一覧を取得
  2. 直下に `master_folder` を作成
  3. 取得した全アイテムを `master_folder` に移動
- **実行方法**:
  - `.env.local` に `GOOGLE_DRIVE_FOLDER_ID` を「セミナー運営システム」フォルダのIDに設定してから:  
    `npm run move-to-master-folder`
  - またはフォルダIDを直接指定:  
    `npx tsx scripts/move-to-master-folder.ts <セミナー運営システムのフォルダID>`
- **注意**: 移行後、新規セミナー用スプレッドシートの保存先を `master_folder` にしたい場合は、`GOOGLE_DRIVE_FOLDER_ID` を `master_folder` のIDに変更する。
