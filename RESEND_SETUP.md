# Resend メール送信機能のセットアップ手順

## 📧 概要

Resend を使用して、予約完了時とキャンセル時に自動でメールを送信する機能を実装しました。

### 実装済みの機能

1. **予約完了メール**
   - 予約確認
   - セミナー情報（タイトル、日時、予約ID）
   - Google Meet URL（オンライン開催の場合）
   - 事前アンケートへのリンク

2. **キャンセル確認メール**
   - キャンセル確認
   - セミナー情報（タイトル、予約ID）

## 🚀 セットアップ手順

### 1. Resend アカウントの作成

1. [Resend](https://resend.com/) にアクセス
2. 「Get Started」をクリックして無料アカウントを作成
3. メールアドレスを確認

### 2. APIキーの取得

1. Resend ダッシュボードにログイン
2. 左メニューから「API Keys」を選択
3. 「Create API Key」をクリック
4. 名前を入力（例: `event-registration-dev`）
5. 「Full Access」を選択
6. 生成されたAPIキーをコピー（**このキーは一度しか表示されません！**）

### 3. 環境変数の設定

`.env.local` ファイルを開いて、以下の値を設定します：

```bash
# Resend (メール送信)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx  # ← ここに取得したAPIキーを貼り付け
RESEND_FROM_EMAIL=contact@allianceforum.org   # ← 送信元メールアドレス
```

**注意:** 最初は `onboarding@resend.dev` から送信されます（テスト用）。独自ドメインを使用するには、次のステップに進んでください。

### 4. ドメインの認証（本番環境用）

独自ドメイン（`contact@allianceforum.org`）からメールを送信するには、ドメイン認証が必要です。

#### 4-1. Resend でドメインを追加

1. Resend ダッシュボードで「Domains」を選択
2. 「Add Domain」をクリック
3. `allianceforum.org` を入力
4. DNSレコードが表示されます

#### 4-2. DNS レコードを追加

Resend が表示する以下のDNSレコードを、ドメインのDNS設定に追加します：

**SPF レコード (TXT):**
```
Type: TXT
Name: @
Value: v=spf1 include:amazonses.com ~all
```

**DKIM レコード (TXT):**
```
Type: TXT
Name: resend._domainkey
Value: (Resend が提供する値)
```

**DMARC レコード (TXT):**
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@allianceforum.org
```

#### 4-3. 認証の確認

1. DNSレコードを追加後、数分〜数時間待つ
2. Resend ダッシュボードで「Verify」をクリック
3. 認証が成功すると、ステータスが「Verified」になります

#### 4-4. 環境変数を更新

`.env.local` の `RESEND_FROM_EMAIL` を更新：

```bash
RESEND_FROM_EMAIL=contact@allianceforum.org
```

## ✅ テスト方法

### 1. 開発サーバーを起動

```bash
npm run dev
```

### 2. 予約を作成してメールをテスト

1. フロント画面 (`http://localhost:3000`) にアクセス
2. 公開中のセミナーを選択
3. 予約フォームに**自分のメールアドレス**を入力して送信
4. メールボックスを確認

### 3. メールが届かない場合の確認事項

#### コンソールログを確認
```bash
# ターミナルで以下のようなログが出ているか確認
[Email] Reservation confirmation sent to your@email.com
[Booking] Confirmation email sent to your@email.com
```

#### エラーログを確認
```bash
# エラーが出ている場合、以下のようなログが表示されます
[Email] Failed to send reservation confirmation: Error: ...
```

#### よくあるエラー

**1. `Missing API key`**
- 原因: `RESEND_API_KEY` が設定されていない
- 解決: `.env.local` に正しいAPIキーを設定

**2. `Validation error: "to" is required`**
- 原因: メールアドレスが正しく渡されていない
- 解決: フォームのメールアドレス入力を確認

**3. `Domain not verified`**
- 原因: ドメイン認証が完了していない
- 解決:
  - テスト段階: `RESEND_FROM_EMAIL=onboarding@resend.dev` を使用
  - 本番環境: ドメイン認証を完了させる

## 📊 送信制限

### 無料プラン
- **月間送信数**: 3,000通/月
- **1日の送信数**: 100通/日
- **送信先**: 認証済みドメインのみ

### 有料プラン
- **月間送信数**: 50,000通/月 ($20/月)
- **1日の送信数**: 無制限
- **送信先**: 任意のメールアドレス

## 🔐 セキュリティ

- `.env.local` ファイルは **絶対にGitにコミットしない**
- `.gitignore` に `.env.local` が含まれていることを確認
- APIキーは安全に保管

## 📝 メールテンプレートのカスタマイズ

メールの内容を変更したい場合は、以下のファイルを編集してください：

```
src/lib/email/resend.ts
```

- `sendReservationConfirmation()` - 予約完了メール
- `sendCancellationNotification()` - キャンセル確認メール

## 🚨 トラブルシューティング

### メールが迷惑メールフォルダに入る

- SPF/DKIM/DMARC レコードが正しく設定されているか確認
- `onboarding@resend.dev` から送信している場合は、独自ドメインに切り替える

### メール送信が遅い

- Resend は通常数秒以内に送信されます
- 遅い場合は、Resend のステータスページを確認: https://status.resend.com/

### 本番環境でメールが送信されない

- `RESEND_API_KEY` が本番環境の環境変数に設定されているか確認
- Vercel などのホスティングサービスの環境変数設定を確認

## 📚 参考リンク

- [Resend 公式ドキュメント](https://resend.com/docs)
- [Resend API リファレンス](https://resend.com/docs/api-reference/introduction)
- [Next.js + Resend ガイド](https://resend.com/docs/send-with-nextjs)
