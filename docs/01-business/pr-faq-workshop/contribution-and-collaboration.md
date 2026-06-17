---
title: Contribution and Collaboration Policy
category: business
created: 2026-06-18
last_updated: 2026-06-18
status: public_snapshot_candidate
---

# Contribution and Collaboration Policy

この文書は、ISMS Pilotの公開用リポジトリで、フィードバック、コントリビューター、協業、商用相談をどう受けるかを整理する。公開README、`CONTRIBUTING.md`、Issueテンプレート、問い合わせ導線へ転用できる粒度で管理する。

## 入口方針

ISMS Pilotは、Build in Publicの公開snapshotとして、次の種類の対話を歓迎する。

- ISMS実務者からのフィードバック。
- 業務SaaS、GRC、文書管理、監査運用に詳しい人からの設計レビュー。
- AI駆動開発に関心がある人からの質問や改善提案。
- 商用利用、個別導入、共同開発、別用途への活用相談。

一方で、公開snapshotはOSSではない。評価、閲覧、非商用検討のためのsource-available公開であり、商用利用、再配布、SaaS提供は事前許可制とする。

## 受け付けるもの

| 種別 | 推奨入口 | 受け付ける内容 |
| --- | --- | --- |
| Product feedback | GitHub IssueまたはDiscussion | 分かりにくい画面、ISMS実務との差分、ほしい導線、用語改善 |
| Bug report | GitHub Issue | 再現手順、期待結果、実際の結果、環境、スクリーンショット |
| Documentation improvement | Pull RequestまたはIssue | README、起動手順、FAQ、用語説明、誤字修正 |
| Code contribution | 事前Issue後のPull Request | 小さく独立した修正、テスト追加、明確なバグ修正 |
| Security concern | 公開Issueではなく指定の非公開連絡先 | 脆弱性、secret混入、権限漏れ、悪用可能な不具合 |
| Commercial inquiry | 指定の問い合わせ導線 | 商用利用、再配布、SaaS提供、共同開発、個別導入 |

公開READMEでは、実際の問い合わせ先が決まるまで `TODO: contact route` のような仮置きにせず、親リポジトリ側で確定した導線だけを載せる。

## 受け付けないもの

次は公開IssueやPull Requestでは受け付けない。

- 認証取得や審査合格の保証を求める依頼。
- 実顧客データ、個人情報、秘密情報を含む相談。
- セキュリティ脆弱性の詳細を公開Issueで共有する投稿。
- ライセンスに反する再配布、商用利用、SaaS提供を前提にした利用。
- 大規模な設計変更、価格、契約、SLA、法務条件の即時確約。
- AIエージェントの内部指示ログや非公開メモの開示依頼。

## Code contribution rules

外部コード貢献を受ける場合は、小さく、レビュー可能で、公開snapshotの目的に合う変更に限定する。

Pull Requestでは次を求める。

- 変更目的が1つに絞られている。
- 関連Issueまたは背景説明がある。
- secret、token、cookie、個人情報、実顧客データを含まない。
- 既存のスタック、ディレクトリ構成、文言境界に従う。
- 必要なlint、typecheck、test、public-copy QAの結果を記載する。
- 商用条件、法務条件、SLA、認証取得保証に関する文言を勝手に追加しない。

大きな機能提案は、Pull Requestより先にIssueまたはDiscussionで相談する。

## Commercial inquiry rules

商用相談は、公開Issueではなく指定の問い合わせ導線に分ける。

商用相談に含まれるものは次の通り。

- 商用利用。
- 再配布。
- SaaS提供。
- 個別導入。
- 共同開発。
- コンサルティングや実務運用支援との組み合わせ。
- 単一利用者向けに切り出した提供形態の相談。

商用相談では、公開README上で料金、契約条件、SLA、サポート範囲を確約しない。現時点では「事前相談が必要」と明記し、具体条件は個別に整理する。

## Security and sensitive information

セキュリティや秘密情報に関わる連絡は、公開Issueに書かない。

公開リポジトリ側には、少なくとも次を案内する。

- 脆弱性の可能性がある場合は公開Issueに詳細を書かない。
- secret、token、cookie、接続文字列、個人情報を投稿しない。
- 実顧客データを含むスクリーンショットやログを添付しない。
- 非公開連絡先が未確定の場合は、公開前に `SECURITY.md` またはREADMEの連絡導線を確定する。

## Public CONTRIBUTINGへ転用する短文

```markdown
## How to contribute

We welcome feedback from ISMS practitioners, SaaS builders, documentation reviewers, and people interested in AI-driven development. Please use Issues or Discussions for product feedback, documentation improvements, and small bug reports.

This project is source-available for evaluation and non-commercial review. It is not an open-source license for commercial use, redistribution, or offering a competing SaaS. Commercial use, redistribution, SaaS use, joint development, and private deployment require prior permission.

Do not post secrets, tokens, cookies, customer data, personal information, or vulnerability details in public Issues or Pull Requests. Security concerns should use the private security contact route defined for the public repository.
```

## 親が公開repoへ転用するときに決めること

- IssueとDiscussionのどちらを主入口にするか。
- 商用相談の問い合わせ先。
- security contact route。
- 外部Pull Requestを初回から受けるか、当面はIssue/Discussionだけにするか。
- ライセンス本文、README、`CONTRIBUTING.md`、`SECURITY.md` の公開版配置。

## 関連Backlog / Unknown

- `PRFAQ-BL-23`: コントリビューター/協業/商用相談の入口を整える。
- `U-22`: 外部コントリビューターや協業候補の受け入れ方。

この文書で入口方針の草案は作成済み。ただし、実際の問い合わせ先、security contact、公開Issue/Discussion運用、外部Pull Request受け入れ可否は、公開用リポジトリ側で確定する。
