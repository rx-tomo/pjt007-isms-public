作成日: 2025-10-01 (tom)
更新日: 2025-12-01
記録者: Codex

# PJT007 Design System

## 1. 概要
- 目的: ブランドらしさと操作性を担保しつつ、UI実装を再利用可能なコンポーネントに集約する。
- コア原則: 可読性、階層構造の明瞭さ、日英バイリンガル対応、低コストな拡張性。
- 基盤: Next.js + Tailwind CSS。Tailwindのテーマ拡張とCSSカスタムプロパティを併用してトークンを管理する。

## 2. デザイントークン
### 2.1 カラー
| トークン | 値 | 用途 | 定義元 |
| -------- | --- | ---- | ------ |
| `--primary-*` | ブルー系 (#eff6ff〜#1e40af) | ブランド/アクション | `app/globals.css`
| `--secondary-*` | スカイ系 (#f0f9ff〜#0369a1) | セカンダリアクション | `app/globals.css`
| `--secondary-foreground` | #ffffff | セカンダリ文字色 | `app/globals.css`
| `--color-success-*` | グリーン系 | 成功状態 | `app/globals.css`
| `--color-warning-*` | アンバー系 | 注意喚起 | `app/globals.css`
| `--color-error-*` | レッド系 | 警告/破壊的操作 | `app/globals.css`
| `--muted`, `--muted-foreground` | #f3f4f6 / #6b7280 | 補助的な面・文字色 | `app/globals.css`
| `--border`, `--card-background`, `--background` | #e5e7eb / #ffffff / #f8fafc | レイアウト面 | `app/globals.css`

### 2.2 タイポグラフィ
- フォント: Inter (ラテン), Noto Sans JP (日本語) を`app/layout.tsx`でCSS変数 (`--font-inter`, `--font-noto-sans-jp`) にバインド。
- フォントスケール: `--font-size-sm` 〜 `--font-size-2xl` を`app/globals.css`で提供し、ボタンなどのコンポーネントから参照。

### 2.3 スペーシング & コーナー
- 主要スペーシング: `--spacing-1`〜`--spacing-8` (4px〜32px相当)。
- 隅丸: `--radius-md`, `--radius-lg`, `--radius-full`。
- 影: `--shadow-sm`, `--shadow-lg` をカードやナビゲーションで共有。

### 2.4 アニメーション
- Tailwindテーマで`fade-in`/`slide-in`キーフレームを定義 (`tailwind.config.ts`)。
- ボタンのローディングスピナーやトグル操作はコンポーネント内でCSS変数を参照して実装。

## 3. コンポーネントカタログ
| コンポーネント | バリエーション | 備考 |
| -------------- | ------------- | ---- |
| `Button` (`components/ui/Button.tsx`) | `variant`=primary/secondary/outline/ghost/danger/success, `size`=sm/md/lg, loading/アイコン対応 | トークン化したCSSカスタムプロパティを利用。旧実装は整理済み。
| `Badge` (`components/ui/Badge.tsx`) | variant 7種, size sm/md/lg, dot/count | 背景・文字色を全てトークンへ委譲。
| `Card` (`components/ui/Card.tsx`) | variant=default/bordered/elevated, padding=none〜xl | 背景/枠/影をトークン化し、文字色も共通トークンを参照。
| `Table` (`components/ui/Table.tsx`) | variant=default/bordered/striped, size sm/md/lg, responsive | `striped`バリアントをトークンベースのスタイルで実装。ローディング・空状態あり。

## 4. レイアウトパターン
- ダッシュボードシェル（サイドバー、ヘッダー）は`app/globals.css`に定義したユーティリティクラスで共通化。
- ナビゲーションや設定ページは`var(--spacing-*)`/`var(--radius-*)`などのトークンを直接参照する`style jsx`パターンを採用。
- ダッシュボードのヒーロー／統計カードは `app/[locale]/home/page.tsx` で定義した `HomeHero` / `StatGrid` / `QuickLinksSection` を利用し、
  - グラデーション背景 + ロールバッジ + プラン情報という「Hero」パターンを共通化
  - 統計カードは `tone` プロパティでブランドカラーを切り替え、シャドウや角丸をトークンに準拠
  - 役割別ショートカットは `quickLinks` 定義を参照し、翻訳キーで内容を差し替える
 これによりウォークスルー時の情報取得・遷移導線を標準化した。

## 5. アクセシビリティ & 多言語
- `components/LocaleProvider.tsx`で`<html lang>`とフォントクラスをロケールに応じて切り替え。
- インタラクティブ要素は`aria-*`属性を順次整備中。チェックリストの追加とQAを推奨。

## 6. 今後の課題
1. ダークモード用トークンとコンテンツ側の切り替えポリシーを定義する。
2. 既存ページで残存する旧Tailwind色クラスを段階的にトークンへ置換する。
3. 状態アイコンやフィードバックメッセージの文言/カラーアクセシビリティ検証を行う。
4. 期間/状態表示・デモデータ方針などの共通 UI ガイドラインを `ui-guidelines.md` で継続管理し、実装前に参照する。

## 7. 画面インベントリと遷移マップ
- 役割別ユースケースと KPI、必要画面、RBAC/URL/状態、Mermaid での遷移図、実装フェーズ割付、バックログ連携、E2E 観点をまとめました。
- ドキュメント: `docs/07-design-system/ui-screens-and-flows.md`

## 8. 共通 UI ガイドライン
- レビュー第2回の指摘に基づき、期間セレクターやステータスフィルタ、検証用ダミーデータの方針を `docs/07-design-system/ui-guidelines.md` にまとめた。UI 改修時は同ドキュメントを更新しながら利用すること。

## 9. Storybook 運用
- 2025-11-13 時点で Storybook v1 を整備し、`stories/ui/*.stories.tsx` に Button / Badge / Card / Table などの代表 UI を登録した。`stories/design-system/DesignTokens.stories.tsx` はカラーパレット・タイポグラフィ・アクセシビリティ指針を可視化する参照ページとして扱う。
- 開発時は `npm run storybook` でポート 6006 へ起動し、CI/デプロイ前のスモークテストとして `npm run storybook -- --smoke-test` を利用する。
- 静的アセットは `npm run build-storybook` で `storybook-static/` に生成し、デザインレビューや外部共有に利用できる。生成済みアセットを docs/ evidence に添付する場合はバージョンとブランチを必ず記録すること。
- Lint/型検査と同列で Storybook の差分確認を QA チェックリストへ追加し、主要 UI を改修した際は該当ストーリーを更新する。新規コンポーネントを作成した場合は最小限の stories（Playground + バリエーション）を追加すること。
