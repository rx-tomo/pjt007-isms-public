---
title: AI-Driven Development Public Policy
category: business
created: 2026-06-18
last_updated: 2026-06-18
status: public_snapshot_candidate
---

# AI-Driven Development Public Policy

この文書は、ISMS PilotをBuild in Publicで公開するときに、AI駆動開発として何を公開し、何を公開しないかを整理する。公開用リポジトリのREADME、記事、開発ログ、発信文へ転用できる粒度で管理する。

## 基本方針

ISMS Pilotは、オーナーがコードを直接書かず、AIエージェントと対話しながら設計、実装、検証、文書化を進めている業務アプリケーションである。

公開する主題は「AIが自動で完成品を作った」という宣伝ではない。公開する主題は、オーナーが事業判断、優先順位、レビュー、公開可否を担い、AIエージェントが実装、調査、QA、文書化を担う分業で、どこまで実用的な業務アプリを作れるかである。

そのため、公開物では次を分けて説明する。

- 人間が決めること: 目的、対象利用者、保証しないこと、商用利用条件、公開範囲、優先順位、受け入れ判断。
- AIエージェントが担うこと: 実装、修正、テスト、調査、文書化、差分整理、レビュー補助。
- 共同で確認すること: 実装とPR/FAQの整合、公開してよい証跡、未完成部分、品質ゲート、次の改善。

## 公開してよいもの

公開可能な証跡は、読者がプロダクトの現在地と開発スタイルを理解するためのものに限定する。

| 種別 | 公開方針 | 例 |
| --- | --- | --- |
| 開発方針 | 公開可 | AI駆動開発の役割分担、Build in Publicの目的、未完成部分の扱い |
| 成果物 | 公開可 | 公開用README、PR/FAQ、公開snapshotの設計説明、ロードマップ候補 |
| 検証結果 | 条件付き公開可 | lint/typecheck/build/test結果、secret scan通過、公開用QA結果 |
| 開発ログ | 要編集で公開可 | 何を依頼し、何が直り、どんな学びがあったかの要約 |
| 失敗例 | 要編集で公開可 | 失敗の種類、再発防止、AIに任せすぎない判断。ただし内部ログ全文は出さない |
| 未完成項目 | 公開可 | 商用提供前に必要な契約、SLA、サポート、公開CI、協業導線 |

公開時は、作業ログの全文ではなく、目的、判断、結果、残課題を読者向けに再編集する。公開用に編集した要約だけを正とし、内部スレッド、内部メモ、raw logを正本として公開しない。

## 公開しないもの

次は公開しない。公開用リポジトリ、記事、Issue、Discussion、SNS投稿のいずれにも載せない。

| 種別 | 非公開理由 |
| --- | --- |
| API key、token、cookie、secret、認証情報 | 不正利用や権限漏れにつながる |
| `.env.local`、本番/previewの設定値、接続文字列 | 実環境への攻撃面を広げる |
| 実顧客データ、個人情報、未匿名化の問い合わせ内容 | 個人情報・契約上の保護対象になり得る |
| 内部スレッド全文、AIへのraw指示、失敗ログ全文 | 秘密情報、内部判断、未検証の推測が混ざり得る |
| 非公開docs、handoff、内部運用runbook | 公開snapshotの説明に不要で、運用境界を崩す |
| 脆弱性詳細、悪用手順、未修正の攻撃経路 | 修正前のリスクを外部化する |
| 未確定の価格、契約条件、SLA、法務表現 | 商用約束と誤解される |
| 第三者ツール、ライセンス、規約に関わる未確認主張 | 権利・契約リスクがある |

公開する証跡に秘密情報が含まれていないことは、公開snapshot作成時のsecret scanと人手レビューで確認する。

## 証跡の出し方

公開証跡は、次の順に整理する。

1. 何を作ろうとしているかを書く。
2. AIエージェントに任せた作業と、人間が判断した作業を分ける。
3. 実装済み、検証済み、未完成、商用前に未決定の項目を分ける。
4. 検証コマンドや結果は、公開してよい範囲の要約として出す。
5. raw logではなく、読者が再利用できる学びとして編集する。

公開READMEや記事では、次のような表現に寄せる。

> ISMS Pilotは、オーナーが事業判断とレビューを担い、AIエージェントが実装、検証、文書化を担う形で開発しています。公開snapshotでは、完成品としてではなく、AI駆動開発で業務アプリを作る過程と現在地を共有します。

避ける表現は次の通り。

- AIが全自動で品質保証した。
- 人間の確認なしに業務アプリとして使える。
- 認証取得や審査合格を保証する。
- 商用SaaSとして本番運用を開始している。
- 公開されていない内部ログや設定も確認できる。

## 公開前チェック

公開前に最低限確認する。

- 公開snapshotにsecret、token、cookie、接続文字列が含まれていない。
- 内部docs、handoff、raw log、非公開メモが含まれていない。
- 顧客向け文言に内部用語や検証都合が混ざっていない。
- 商用開始、課金開始、SLA提供、認証取得保証と誤解される表現がない。
- 失敗例や学びは、個人情報・秘密情報・脆弱性詳細を除いた要約になっている。
- 公開するテスト結果は、実行日、対象、未実施項目を分けている。

## Public READMEへ転用する短文

```markdown
## AI-driven development

ISMS Pilot is built as a Build in Public experiment in AI-driven software development. The owner does not directly write application code. The owner sets product direction, requirements, priorities, review standards, and release boundaries, while AI agents help with implementation, research, testing, documentation, and quality review.

This repository is not presented as a finished commercial SaaS. It is a source-available evaluation snapshot that shows the current product direction, implementation state, known gaps, and the way human judgment and AI agent work are combined.
```

## 関連Backlog / Unknown

- `PRFAQ-BL-22`: AI駆動開発の公開方針を作る。
- `U-21`: AI駆動開発の公開範囲と証拠の出し方。

この文書で公開方針の草案は作成済み。ただし、実際に公開するログ、記事、README本文、スクリーンショット、公開snapshot範囲は、公開同期時に別途確認する。
