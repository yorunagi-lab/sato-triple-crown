# 佐藤輝明｜三冠王への道

2026年セ・リーグの打率・本塁打・打点を追う非公式ファンサイト。三部門の暫定順位、首位との差、ライバル、残り試合の試算、直近10試合を表示します。画面と取得処理は独自実装です。球団・選手・NPBの公式サービスではありません。

## 現在の状態

- 実際に取得した成績データを同梱しています。取得日時・成績対象日は画面と `dist/data.json` で確認できます。
- 確認用サイトは初回取得データを表示する**確認版**です。常設の定期取得はまだ動いていません。
- GitHub Pages用の自動取得・検証・再公開ワークフローを同梱しています。以下の初回設定が完了し、Actionsが成功すると定期運用を開始できます。
- 独自ドメイン、別のレンタルサーバー、外部DB、APIキーは不要です。

## あなたが行う作業

### 必須：GitHub Pagesで常設運用を開始する場合

1. GitHubにログイン。未登録ならアカウントを作成します。
2. 公開リポジトリ `sato-triple-crown` を作成します。初期ブランチは `main`。PrivateではプランによりPages利用条件が変わるため、本手順はPublic前提です。
3. 配布ZIPを展開し、内容をリポジトリ直下にアップロードします。ZIPそのものをアップロードするのではありません。`.github/workflows/update-and-deploy.yml`、`dist/`、`scripts/`、`tests/` が必要です。`.github` が非表示で選べない場合は、GitHubの「Add file → Create new file」で `.github/workflows/update-and-deploy.yml` を作成し、同名ファイルの本文を貼り付けてください。
4. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定します。
5. **Settings → Actions → General → Workflow permissions** を **Read and write permissions** にして保存します。組織管理で変更できない場合は管理者の設定が必要です。
6. **Actions → Update stats and deploy → Run workflow → main → Run workflow** を実行します。Actionsが無効と表示される場合は有効化します。
7. 成功後、Settings → Pagesに表示されたURLを開きます。`確認版`の表示が消え、取得日時が新しくなっていることを確認します。

初回ファイル登録直後、Pages設定前に自動実行が失敗しても、4〜6を完了して再実行すれば確認できます。実行が赤く終了した場合は、失敗したステップの画面をこの会話に送れば原因を切り分けられます。

### 任意

- 独自ドメインを使う場合のみ、ドメイン取得・Pagesのカスタムドメイン・DNS設定が必要です。標準URLで始める場合は不要です。
- 文言・サイト名・配色の変更は公開後でもできます。
- データ取得元に利用条件や取得停止の指示がある場合はそれに従います。robots.txtの許可と転載等の許諾は別です。

## 更新の仕組み

GitHub Actions上のPython 3.12がbaseballdata.jpのHTMLから必要な数値だけを抽出し、`dist/data.json`に保存します。Python標準ライブラリだけで動作します。HTMLそのものは公開しません。

取得対象：打率ランキング、本塁打ランキング、打点ランキング、非規定打率ランキング、球団順位表、佐藤選手の成績詳細、全打席成績。robots.txtを含めて通常8リクエスト／回。ページ取得間には0.7秒間隔を置きます。通信障害は3秒後に1回のみ再試行。401・403・404・429は再試行しません。

更新目安（日本時間）：06:10、17:10、21:10、21:40、22:40、23:40、翌01:10。通常は1日56リクエスト＋必要な再試行です。手動実行・ソースの変更時にも取得します。GitHub側の混雑で遅延することがあり、取得元の更新前なら成績は変わりません。

自動更新を止める場合は Settings → Secrets and variables → Actions → Variables に `SCRAPING_ENABLED=false` を登録してワークフローを実行するか、ワークフロー自体を無効化します。長期の活動停止によりスケジュールが無効化された場合はActions画面で再有効化してください。

表示は5分ごと、およびページに戻ったときにJSONを再取得します。ブラウザから成績サイトへ直接スクレイピングする処理はありません。

## 順位と計算

- 打率は安打数／打数の分数を正確に比較します。小数3桁への丸めは表示だけです。
- 同率・同数は同順位（1位、1位、3位）です。
- 消化試合数時点の規定打席と、最終443打席を区別します。
- 不足打席を凡退として加算しても首位となる未到達者は、特例計算の候補に含めます。
- 佐藤選手は固定ID `2000051` の成績詳細から取得するため、規定到達やランキング移動だけでは取得できなくなりません。
- 打率・本塁打・打点の競合選手をすべて比較します。打率は現在値、本塁打・打点は所属球団の残り試合と今季の1試合平均で延長します。出場試合数で残り試合を計算しません。
- 試算は単独首位に必要な追加成績で、確率や確定条件ではありません。同数首位でもタイトル対象になり得ます。実際の正式表彰はNPBの発表を確認します。
- 2026年専用です。取得元が別年度に切り替わった場合は検証エラーにして2026年データを保持します。

## 障害時の挙動

ランキング同士、選手詳細、全試合ログの数字を照合します。ソースの更新途中などで一致しないときは、前回の正常なデータを残します。取得の成功・失敗は `fetch-status.json` に別保存し、失敗時の警告も公開します。元データの更新から30時間以上経過しても警告します。

定期更新が動いていてもライブ速報ではありません。画面の取得日時と成績対象日を確認してください。

## ローカルで確認する場合

```sh
python scripts/update_data.py --mode manual
python -m http.server 8000 --directory dist
```

ブラウザで `http://localhost:8000` を開きます。HTMLをファイルとして直接開くとJSON取得が制限されます。

検証（Python 3.12、Node.js 22）：

```sh
python -m unittest discover -s tests -v
node --test tests/logic.test.mjs
node scripts/check_static.mjs
```

## ファイル構成

- `dist/`：公開するHTML、CSS、JavaScript、JSONのみ
- `scripts/update_data.py`：取得・検証・保存
- `scripts/check_static.mjs`：公開ファイルとデータの確認
- `tests/`：順位・試算・障害時保持のテスト
- `.github/workflows/update-and-deploy.yml`：更新・検証・Pages公開

外部のフロントエンドライブラリ、アクセス解析、アカウント登録、応援の送信・集計は使用していません。

## 検証範囲

順位・打率の厳密比較・同順位・試算・取得失敗時の保持・取得停止・日時解釈の14テスト、およびHTMLの参照先・JavaScriptの構文・実データの整合性を確認しています。スマホ実機とブラウザでの目視・操作検証は未実施です。実験的WebMCP連携は対応実行環境がないため未検証で、通常の画面操作には必須ではありません。GitHubの定期実行とPages公開は、利用者アカウントでの初回設定後に確認してください。

参考：
- [GitHub Pagesの公開元設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [ワークフローの手動実行](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
