interface JsonLdProps {
  data: Record<string, unknown> | null;
}

/** 構造化データを <script type="application/ld+json"> として出力する */
export default function JsonLd({ data }: JsonLdProps) {
  if (!data) return null;
  // "</script>" によるインジェクションを防ぐため '<' をエスケープする
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
