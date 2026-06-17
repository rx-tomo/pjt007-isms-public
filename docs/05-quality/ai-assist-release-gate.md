# AI Assist Release Gate

- 対象: PRFAQ-BL-10 / AI-01〜AI-07
- 状態: internal_validation_gate
- 方針: AI支援は初期PR/FAQの主価値にせず、人手確認つきの後続補助機能として扱う。

## Gate Checklist

| Gate | Pass condition | Evidence |
| --- | --- | --- |
| input scope review | 機能ごとの入力範囲が `lib/ai/operations/inputScope.ts` とUI表示で一致する | `AIAssistantPanel` に送信対象情報を表示 |
| privacy review | 個人情報、添付本文、外部API送信が既定OFFである | `AISettingsPanel` の送信範囲設定 |
| human review UX | 提案は補助案として表示され、採用前に編集・却下できる | `AIAssistantPanel` の編集欄と採否操作 |
| auditability | 実行ログ、採否履歴、監査イベントを追跡できる | `ai_usage_logs`, `ai_suggestions`, `ai_assist.*` audit events |
| fallback | AI失敗時も既存業務フローが止まらない | `/api/ai/risks/analyze` はエラーをAI応答に閉じる |
| mock/prod parity | provider mode と model label を実行ログに残す | `provider_mode`, `model_label` columns |
| public copy boundary | AIを外向け主価値として過剰訴求しない | `npm run qa:public-copy` |

## Pre-release Result

現時点では internal validation gate として扱う。上記チェックがすべて自動/手動QAで確認されるまで、AI支援は顧客向けリリース機能ではなく後続補助機能に留める。
