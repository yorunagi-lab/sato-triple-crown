# 「みんなのエール」の保存先

GitHub Pagesに掲載したサイトから呼び出す、全利用者共通のエール累計APIです。Cloudflare WorkersとSQLite Durable Objectsを使用します。現在はコードのみで、Cloudflareへの配置とサイト側の接続はまだ行っていません。

## スマホで有効にする

1. 下の **Deploy to Cloudflare** を開き、Cloudflareにログインします。アカウントがない場合は作成します。
2. 表示された案内でGitHub連携・リポジトリ作成を進め、**Deploy** を実行します。この `backend` フォルダーを独立したWorkerとして配置します。
3. 成功画面に表示される `https://sato-cheers.〜.workers.dev` のURLを知らせてください。URL末尾に `/api/cheers` を付けてサイトに接続し、実際の累計を確認します。APIキー・パスワードを送る必要はありません。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/yorunagi-lab/sato-triple-crown/tree/main/backend)

CloudflareのWorkers FreeではSQLite Durable Objectsを利用できます。無料枠にはリクエスト・保存量などの上限があり、Freeの上限に達すると処理が失敗します。有料プランの契約はこの構成の必須条件ではありません。[公式の料金・上限](https://developers.cloudflare.com/durable-objects/platform/pricing/)

独自ドメインの取得は不要です。サイト本体はGitHub Pages、集計APIはCloudflareのHTTPS URLで動きます。

## 接続設定

配置が成功したら、サイトのリポジトリで `dist/cheer-config.json` を変更します。

```json
{
  "endpoint": "https://sato-cheers.YOUR-SUBDOMAIN.workers.dev/api/cheers"
}
```

`YOUR-SUBDOMAIN` は実際の公開URLに置き換えます。GitHub ActionsによるPages公開後、画面の表示が「みんなのエール」に切り替わります。共有累計は0から始まり、これまで各ブラウザに保存した端末内カウントは合算しません。

## 仕様

- GET `/api/cheers`：現在の累計 `{ "total": 0 }`。
- POST `/api/cheers`：UUID v4の `eventId` だけを受け取り、保存した累計を返します。
- GET `/health`：Workerの応答確認。DBの読み書き確認には `/api/cheers` を使います。
- 受付IDと累計を一つのトランザクションで保存。24時間以内の同じ受付IDによる再送を重複加算しません。
- 同じIP由来の新規リクエストは約1秒間隔に制限します。IPの日次ハッシュはメモリー上だけで保持し、DBにIPや利用者IDは保存しません。Workerのログ収集はこの構成では無効です。
- 許可Originは `https://yorunagi-lab.github.io`。`wrangler.jsonc` の `ALLOWED_ORIGIN` で変更できます。Origin確認はボットの完全な排除を保証するものではありません。
- 人数ではなく、受け付けたエールの累計です。通信結果が不明なときは同じ受付IDで1回だけ再試行します。
- データはDurable Objectに保存されます。通常の再配置では同じオブジェクトを使います。Worker・保存領域の削除や、オブジェクト名の変更には注意してください。

## PCから配置する場合

このフォルダーで以下を実行します。

```sh
npm ci
npx wrangler login
npm run deploy
```

ビルドだけを確認する場合は `npx wrangler deploy --dry-run`。サイトから切り離す場合は `dist/cheer-config.json` の `endpoint` を `null` に戻します。これは共有カウンターの削除やリセットを行いません。

## 確認済み・残る確認

ローカルSQLiteによる同時更新・重複防止・再起動時の保持・書込失敗時の巻戻しなど7テストと、Workerのビルドを確認しました。ブラウザでは模擬APIを使って共有表示・安全な再試行・失敗表示を確認しています。Cloudflare上の実際の永続化と複数端末での集計は、配置後に確認します。

[Cloudflareの配置ボタンの仕様](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
