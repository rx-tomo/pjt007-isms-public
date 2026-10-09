# 公開デモの説明・導線とSEO案の再評価（2026-10-09）

## 対象と提供範囲

対象は公開 `rx-tomo/pjt007-isms-public`、基点は `c27f939d26d9c24c64de266fdd82f81505dd09be`。private リポジトリのコード同期は行わない。
READMEの提供範囲（架空データによる研究・評価用デモ、実ユーザー登録不可、商用ローンチではない）に公開ページを合わせる。
認証・課金の実装、契約、メール送信、外部サービス、計測イベント、定期監視の範囲は追加しない。

## 変更前後とユーザーの導線

| 場所 | 変更前 | 変更後 |
|---|---|---|
| ホームの手順 | アカウント作成→14日間無料トライアル、専門サポートの表示 | 架空組織・役割を選ぶ→画面操作→ガイドや任意の研究参加 |
| ホームの機能・FAQ | コンサル不要、全プラン全機能、API連携等の商用説明 | 現在のデモで確認できる範囲と、登録・契約・AI・認証保証の境界 |
| ヘッダー | 通常ログイン・料金ページへの誘導、他ページで機能/FAQアンカーが空振り | 公開デモを主導線にし、ホームの機能/FAQへ戻れるリンク、ホームに戻れるロゴ |
| デモ入口 | 開発環境専用のバッジ、通常ログインへ戻るリンク | 研究・評価用公開デモと明示、ホームへ戻るリンク、共有・初期化・機密入力禁止の説明 |
| 記事末尾 | 5問チェックへの単一CTA | 架空データで操作するデモと、簡易セルフチェックを選べるCTA |
| セルフチェック結果 | 結果帯→公開GitHub研究フォームのみ | 結果帯→関連記事・デモ。公開研究フォームは任意の別選択 |
| フッター | 未実装ページへのリンク7種類 | 存在するデモ・ガイド・セルフチェック・公開概要・GitHubへ |
| canonical | ホーム以外の公開ページは相対URLとして出力 | 共通metadataBaseにより本番originの絶対URLとして出力 |

主な流れ：検索→既存ガイド記事→公開デモ（架空データのみ）または5問チェック→結果帯に応じた記事／デモ。
結果帯の関連記事：探索中=取得手順・リスク、準備中=文書・Annex A、運用中=Annex A・リスク。
研究参加を選ぶ場合だけ、固定選択中心の既存公開GitHubフォームへ進む。
GitHub投稿は公開かつアカウントと関連付くこと、個人情報・内部文書・リスク台帳・証跡・機密情報を投稿しないことを表示する。

## 旧案の採否・撤回履歴

公開mainには費用・取得手順・リスク・文書・Pマーク・Annex Aの6記事がある。
記事不足を前提とした大量追加や、9月末案を適用済みとする主張は行わない。

| 案／出所 | 判断 | 根拠・扱い |
|---|---|---|
| 9/30旧候補 `e58ff1e`（未push）：未実装フッターリンク除去。依頼元から内容を受領 | 採用し再実装 | 現公開mainの `app/[locale]` には `/about` `/privacy` `/terms` `/help` `/docs` `/status` `/cookies` のページがなく、フッターはこれらにリンクしている。現状で存在するリンクを残して置き換える。旧コミットの一括適用はしない |
| 9/11バックログ：研究結果から関連記事へ | 採用 | 結果を読んだ次の行動が既存記事・デモになる。新規記事やサービス不要 |
| 同：結果からトライアルへ | 撤回 | 実ユーザー登録・商用トライアルは未提供。公開デモへ変更 |
| 同：ランディングFAQ4問からSEO記事へ一律リンク | この形は撤回 | 今回のFAQはデモの提供範囲を説明する必要がある。一般実務へのリンクは記事・結果・ガイドに置く |
| 同：記事OG画像 | 保留 | 有効性を否定したわけではない。説明と到達先の整合を優先する今回の修正には含めない |
| 附属書Aを一覧だけでなく実務へ（依頼元の優先候補） | 採用 | 一覧は既存。適用理由・条件付き除外理由・未実施時の担当/期限・証跡の架空例を追加し、実データ投稿を求めない |
| 5問チェックで93管理策の説明可能範囲が分かるという既存本文 | 撤回・修正 | 実装は5問の合計による3帯分類のみで管理策別評価を行わない |
| 費用記事の「6構成要素」と9行の表 | 修正 | 見出し・本文を9項目に一致させ、外部支出と内部工数を分ける |
| 出典のない全国相場・人数別総額・割合・標準工数という既存本文 | 撤回・置換 | 算出範囲・内部工数含有が不明で、一般相場として裏づけられない。個別見積もりのチェック項目と、相場ではない架空の120時間×3,000円の計算例に置換 |

無関係のファイル、旧履歴、他のブランチは削除しない。取得できない旧PRや候補全体の確認済みとは主張しない。

## 内容の一次情報

- [JQA ISO/IEC 27001公式FAQ](https://www.jqa.jp/service_list/management/service/iso27001/faq.html)：対象人員・事業所数等に応じた個別料金の算出。全国相場の根拠として扱わない。
- [JQA見積依頼案内](https://www.jqa.jp/service_list/management/estimate/index.html)：ISO/IEC 27001の見積依頼資料と確認手順。
- [ISO ISO/IEC 27001](https://www.iso.org/standard/27001)、[ISMS-AC制度概要](https://isms.jp/isms/about.html)：2022年版とAmd 1:2024の現行情報。
- Annex Aの例は独自の架空例。規格の逐語引用や、自社への適用・除外・適合性の保証を行わない。

## 評価の限界

変更の有効性は、提供実態との一致、到達先の存在、検索意図に対する本文の具体性で評価する。
現状のアクセス・検索データは小標本で期間重複もあり、SEO成功や改善率は断定しない。
公開後のCTRや行動変化は別途確認が必要で、自動監視やイベント追加は行わない。

## 受け入れ条件と再実行

- ja/en/zhの主要公開ページ33件でHTTP 200、title/description/canonicalを確認。
- robotsとsitemap、Article JSON-LD、デモ入口と料金ページのnoindexを確認。
- 1440×1000 / 390×844でホーム、記事CTA、チェック3結果帯、関連記事、デモ入口、戻る・リスタートを確認。
- 費用表9項目、Annex A既存93管理策＋架空3例を確認。横スクロールは表の内側に収まりページ全体がはみ出さないこと。
- 認証・課金・外部フォーム送信を行わず、ローカルの架空fixtureを使う。

```sh
npm run lint
npm run typecheck
npm run lint:messages
npm run qa:public-copy
npm run qa:public-metadata
npm run build
# ローカル開発サーバーと架空fixtureの準備後：
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium REVIEW_OUTPUT_DIR=/tmp/riscala-review-evidence node scripts/qa-public-guidance.mjs
```

検証時は `NEXT_PUBLIC_APP_URL=https://riscala-ai.com` とし、計測タグを有効にしない。
通常buildがGoogle Fontsの取得で失敗する環境では、テスト専用の `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` を使ったビルドを別の結果として記録する。配信フォントや通信制限は変更しない。

## この環境での検証結果

- `lint`：エラー0、既存警告3件。変更していない `ProjectStructureManager.tsx`、`test-notifications.js`、`test-settings.js` の未使用eslint-disable指示。
- `typecheck`、翻訳キー/ICU検査、公開コピー検査、公開metadata検査：成功。
- ブラウザQA：成功。公開ページ33件、robots/sitemap、JSON-LD、noindex境界、3結果帯、desktop/mobileのCTA・戻る・リスタートを確認。
- 通常build：Google FontsのInter/Noto Sans JP取得失敗で停止。テスト専用フォント応答を使ったbuildは成功。Google Fonts、middleware規約の既存警告・外部接続条件を変えない。
- 画面証拠：ローカル `/tmp/riscala-review-evidence/` にhome/cost/research/annexの1440px/390px画像と `checks.json`。公開リポジトリには生成画像・ローカルDBを含めない。
- 本番 `https://riscala-ai.com/`：CONNECT 403。CLIのGitHub GraphQL照会：403。通信拒否を迂回せず、本番HTTP・本番デモ・既存PRの再照会は未確認。
- GitHubコネクターの標準readは成功し、CLIの403は再現しなかった。Draft [PR #21](https://github.com/rx-tomo/pjt007-isms-public/pull/21)を作成。mainは未変更で独立レビュー待ち。本番CONNECTの拒否を迂回する通信設定変更は行っていない。

ローカルDB準備では既存provisionスクリプトが `DBP_VERIFY_FAILED`、schema全ファイル指定が同名index重複で失敗した。検証専用の新規temp DBをschemaの単一export入口 `lib/db/drizzle/schema/index.ts` から作成し、既存の架空fixtureをseedしてブラウザ検証した。DB機能・schema・provisionスクリプトは変更していない。これはローカル検証環境の準備結果であり、本番DBを変更したものではない。
