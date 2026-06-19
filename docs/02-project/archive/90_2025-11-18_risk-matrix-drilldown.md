# 2025-11-18 リスクマトリクスのドリルダウン設計
作成者: Codex / 2025-11-18

## 目的
- `/ja/risks` のリスクマトリクス表は現在スコアと件数を表示するのみで、ユーザーは「(3)」が何件のどのリスクなのか把握できない。
- 件数をクリックして対象リスク一覧へ遷移できれば、ハイリスク領域を迅速に確認し対応策を指示できる。

## 現状
- `RiskMatrix` は `app/[locale]/risks/page.tsx` 内で直接描画。各セルは `div` で `data-impact` / `data-likelihood` / `data-risk-count` を持つが、クリックハンドラは無い。
- リスク一覧は同一ページ上部のテーブルに表示され、フィルタリングは `status`, `categoryId`, `departmentId`, `period`, `search` クエリを通じて行っている。
- ライブラリ的な状態管理は `useState` のみで、URL クエリにも `impact` / `likelihood` パラメータは存在しない。

## 提案
1. **クエリパラメータ拡張**  
   - `riskImpact` / `riskLikelihood`（または `matrixImpact`, `matrixLikelihood`）を URL パラメータとして追加。  
   - マトリクスセルをクリックすると該当パラメータを更新し、リスク一覧は `risks.filter(r => r.impact_level === impact && r.likelihood_level === likelihood)` で絞り込む。  
   - クリック時に `router.replace` でスクロールせずパラメータを更新し、`StatusFilterBanner` のような dismissible バナーでドリルダウン条件を表示（例: 「影響度 4 × 発生可能性 3 の 5 件を表示中」）。
2. **UI フィードバック**  
   - 選択中セルに `ring-2 ring-indigo-500` などの強調スタイルを付与。  
   - セル内要素を `<button>` に変え、`aria-label="影響度4 発生可能性3 のリスクを表示"` でアクセシビリティを確保。
3. **ハイリスク導線**  
   - マトリクス上部に「ハイリスクドリルダウン」ショートカットを設置し、`impact * likelihood >= 15` のセルを一括でフィルタ（`riskLevel=high` パラメータ）できるオプションも検討。
4. **データ構造**  
   - パフォーマンス懸念は限定的（すでに全件 `useState` にロード済み）。  
   - 将来的に API 側で集計／フィルタを行う場合に備え、`RiskService.getRisks` を impact/likelihood でフィルタできるよう拡張する余地をコメントに残す。
5. **QA / Analytics**  
   - Playwright テスト: `tests/e2e/risks-matrix.spec.ts` にセルクリック→一覧更新の検証を追加。  
   - `scripts/qa-risks-matrix.js` でも DOM snapshot に加え、`matrixImpact` パラメータが適用されているかを確認。  
   - クリックイベントを計測する場合は `posthog` 等のトラックを `aria` 属性と一緒に付与（任意）。

## タスク
- [x] `RisksPage` に `matrixImpact` / `matrixLikelihood` state & query パラメータを追加し、テーブルの `filteredRisks` に反映。（2025-11-16 以前実装済み）
- [x] マトリクスセルを `<button>` 化し、クリック時に state + query を更新、選択状態とスクリーンリーダー対応を実装。（2025-11-16 以前実装済み）
- [x] フィルタバナー（`StatusFilterBanner` 再利用可）を追加し、ドリルダウンを解除する UI を提供。（2025-11-16 以前実装済み）
- [x] QA スクリプト / プレイブック更新。（`tests/e2e/risks-matrix.spec.ts` でセルクリック・0件無効化・選択解除を検証済み）

## 実装状況（2025-12-24）
すべての機能が実装済み：
1. **クエリパラメータ拡張**: `matrixImpact` / `matrixLikelihood` がURLパラメータとして追加され、リスク一覧のフィルタリングに使用されている（line 47-50, 105-112, 262-268）
2. **マトリクスセルのインタラクティブ化**: 各セルが `<button>` として実装され、クリックでドリルダウンが可能（line 842-874）
3. **フィルタバナー**: `StatusFilterBanner` を使用してドリルダウン条件を表示し、クリアボタンで解除可能（line 631-637）
4. **0件セルの無効化**: `disabled` 属性と `aria-disabled` で対応（line 856-857）
5. **E2Eテスト**: `tests/e2e/risks-matrix.spec.ts` に以下のテストを追加
   - マトリクスセルクリックでリスクをドリルダウンできる
   - 0件のセルはクリック無効化される
   - 同じセルを再クリックすると選択解除される

### 関連ファイル
- **実装**: `app/[locale]/risks/page.tsx`
- **翻訳**: `messages/ja.json`, `messages/en.json` (line 1173-1183)
- **テスト**: `tests/e2e/risks-matrix.spec.ts`

## EARS 要件
1. **When** ユーザーがマトリクスセルをクリックしたとき、**the system shall** `matrixImpact` と `matrixLikelihood` クエリパラメータを URL に設定し、リスク一覧を該当セルのリスクに絞り込み、`StatusFilterBanner` に条件を表示する。
2. **When** マトリクスセルが選択されているとき、**the system shall** 当該セルを `aria-pressed="true"` の `<button>` としてレンダリングし、スコアと件数をスクリーンリーダーへ読み上げる。
3. **When** ユーザーがバナーの「条件をクリア」ボタンを押す、または別セルをクリックする、または URL パラメータを削除するいずれかを行ったとき、**the system shall** ドリルダウン状態を解除し、一覧を元のフィルタに戻す。
4. **When** セルの件数が 0 件のとき、**the system shall** クリックによるフィルタを無効化し（`disabled` 属性）、`aria-disabled="true"` で案内する。
