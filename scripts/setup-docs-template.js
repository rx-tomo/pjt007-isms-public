#!/usr/bin/env node
/*
  setup-docs-template.js
  ──────────────────────
  目的:
    - docs/ 配下の標準構成をスキャフォールド。
    - 02-project を「フラット命名（01–09=計画/10–19=運用/90–99=ログ）」に統一。
    - 任意で旧構成（01-planning/ 等）からの移行、参照パス更新、docs/README.md への構成説明の自動挿入に対応。

  前提:
    - Node.js 16+（推奨 18+/22+）。
    - リポジトリ直下から `node scripts/setup-docs-template.js` を実行。

  別プロジェクトでの利用（コピーして実行）:
    1) 対象リポジトリに `scripts/` が無ければ作成
         mkdir -p <TARGET>/scripts
    2) 本スクリプトをコピー
         cp scripts/setup-docs-template.js <TARGET>/scripts/
    3) 対象リポジトリのルートで実行
         cd <TARGET>
         # ドライラン
         node scripts/setup-docs-template.js --update-readme
         # 本実行（作成/変更を反映）
         node scripts/setup-docs-template.js --write --update-readme

    旧構成（01-planning/ 等）がある既存プロジェクトを新命名へ移行する場合:
         node scripts/setup-docs-template.js --write --migrate-legacy --update-refs --update-readme

  このリポジトリから別プロジェクトを直接指定して適用する例:
         node scripts/setup-docs-template.js --target ../other-repo --write --migrate-legacy --update-refs --update-readme

  オプション:
    --target <path>     対象リポジトリのパス（省略時: カレント）
    --write             変更を実行（未指定時は Dry-run で計画のみ表示）
    --migrate-legacy    旧構成 (01-planning/, 02-operations/, 03-logs/) を新命名へ移行
    --update-refs       docs 配下の md/yaml 内参照パスを新命名へ置換（安全な範囲で）
    --update-readme     docs/README.md に「ドキュメント構成ガイド」セクションを挿入/更新

  出力/挙動:
    - 実行ログは [docs-template] プレフィックスで表示（mkdir/create/rename/update 等）。
    - 既存ファイルは保持（idempotent）。必要な最小限のみ作成/更新。
    - docs/README.md に「ドキュメント構成ガイド」を挿入/更新 (--update-readme)
    - docs/02-project/README.md を生成（既存は保持）し命名規則を明示
    - handoff/.keep を生成し、空ディレクトリを維持。

  推奨運用:
    1) Dry-run で計画を確認（--write なし）
    2) --write で反映
    3) 変更を Git へコミット
       git add docs && git commit -m "docs: scaffold docs workspace + flat 02-project structure"
*/
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getFlag = (name, fallback=false) => args.includes(name) ? true : fallback;
const getOpt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i+1] ? args[i+1] : fallback;
};

const targetRoot = path.resolve(getOpt('--target', process.cwd()));
const write = getFlag('--write');
const migrate = getFlag('--migrate-legacy');
const updateRefs = getFlag('--update-refs');
const updateReadme = getFlag('--update-readme');

const log = (msg) => console.log(`[docs-template] ${msg}`);
const plan = [];

function ensureDir(p){
  if(!fs.existsSync(p)){
    plan.push({type:'mkdir', path:p});
    if(write) fs.mkdirSync(p, {recursive:true});
  }
}

function ensureFile(filePath, content){
  if(!fs.existsSync(filePath)){
    plan.push({type:'create', path:filePath});
    if(write) fs.writeFileSync(filePath, content, 'utf8');
  } else {
    plan.push({type:'keep', path:filePath});
  }
}

function moveIfExists(from, to){
  if(fs.existsSync(from)){
    ensureDir(path.dirname(to));
    plan.push({type:'rename', from, to});
    if(write) fs.renameSync(from, to);
  }
}

function replaceInFile(file, replacements){
  if(!fs.existsSync(file)) return;
  let txt = fs.readFileSync(file,'utf8');
  let changed = false;
  for(const [src, dst] of replacements){
    const re = new RegExp(src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    if(re.test(txt)){
      txt = txt.replace(re, dst);
      changed = true;
    }
  }
  if(changed){
    plan.push({type:'update', path:file});
    if(write) fs.writeFileSync(file, txt, 'utf8');
  }
}

// 1) 主要ディレクトリ
const docsDir = path.join(targetRoot, 'docs');
const projDir = path.join(docsDir, '02-project');
const handoffDir = path.join(docsDir, 'handoff');
ensureDir(docsDir);
ensureDir(projDir);
ensureDir(handoffDir);

// 2) 02-project フラット命名のひな形
const files = [
  ['01_roadmap.md', '# Roadmap\n\nこのドキュメントは長期計画の要約です。\n'],
  ['02_implementation-plan.md', '# Implementation Plan\n\n領域別の到達点・優先度・依存関係を記載します。\n'],
  ['03_user-journey.md', '# User Journey\n\n主要ペルソナとシナリオ、成果物を定義します。\n'],
  ['10_plan-tracking.md', '# Plan Tracking\n\n進捗、次の優先タスク、リスク/課題を集約します。\n'],
  ['11_walking-skeleton-plan.md', '# Walking Skeleton Plan\n\n最小スライス（縦断）の定義と検証項目を記載します。\n'],
  ['12_uc-checklist.md', '# Use Case Checklist\n\nユースケース単位のチェックリストと完了条件。\n']
];
files.forEach(([name, content])=>{
  ensureFile(path.join(projDir, name), content);
});

// 02-project README（命名規則と更新フローのテンプレ）
ensureFile(
  path.join(projDir, 'README.md'),
  `# 02-project 運用ガイド（フラット命名）\n\n`+
  `このディレクトリはサブフォルダを作らず、ファイル名の先頭番号で抽象度と着手順序を表現します。\n\n`+
  `- 01–09: 計画（高抽象）\n`+
  `- 10–19: 運用（スプリント/最小スライス）\n`+
  `- 90–99: ログ（履歴・スナップショット）\n\n`+
  `基本ひな形:\n\n`+
  `- 01_roadmap.md\n`+
  `- 02_implementation-plan.md\n`+
  `- 03_user-journey.md\n`+
  `- 10_plan-tracking.md\n`+
  `- 11_walking-skeleton-plan.md\n`+
  `- 12_uc-checklist.md\n`+
  `- 90_YYYY-MM-DD_progress.md など\n\n`+
  `更新フロー（推奨）:\n`+
  `1. 方針変更があれば 03 → 02 → 01 の順に反映\n`+
  `2. スプリント開始時に 10 を更新し、11/12 を同期\n`+
  `3. 進捗や検証結果は 90_* として新規ファイルで追加\n`+
  `4. 必要に応じて上流(01–03)へフィードバック\n\n`+
  `## 開発の考え方\n`+
  `このプロジェクトは新規事業×新規アプリケーションの 0→1 開発を前提とし、UI/UX を触りながら価値検証を進めることを重視します。Discovery と Delivery を並走させ、ウォーキングスケルトンで折り合いを付けます。\n\n`+
  `### 押さえる原則（セオリー）\n`+
  `1. **デュアルトラックアジャイル** — Discovery: 事業仮説→JTBD→プロト→検証。Delivery: 確度の高い要件から実装。\n`+
  `2. **ウォーキングスケルトン** — 認証/テナント/課金など価値の通り道を試験通電し、最薄スライスをエンドツーエンドで成立させる。\n`+
  `3. **アウトカム先行** — TTFV・継続率・有料転換率など KPI への寄与で優先度を判断。\n\n`+
  `### 現実的な折衷案\n`+
  `外部開発ベース＆バックエンド先行志向を尊重しつつ、UX 検証を止めない設計にします。\n\n`+
  `## 開発環境と本番環境\n`+
  `- Twelve-Factor の Environment Parity を重視し、ローカルと本番の差異を極小化。\n`+
  `- DB は Dump & Restore を基本とし、手作業での変更は禁止。\n\n`+
  `### 実務の型例\n`+
  `1. スキーマはマイグレーション管理（Drizzle 等）。\n`+
  `2. データは役割ごとに移す（スキーマのみ / 基準データのみ / イベント系除外）。\n`+
  `3. 昇格手順を固定化し、スクリプトや CI で一発化。\n\n`+
  `## 作成するもの（初期タスク）\n`+
  `1. 想定ロールを列挙する。\n`+
  `2. ロールごとに主要ユースケースを洗い出す。\n\n`+
  `## このプロジェクトで重視する運用方針\n`+
  `- **フェーズ基準の同期**: 03 → 02 → 01 を順に更新し、10_plan-tracking.md と整合させてから実装へ進みます。フェーズや優先タスクの変更はロードマップとトラッキングを同時に更新します。\n`+
  `- **ウォーキングスケルトン最優先**: 新機能は最小スライスで縦に通してから横展開します。11_walking-skeleton-plan.md で UC ID ごとのスライスを言語化し、12_uc-checklist.md で動作確認を記録します。\n`+
  `- **履歴の透明性**: 実績や検証結果は 90_YYYY-MM-DD_*.md を新規追加して凍結保存し、過去ファイルは編集しません。差分や補足は最新ログに追記します。\n`+
  `- **定期レビューとハンドオフ**: 週次レビュー/ハンドオフで 10_plan-tracking.md を更新し、未決事項は docs/01-business/business-requirements-open-questions.md と連携します。ハンドオフログは docs/handoff/ に時系列で残します。\n`+
  `- **ユースケース ID による会話**: 計画・開発・検証の各場面で UC ID を使い、仕様や検証観点を迷わず辿れるようにします。\n`
);

// 3) docs/README の雛形（既存があれば保持）
const docsReadme = path.join(docsDir, 'README.md');
ensureFile(
  docsReadme,
  `# Documentation Workspace Guide\n\nこのワークスペースは製品開発のドキュメントを体系化して保存します。\n`
);

// docs/README にディレクトリ構成セクションを追加/更新（オプション）
function renderDocsStructureSection(){
  return `<!-- docs-structure:start -->\n`+
`## ドキュメント構成ガイド\n\n`+
`### ディレクトリ一覧\n`+
"```\n"+
`docs/\n`+
`├── 01-business/\n`+
`├── 02-project/   # 01–09:計画, 10–19:運用, 90–99:ログ（フラット命名）\n`+
`├── 03-architecture/\n`+
`├── 04-development/\n`+
`├── 05-quality/\n`+
`├── 06-operations/\n`+
`├── 07-design-system/\n`+
`├── handoff/      # 日次/週次ハンドオフ（*.yaml）\n`+
`├── mockups/      # 画面モック、ワイヤーフレーム\n`+
`└── archive/      # 旧資料・実験メモ\n`+
"```\n\n"+
`### フォルダの役割\n`+
`- 01-business: 事業要件・市場/KPI・規制要件。\n`+
`- 02-project: 計画・運用・ログ。命名規則: 01–09=計画, 10–19=運用, 90–99=ログ。\n`+
`  - 例: 01_roadmap.md / 10_plan-tracking.md / 11_walking-skeleton-plan.md / 12_uc-checklist.md / 90_YYYY-MM-DD_progress.md\n`+
`- 03-architecture: システム設計、DB/RBAC、非機能要件、技術決定。\n`+
`- 04-development: コーディング規約、翻訳/命名/ディレクトリ方針。\n`+
`- 05-quality: テストケース、QAガイド、チェックリスト、自動テストの説明。\n`+
`- 06-operations: 環境セットアップ、デプロイ/運用手順、依存サービス設定。\n`+
`- 07-design-system: デザイン原則、トークン、UIコンポーネント指針、A11y。\n`+
`- handoff: 進捗・差分・未完項目を共有するハンドオフ（*.yaml）。\n`+
`- mockups: 画面モック/ワイヤー（HTML/PDF/画像）。\n`+
`- archive: 旧資料・廃止ドキュメント・実験メモ。\n\n`+
`### 更新フロー（推奨）\n`+
`- 方針変更→ユーザージャーニー→実装計画→ロードマップ→運用（plan-tracking）→ログの順で更新。\n`+
`- ログは追記ではなく新規ファイル（90_*）で履歴を残す。\n\n`+
`<!-- docs-structure:end -->\n`;
}

function upsertDocsReadmeSection(){
  const section = renderDocsStructureSection();
  let body = fs.readFileSync(docsReadme, 'utf8');
  const start = '<!-- docs-structure:start -->';
  const end = '<!-- docs-structure:end -->';
  if(body.includes(start) && body.includes(end)){
    const re = new RegExp(`${start}[\\s\\S]*?${end}`);
    body = body.replace(re, section);
  } else {
    if(!body.endsWith('\n')) body += '\n';
    body += '\n' + section;
  }
  plan.push({type:'update', path:docsReadme});
  if(write) fs.writeFileSync(docsReadme, body, 'utf8');
}

if(updateReadme){
  upsertDocsReadmeSection();
}

// 4) 旧構成→新命名への移行（任意）
if(migrate){
  const mappings = [
    ['01-planning/01_development-roadmap.md', '01_roadmap.md'],
    ['01-planning/02_process-implementation-plan.md', '02_implementation-plan.md'],
    ['01-planning/03_user-journey.md', '03_user-journey.md'],
    ['02-operations/01_development-plan-tracking.md', '10_plan-tracking.md'],
    ['02-operations/02_walking-skeleton-plan.md', '11_walking-skeleton-plan.md'],
    ['02-operations/03_uc-walking-skeleton-checklist.md', '12_uc-checklist.md'],
  ];
  mappings.forEach(([fromRel, toRel])=>{
    moveIfExists(path.join(projDir, fromRel), path.join(projDir, toRel));
  });
  // 日付ログも移動（03-logs/* → 90_YYYY-MM-DD_*.md）
  const legacyLogs = path.join(projDir, '03-logs');
  if(fs.existsSync(legacyLogs)){
    const items = fs.readdirSync(legacyLogs);
    items.forEach(fn=>{
      const m = fn.match(/^(\d{8})_(.+)\.md$/); // 20250609_dashboard-status.md 等を想定
      if(m){
        const yyyy = m[1].slice(0,4), mm=m[1].slice(4,6), dd=m[1].slice(6,8);
        const dst = `90_${yyyy}-${mm}-${dd}_${m[2]}.md`;
        moveIfExists(path.join(legacyLogs, fn), path.join(projDir, dst));
      }
    });
  }
}

// 5) 参照の置換（任意・限定的）
if(updateRefs){
  const replacePairs = [
    ['docs/02-project/01-planning/01_development-roadmap.md', 'docs/02-project/01_roadmap.md'],
    ['docs/02-project/02-operations/01_development-plan-tracking.md', 'docs/02-project/10_plan-tracking.md'],
    ['docs/02-project/02-operations/02_walking-skeleton-plan.md', 'docs/02-project/11_walking-skeleton-plan.md'],
    ['docs/02-project/02-operations/03_uc-walking-skeleton-checklist.md', 'docs/02-project/12_uc-checklist.md'],
    ['docs/02-project/03-logs/', 'docs/02-project/90_']
  ];
  // docs 配下の md / yaml を対象に置換
  const walk = (dir)=>{
    fs.readdirSync(dir).forEach(entry=>{
      const p = path.join(dir, entry);
      const stat = fs.statSync(p);
      if(stat.isDirectory()) return walk(p);
      if(/[.](md|yaml|yml)$/.test(p)) replaceInFile(p, replacePairs);
    });
  };
  walk(docsDir);
}

// 6) handoff/.keep（空ディレクトリ維持用）
ensureFile(path.join(handoffDir,'.keep'), '');

// 出力
log(`Target: ${targetRoot}`);
log(`Mode  : ${write ? 'WRITE' : 'DRY-RUN'}`);
plan.forEach(step=>{
  if(step.type==='rename') log(`rename: ${path.relative(targetRoot, step.from)} -> ${path.relative(targetRoot, step.to)}`);
  else log(`${step.type}: ${path.relative(targetRoot, step.path)}`);
});

if(!write){
  log('Dry-run完了。実行するには --write を付与してください。');
}
