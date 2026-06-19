#!/usr/bin/env node
/**
 * Riscala AI for ISMS — マニュアル PDF 生成スクリプト
 *
 * Usage:
 *   node scripts/generate-manual-pdf.mjs                         # 00-common を生成
 *   node scripts/generate-manual-pdf.mjs --section 00-common     # セクション指定
 *   node scripts/generate-manual-pdf.mjs --all                   # 全セクション
 *   node scripts/generate-manual-pdf.mjs --file 01-getting-started.md  # 単一ファイル
 *   node scripts/generate-manual-pdf.mjs --outdir ./out          # 出力先変更
 */
import fs from 'fs';
import path from 'path';
import { PATHS, SECTIONS } from './manual-pdf/config.mjs';
import { markdownToHtml, extractTitle } from './manual-pdf/markdown-to-html.mjs';
import { renderPdfBatch } from './manual-pdf/pdf-renderer.mjs';

// ── CLI 引数パース ──────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    section: '00-common',
    file: null,
    outdir: null,
    all: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--section':
        opts.section = args[++i];
        break;
      case '--file':
        opts.file = args[++i];
        break;
      case '--outdir':
        opts.outdir = args[++i];
        break;
      case '--all':
        opts.all = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
Riscala AI for ISMS マニュアル PDF 生成

Options:
  --section <name>   セクション名 (デフォルト: 00-common)
  --file <name>      単一ファイル指定 (例: 01-getting-started.md)
  --outdir <path>    出力先ディレクトリ (デフォルト: dist/manuals/<section>)
  --all              全セクションを処理
  -h, --help         ヘルプを表示

Sections:
${Object.entries(SECTIONS).map(([k, v]) => `  ${k}  ${v}`).join('\n')}
`);
}

// ── メイン処理 ──────────────────────────────
async function processSection(sectionId, outdir) {
  const sectionDir = path.join(PATHS.docs, sectionId);
  const sectionLabel = SECTIONS[sectionId] || sectionId;

  if (!fs.existsSync(sectionDir)) {
    console.error(`✗ セクションディレクトリが見つかりません: ${sectionDir}`);
    return;
  }

  // Markdown ファイルを収集
  const mdFiles = fs.readdirSync(sectionDir)
    .filter(f => f.endsWith('.md') && !f.startsWith('README'))
    .sort();

  if (mdFiles.length === 0) {
    console.warn(`⚠ Markdown ファイルが見つかりません: ${sectionDir}`);
    return;
  }

  // 出力ディレクトリ作成
  const outPath = outdir || path.join(PATHS.outDir, sectionId);
  fs.mkdirSync(outPath, { recursive: true });

  console.log(`\n📄 ${sectionLabel} (${sectionId}) — ${mdFiles.length} ファイル`);
  console.log(`   出力先: ${outPath}\n`);

  // ジョブリスト作成
  const jobs = mdFiles.map(file => {
    const mdContent = fs.readFileSync(path.join(sectionDir, file), 'utf-8');
    const title = extractTitle(mdContent) || file.replace('.md', '');
    const html = markdownToHtml(mdContent, title, sectionDir);
    const pdfName = file.replace(/\.md$/, '.pdf');

    return {
      html,
      outPath: path.join(outPath, pdfName),
      chapterTitle: title,
    };
  });

  // バッチ PDF 生成
  const start = Date.now();
  await renderPdfBatch(jobs);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n✅ ${jobs.length} ファイル完了 (${elapsed}s)\n`);
}

async function processSingleFile(sectionId, fileName, outdir) {
  const sectionDir = path.join(PATHS.docs, sectionId);
  const filePath = path.join(sectionDir, fileName);

  if (!fs.existsSync(filePath)) {
    console.error(`✗ ファイルが見つかりません: ${filePath}`);
    process.exit(1);
  }

  const outPath = outdir || path.join(PATHS.outDir, sectionId);
  fs.mkdirSync(outPath, { recursive: true });

  const mdContent = fs.readFileSync(filePath, 'utf-8');
  const title = extractTitle(mdContent) || fileName.replace('.md', '');
  const html = markdownToHtml(mdContent, title, sectionDir);
  const pdfName = fileName.replace(/\.md$/, '.pdf');

  console.log(`\n📄 単一ファイル変換: ${fileName}`);

  await renderPdfBatch([{
    html,
    outPath: path.join(outPath, pdfName),
    chapterTitle: title,
  }]);

  console.log(`\n✅ 完了\n`);
}

// ── エントリーポイント ──────────────────────
async function main() {
  const opts = parseArgs();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Riscala AI for ISMS — マニュアル PDF 生成');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (opts.file) {
    await processSingleFile(opts.section, opts.file, opts.outdir);
  } else if (opts.all) {
    for (const sectionId of Object.keys(SECTIONS)) {
      const sectionDir = path.join(PATHS.docs, sectionId);
      if (fs.existsSync(sectionDir)) {
        await processSection(sectionId, opts.outdir ? path.join(opts.outdir, sectionId) : null);
      }
    }
  } else {
    await processSection(opts.section, opts.outdir);
  }
}

main().catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
