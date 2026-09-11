/**
 * 公開デモの fixture マーカー（demo_fixture_state.status）から、デモ面を配信してよいかを判定する。
 *
 * - idle    : 通常。配信する
 * - failed  : 直近のリセットが失敗した状態。データ自体は registry 側でペルソナ単位に検証されるため、
 *             配信は継続する（劣化運転）。2026-09-11 に failed のまま 503 を返し続けてデモが止まった反省から
 * - leased  : リセット実行中。配信しない
 */
export type DemoRuntimeStatus = 'idle' | 'failed' | 'leased'

export type DemoRuntimeDecision =
  | { serve: true; degraded: boolean }
  | { serve: false; reason: 'resetting' | 'configuration' }

export const SERVICEABLE_DEMO_STATUSES: readonly DemoRuntimeStatus[] = ['idle', 'failed']

export function decideDemoRuntime(status: string | null | undefined): DemoRuntimeDecision {
  if (status === 'idle') return { serve: true, degraded: false }
  if (status === 'failed') return { serve: true, degraded: true }
  if (status === 'leased') return { serve: false, reason: 'resetting' }
  return { serve: false, reason: 'configuration' }
}
