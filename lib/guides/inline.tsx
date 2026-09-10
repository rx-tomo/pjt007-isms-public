import Link from 'next/link';
import type { ReactNode } from 'react';

/** `[text](href)` と `**bold**` だけを扱う最小のインライン記法 */
const INLINE_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;

function isInternalHref(href: string): boolean {
  return href.startsWith('/');
}

/**
 * 記事本文のインライン記法を React ノードへ変換する。
 * 内部リンク（'/' 始まり）にはロケール接頭辞を付ける。
 */
export function renderInline(text: string, locale: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));

    const [, linkText, href, bold] = match;
    if (linkText && href) {
      nodes.push(
        isInternalHref(href) ? (
          <Link key={key++} href={`/${locale}${href}`} className="text-accent underline underline-offset-4 hover:text-primary-700">
            {linkText}
          </Link>
        ) : (
          <a key={key++} href={href} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4 hover:text-primary-700">
            {linkText}
          </a>
        ),
      );
    } else if (bold) {
      nodes.push(<strong key={key++} className="font-semibold text-text-primary">{bold}</strong>);
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/** JSON-LD やメタ用にインライン記法を除いた素のテキストへ戻す */
export function stripInline(text: string): string {
  return text.replace(INLINE_PATTERN, (_match, linkText: string | undefined, _href, bold: string | undefined) => linkText ?? bold ?? '');
}
