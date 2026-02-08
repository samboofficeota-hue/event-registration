# マルチテナント構成 設計書

4つの運用単位に分け、同一 Cloudflare / 同一 Google API アカウントで運用するための設計です。

---

## 1. 目標と制約

### やりたいこと

| 項目 | 内容 |
|------|------|
| **既存開発成果** | `master_folder` に保管（これまでどおり1つのマスター＋セミナー用シート群） |
| **新規複製** | 上記を元に **4つのフォルダ（テナント）** を用意 |
| **運用** | 4テナントは **運用・セミナー情報・管理者・フロントのカスタマイズ** をそれぞれ別に持つ |
| **共通** | **Cloudflare** と **Google Workspace API 連携** は同じアカウントのまま |

### URL イメージ（Cloudflare 1デプロイ）

| パス | 扱い |
|------|------|
| `/seminars` | **マスター** → 非表示（404 またはリダイレクト） |
| `/whgc-seminars` | テナント1：セミナー一覧・詳細・予約・アンケート |
| `/kgri-pic-center` | テナント2：同上 |
| `/aff-events` | テナント3：同上 |
| `/pic-courses` | テナント4：同上 |

**設計の考え方**: 上記に沿い、**テナント名が先**に来る。現在の **`/seminars` が、4 つのテナント名（whgc-seminars, kgri-pic-center, aff-events, pic-courses）に入れ替わり**、その下の **フォルダ構造は各テナントで同じように複製**する。管理画面・API も「テナント名の直下」に同じ構造で複製する（例: `/whgc-seminars/admin`, `/whgc-seminars/api/...`）。管理者はテナントごとに別とする。

---

## 2. テナント一覧（固定）

| テナントキー | 公開パス | 想定用途（例） |
|--------------|----------|----------------|
| `whgc-seminars` | `/whgc-seminars` | WHGC セミナー |
| `kgri-pic-center` | `/kgri-pic-center` | KGRI PIC センター |
| `aff-events` | `/aff-events` | AFF イベント |
| `pic-courses` | `/pic-courses` | PIC コース |

※ テナントキーは URL のパスと一致させ、プログラム内で一意に識別します。  
※ テナント数の増加は **1〜2 年先**の想定のため、現時点では **動的 `[tenant]` は使わず、上記 4 つをハードコード**する方針とします。

---

## 3. Google Drive 構成

### 3.1 フォルダ構造（運用後）

```
セミナー運営システム（または任意の親フォルダ）
├── master_folder                    ← 既存開発成果（移行済み）
│   ├── 予約管理マスター（1スプレッドシート）
│   └── 【セミナー】xxx（セミナー用スプレッドシート群）
│
├── whgc-seminars                    ← テナント1用フォルダ
│   ├── 予約管理マスター（テナント1用・1ファイル）
│   └── 【セミナー】xxx（テナント1のセミナー用シート群）
│
├── kgri-pic-center                  ← テナント2用
├── aff-events                       ← テナント3用
└── pic-courses                      ← テナント4用
```

- **master_folder**: これまでの開発用マスター＋セミナー用シート。参照は従来どおり `GOOGLE_SPREADSHEET_ID`（および `GOOGLE_DRIVE_FOLDER_ID`）でよい。`/seminars` 非表示後もデータは残すだけならそのままでよい。
- **4テナント**: 各フォルダに「そのテナント用のマスター1つ」＋「そのテナントのセミナー用スプレッドシート」を格納。**マスターは「論理的に1システム1マスター」で、テナントごとに1ファイルずつ持つ**形です。

### 3.2 テナントごとの設定（環境変数で保持）

1テナントあたり次の2つを紐づけます。

| 環境変数（例） | 説明 |
|----------------|------|
| `TENANT_WHGC_SEMINARS_MASTER_SPREADSHEET_ID` | テナント whgc-seminars のマスタースプレッドシートID |
| `TENANT_WHGC_SEMINARS_DRIVE_FOLDER_ID` | テナント whgc-seminars の Drive フォルダID（新規セミナー用シートの保存先） |

同様に以下を定義します。

- `TENANT_KGRI_PIC_CENTER_MASTER_SPREADSHEET_ID` / `TENANT_KGRI_PIC_CENTER_DRIVE_FOLDER_ID`
- `TENANT_AFF_EVENTS_MASTER_SPREADSHEET_ID` / `TENANT_AFF_EVENTS_DRIVE_FOLDER_ID`
- `TENANT_PIC_COURSES_MASTER_SPREADSHEET_ID` / `TENANT_PIC_COURSES_DRIVE_FOLDER_ID`

Cloudflare と Google API は共通のため、既存の  
`GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_PRIVATE_KEY_ID`  
等はそのまま使い、**テナントごとにマスターIDとフォルダIDだけ切り替える**形にします。

---

## 4. アプリ側の構成（Next.js / Cloudflare）

**原則**: **テナント名が先**。現在の **`/seminars` を 4 つのテナント名に置き換え**、**各テナント名の下に、これまでと同じフォルダ構造をそのまま複製**する。管理・API も「テナント名の直下」に同じ形で複製する。

### 4.1 フォルダ構造の複製イメージ

現在の構成と、複製後の対応関係は次のとおり。

| 現在のパス | 複製後（テナント名が先、その下に同じフォルダ） |
|------------|-----------------------------------------------|
| `/seminars` | `/whgc-seminars`, `/kgri-pic-center`, `/aff-events`, `/pic-courses` |
| `/seminars/[id]` | `/whgc-seminars/[id]`, `/kgri-pic-center/[id]`, …（4 本） |
| `/seminars/[id]/booking` | `/whgc-seminars/[id]/booking`, …（4 本） |
| `/seminars/[id]/confirmation` | `/whgc-seminars/[id]/confirmation`, …（4 本） |
| `/seminars/[id]/manage` | `/whgc-seminars/[id]/manage`, …（4 本） |
| `/seminars/[id]/pre-survey`, `post-survey` | `/whgc-seminars/[id]/pre-survey`, …（4 本） |
| `/admin`, `/admin/seminars`, `/admin/reservations` など | `/whgc-seminars/admin`, `/whgc-seminars/admin/seminars`, …（4 本） |
| `/api/seminars`, `/api/bookings` など | `/whgc-seminars/api/seminars`, `/whgc-seminars/api/bookings`, …（4 本） |

- `/seminars` は **非表示**（404 またはリダイレクト）。上記の「現在のパス」は、4 つのテナント名に**入れ替わり**、フォルダ自体が 4 つに**複製**される。
- 実装: **テナント名が先**の 4 フォルダ（`app/whgc-seminars/`, `app/kgri-pic-center/`, `app/aff-events/`, `app/pic-courses/`）を用意し、その下に **現在の `app/seminars/` や `app/admin/`、`app/api/` と同じ階層・同じ名前**を並べる。動的 `[tenant]` は使わず、4 本をハードコードする。

### 4.2 公開サイト（フロント）

- 各テナントのトップ（例: `/whgc-seminars`）がセミナー一覧。その下に `[id]`, `[id]/booking`, `[id]/confirmation`, `[id]/manage`, `[id]/pre-survey`, `[id]/post-survey` を、現在の `/seminars` 配下と同様に複製する。
- 各テナントのページは「自分がどのテナントか」をパスから自明に持つ。API はそのテナント配下（例: `/whgc-seminars/api/...`）を呼ぶ。

### 4.3 管理画面

- 各テナントの直下に **admin** を置く。例: `/whgc-seminars/admin`, `/whgc-seminars/admin/seminars`, `/whgc-seminars/admin/reservations` など。現在の `/admin` 配下の構造を、テナント名の下にそのまま複製する。
- ログイン・権限はテナント単位で分離する。

### 4.4 API

- 各テナントの直下に **api** を置く。例: `/whgc-seminars/api/seminars`, `/whgc-seminars/api/bookings` など。現在の `/api` 配下の構造を、テナント名の下にそのまま複製する。
- 予約番号での検索は、各テナントの予約管理（例: `/whgc-seminars/[id]/manage`）で、そのテナントのマスターの「予約番号インデックス」のみを参照する。

---

## 5. コード変更の方向性

### 5.1 テナント設定の読み込み

- **新規**: `src/lib/tenant-config.ts` のようなモジュールを用意。
  - テナントキー（4つのいずれか）→ `{ masterSpreadsheetId, driveFolderId }` を返す。
  - 中身は上記の環境変数（`TENANT_*_MASTER_SPREADSHEET_ID`, `TENANT_*_DRIVE_FOLDER_ID`）を、**4テナント分の分岐または Map で取得**する（動的キー組み立ては避ける）。
  - 許可テナント一覧は `["whgc-seminars", "kgri-pic-center", "aff-events", "pic-courses"]` で固定。API の `[tenant]` はこのいずれかであることを検証してから使う。

### 5.2 スプレッドシート参照のテナント化

- **現状**: `getMasterSpreadsheetId()` が `process.env.GOOGLE_SPREADSHEET_ID` を返す。
- **変更**:
  - テナント用: `getMasterSpreadsheetId(tenant: string)` を新設し、`tenant-config` からそのテナントのマスターIDを返す。
  - 既存の `GOOGLE_SPREADSHEET_ID` は **master_folder 用**（従来開発成果）として残し、`/seminars` 非表示後は主に参照用や移行用に使うか、使わなければ削除してもよい。
- マスターを読むすべての API（セミナー一覧・予約・会員ドメイン・予約番号インデックスなど）は、**テナントを受け取り、getMasterSpreadsheetId(tenant) およびテナント用 Drive フォルダIDを使う**ように変更。

### 5.3 セミナー作成時の Drive フォルダ

- セミナー新規作成で「セミナー用スプレッドシート」を作る処理では、現在 `GOOGLE_DRIVE_FOLDER_ID` を使っている。
- テナント用では、そのテナントの `driveFolderId` を使うようにし、新規セミナー用シートは **そのテナント用フォルダ** に作成されるようにする。

### 5.4 ルーティングとリンク

- 公開: `app/seminars` は残し、`app/whgc-seminars/...`, `app/kgri-pic-center/...`, `app/aff-events/...`, `app/pic-courses/...` を **4つそれぞれハードコード**で追加する（動的 `[tenant]` は使わない）。
- `/seminars` は `app/seminars/page.tsx` で 404 またはリダイレクト。
- 各テナント配下のページでは、ヘッダー・フッターの「セミナー一覧」リンクはそのテナントのトップ（例: `/whgc-seminars`）にする。
- トップ `/` のリダイレクト先を、テナント選択ページやいずれか1テナント（例: `/whgc-seminars`）に変更するかは運用で決定。

---

## 6. 実装フェーズ案

| フェーズ | 内容 |
|----------|------|
| **0** | 設計書の確定（本ドキュメント）と Drive 上で 4テナント用フォルダ作成 |
| **1** | テナント設定モジュール（`tenant-config.ts`）と、テナント用 `getMasterSpreadsheetId(tenant)` / Drive フォルダ取得の追加 |
| **2** | API を各テナント配下に配置（`/whgc-seminars/api/...` の順番。`app/whgc-seminars/api/...` など）し、既存のマスター参照をテナント対応に変更 |
| **3** | 公開ページを 4テナント分ハードコードで追加（`app/whgc-seminars/...`, `app/kgri-pic-center/...`, `app/aff-events/...`, `app/pic-courses/...`）。`/seminars` は非表示（404 or リダイレクト） |
| **4** | 管理画面を各テナント配下（`app/whgc-seminars/admin/...` など 4 本）で追加し、テナント別ログイン・権限の検討 |
| **5** | 予約番号検索を各テナント配下（例: `/whgc-seminars/manage`）で対応し、必要に応じたフロントのテナント別カスタマイズ |

---

## 7. 補足：Drive 上で 4フォルダを作る手順

- 親フォルダ（「セミナー運営システム」など）の直下に、  
  `whgc-seminars`, `kgri-pic-center`, `aff-events`, `pic-courses` の 4フォルダを作成する。
- **スクリプトで作成する場合**  
  `.env.local` の `GOOGLE_DRIVE_FOLDER_ID` を「セミナー運営システム」のフォルダIDにしておき、  
  `npm run create-tenant-folders` を実行する。  
  または `npx tsx scripts/create-tenant-folders.ts <親フォルダID>` で親フォルダIDを直接指定できる。  
  実行後、表示される各フォルダIDを環境変数 `TENANT_*_DRIVE_FOLDER_ID` に設定する。
- **手動で作成する場合**: Drive で親フォルダを開き、上記4つの名前でフォルダを新規作成する。
- 各フォルダ内に「テナント用マスター」を1つずつ用意する方法:
  - **A**: 既存の master_folder 内の「予約管理マスター」をコピーし、各テナントフォルダに「予約管理マスター」として貼り付け。その後、中身（セミナー一覧シートの行など）を空にするか、初期データだけ残す。
  - **B**: 新規にスプレッドシートを4つ作り、マスターと同じシート構成（セミナー一覧・会員企業ドメイン・予約番号インデックス）とヘッダーを用意し、それぞれをテナントフォルダに配置。

作成した各マスターのスプレッドシートIDと、各テナントフォルダのフォルダIDを、上記の環境変数に設定します。

---

以上が、**master_folder に既存を保管したうえで、4テナントに分けて運用する**ための設計です。実装は上記フェーズに沿って進めるとよいです。

---

## 関連ドキュメント

- **批判的視点・セキュリティと実装リスク**: [`multi-tenant-security-and-risks.md`](./multi-tenant-security-and-risks.md)  
  実装の難しさ、セキュリティ上の懸念、モーダル／API パス周りの注意点を整理しています。
