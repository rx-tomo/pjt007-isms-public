# ISMS体制モデル（200名規模/5-10組織想定）

## 想定企業像
- 従業員: 約200名
- 組織: 5〜10部門
- 各部門: 組織長 + 作業員1〜3名

## 役割と呼称
- **ISMS推進事務局** = org_admin（実務責任者、複数可）
- **ISMS推進委員** = user（現場作業者）
- **CISO** = org_adminの中で唯一の存在
- **監査員** = 事務局または推進委員から選出
- **system_operator** = 情シス的な設定担当

## 初期構成フロー
1. system_operator が初期の org_admin を1名設定
2. org_admin が部門・ユーザーを登録
3. 体制全体を「役割一括割当UI」で設定
4. 体制スナップショットを保存（運営体制の記録）

## 必要なUI（追加）
- **体制一括割当UI**
  - 部門 × ユーザー の一覧をチェックボックスで管理
  - ロール割当（org_admin/user/approver/auditor）を一画面で設定
- **体制スナップショット**
  - 「運営体制」の履歴を保存し比較可能にする

## 詳細設計（実装計画へ紐付け）

### 体制一括割当UI（画面）
- 画面: `/:locale/settings/structure`
- 機能:
  - ユーザー一覧と部門/ロールの一括編集
  - チェックボックスでロール付与（複数可）
  - 監査員/承認者の候補者選定

### 体制スナップショット
- `organization_structure_snapshots`
  - id, organization_id, created_by, created_at
  - snapshot_name, snapshot_payload(json)
- スナップショットは「現時点の体制」を保存して比較可能

### CISO 一意性
- org_admin の中で1名だけ `is_ciso = true`
- UIで切り替え時は既存CISOを自動解除

### 実装タスク（概要）
1. DB: snapshot 테이블 + user_profiles に `is_ciso`
2. API: 体制取得/更新/スナップショット作成
3. UI: 体制編集 + スナップショット履歴
4. テスト: CISO一意性/ロール割当/履歴保存

## 目的
- 登録数が20〜30名程度でも管理負荷を下げる
- 監査/承認/実施体制を俯瞰できる状態にする
