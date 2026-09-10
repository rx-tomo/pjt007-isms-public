import { renderInline } from '@/lib/guides/inline';
import type { GuideBlock } from '@/lib/guides/types';

interface GuideBlocksProps {
  blocks: readonly GuideBlock[];
  locale: string;
}

function TableBlock({ block, locale }: { block: Extract<GuideBlock, { type: 'table' }>; locale: string }) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[32rem] text-sm">
        <thead className="bg-surface-elevated text-left text-text-primary">
          <tr>
            {block.headers.map((header, index) => (
              <th key={index} scope="col" className="px-4 py-3 font-semibold">{renderInline(header, locale)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-border align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 leading-6 text-text-secondary">{renderInline(cell, locale)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListBlock({ block, locale }: { block: Extract<GuideBlock, { type: 'ul' | 'ol' }>; locale: string }) {
  const items = block.items.map((item, index) => (
    <li key={index} className="pl-1 leading-7">{renderInline(item, locale)}</li>
  ));
  const className = 'my-5 space-y-2 pl-6 text-text-secondary';
  return block.type === 'ol'
    ? <ol className={`${className} list-decimal`}>{items}</ol>
    : <ul className={`${className} list-disc`}>{items}</ul>;
}

function renderBlock(block: GuideBlock, locale: string, index: number) {
  switch (block.type) {
    case 'h2':
      return (
        <h2 key={index} id={block.id} className="mt-14 scroll-mt-28 border-l-4 border-accent pl-4 text-2xl font-bold text-text-primary sm:text-3xl">
          {block.text}
        </h2>
      );
    case 'h3':
      return (
        <h3 key={index} id={block.id} className="mt-9 scroll-mt-28 text-xl font-semibold text-text-primary">
          {block.text}
        </h3>
      );
    case 'p':
      return <p key={index} className="my-5 leading-8 text-text-secondary">{renderInline(block.text, locale)}</p>;
    case 'ul':
    case 'ol':
      return <ListBlock key={index} block={block} locale={locale} />;
    case 'table':
      return <TableBlock key={index} block={block} locale={locale} />;
    case 'callout':
      return (
        <aside key={index} className="my-7 rounded-xl border border-primary-200 bg-primary-50 p-5 text-sm leading-7 text-primary-950">
          {block.title && <p className="mb-1 font-semibold">{block.title}</p>}
          <p>{renderInline(block.text, locale)}</p>
        </aside>
      );
    default:
      return null;
  }
}

export default function GuideBlocks({ blocks, locale }: GuideBlocksProps) {
  return <>{blocks.map((block, index) => renderBlock(block, locale, index))}</>;
}
