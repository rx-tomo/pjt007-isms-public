import type { ReactNode } from 'react';
import '../globals.css';

// [locale] 外のモック画面（Stripeモックポータル等）用のルートレイアウト。
// GAP-008 対応で app/layout.tsx を廃止したため、このセグメントが <html>/<body> を所有する。
export default function MockLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
