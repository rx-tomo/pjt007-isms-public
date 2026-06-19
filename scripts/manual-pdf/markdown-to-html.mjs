/**
 * Manual PDF 生成 — Markdown → styled HTML 変換
 */
import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import { buildStyles } from './styles.mjs';

// ── marked 設定 ──────────────────────────────
marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * blockquote 内の「ヒント」「準備中」を検出してクラスを付与
 */
function classifyBlockquotes(html) {
  return html.replace(/<blockquote>/g, (match, offset) => {
    // blockquote 直後の内容を先読み
    const after = html.slice(offset, offset + 300);
    if (/準備中/.test(after)) {
      return '<blockquote class="wip">';
    }
    if (/ヒント/.test(after)) {
      return '<blockquote class="hint">';
    }
    return '<blockquote class="hint">';  // デフォルトは hint
  });
}

/**
 * 言語指定のないコードブロックを ASCII art として扱う
 * marked は言語指定なしの場合 <code> にクラスを付けないので、
 * その場合に親 <pre> に .ascii-art を付与
 */
function classifyCodeBlocks(html) {
  // <pre><code> (no class) を <pre class="ascii-art"><code> に
  return html.replace(
    /<pre><code>(?!\s*<span)/g,
    '<pre class="ascii-art"><code>'
  );
}

/**
 * 相対パスの画像を base64 データ URI に埋め込む
 */
function embedImages(html, mdDir) {
  if (!mdDir) return html;
  return html.replace(/<img\s+src="([^"]+)"/g, (match, src) => {
    if (src.startsWith('http') || src.startsWith('data:')) return match;
    const imgPath = path.resolve(mdDir, src);
    try {
      const buf = fs.readFileSync(imgPath);
      const ext = path.extname(imgPath).slice(1).toLowerCase();
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      const b64 = buf.toString('base64');
      return `<img src="data:${mime};base64,${b64}"`;
    } catch {
      console.warn(`⚠ 画像が見つかりません: ${imgPath}`);
      return match;
    }
  });
}

/**
 * Markdown テキストを完全な HTML ドキュメントに変換
 * @param {string} md  - Markdown 原文
 * @param {string} title - ドキュメントタイトル（h1 から抽出）
 * @param {string|null} mdDir - Markdown ファイルのディレクトリ（画像埋め込み用）
 * @returns {string} - 完全な HTML 文字列
 */
export function markdownToHtml(md, title = '', mdDir = null) {
  let html = marked.parse(md);

  // 後処理
  html = classifyBlockquotes(html);
  html = classifyCodeBlocks(html);
  html = embedImages(html, mdDir);

  const css = buildStyles();

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * Markdown ファイルの先頭 h1 からタイトルを抽出
 */
export function extractTitle(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
