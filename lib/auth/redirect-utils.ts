/**
 * オープンリダイレクト防止ユーティリティ（GAP-020 / F-1）。
 *
 * 認証後の復帰先 redirect クエリは、攻撃者が外部サイトへ誘導する経路に
 * なり得るため、同一オリジンのパスのみを許可する。先頭文字の正規表現判定では
 * `/\evil.com` のようなバックスラッシュ系のエッジケースを取りこぼすため、
 * URL 解決による origin 一致で厳密に判定する。
 */

/**
 * 指定パスが baseOrigin と同一オリジンに解決されるか判定する。
 *
 * @param path 検証対象のパス（redirect クエリ値など）
 * @param baseOrigin 自サイトの origin（例: window.location.origin）
 * @returns 同一オリジンのパスなら true、外部 URL・不正値・解決不能なら false
 */
export function isSameOriginPath(path: string, baseOrigin: string): boolean {
  if (!path || !baseOrigin) return false
  try {
    const url = new URL(path, baseOrigin)
    return url.origin === baseOrigin
  } catch {
    return false
  }
}
