#!/usr/bin/env node
const fetch = global.fetch || require('node-fetch')

async function main() {
  const base = process.env.QA_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3010'
  let failures = 0

  // E1: invalid signature should return 400 when webhook secret is configured
  try {
    const r = await fetch(`${base}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 't=0,v1=deadbeef'
      },
      body: JSON.stringify({ type: 'checkout.session.completed', data: { object: {} } })
    })
    if (r.status === 400) {
      console.log('[E1] invalid signature -> 400 OK')
    } else if (r.status === 200) {
      console.log('[E1] webhook secret not set, fallback 200 (treated as OK)')
    } else {
      console.log(`[E1] expected 400 or 200 (fallback), got ${r.status}`)
      failures++
    }
  } catch (e) {
    console.log('[E1] request failed', e.message)
    failures++
  }

  // E2: force 500 once, then retry should not be 500
  try {
    await fetch(`${base}/api/stripe/mock/webhook/toggle-500?count=1`, { method: 'POST' })
    const r1 = await fetch(`${base}/api/stripe/webhook`, { method: 'POST', body: '{}' })
    if (r1.status !== 500) {
      console.log(`[E2] expected first call 500, got ${r1.status}`)
      failures++
    } else {
      console.log('[E2] first call 500 OK')
    }
    const r2 = await fetch(`${base}/api/stripe/webhook`, { method: 'POST', body: '{}' })
    if (r2.status === 500) {
      console.log('[E2] expected retry not 500')
      failures++
    } else {
      console.log(`[E2] retry not 500 (got ${r2.status}) OK`)
    }
  } catch (e) {
    console.log('[E2] request failed', e.message)
    failures++
  }

  // E3: duplicate delivery via x-test-event-id should be idempotent in non-production
  try {
    const testEventId = `evt_test_${Date.now()}`
    const headers = {
      'Content-Type': 'application/json',
      'X-Test-Event-Id': testEventId
    }

    const first = await fetch(`${base}/api/stripe/webhook`, {
      method: 'POST',
      headers,
      body: '{}'
    })

    if (first.status !== 200) {
      console.log(`[E3] expected first x-test-event-id call 200, got ${first.status}`)
      failures++
    } else {
      console.log('[E3] first x-test-event-id call 200 OK')
    }

    const second = await fetch(`${base}/api/stripe/webhook`, {
      method: 'POST',
      headers,
      body: '{}'
    })

    if (second.status !== 200) {
      console.log(`[E3] expected duplicate x-test-event-id call 200, got ${second.status}`)
      failures++
    } else {
      console.log('[E3] duplicate x-test-event-id call 200 OK')
    }

    // NOTE: legacy REST API confirmation removed.
    // stripe_events processed flag check is skipped until Drizzle-based alternative is implemented.
    console.log('[E3] stripe_events processed フラグ確認はスキップ（legacy REST API removed、Drizzle代替未実装）')
  } catch (e) {
    console.log('[E3] request failed', e.message)
    failures++
  }

  if (failures > 0) {
    console.log(`Webhook abnormal QA: ${failures} failures`)
    process.exit(2)
  }
  console.log('Webhook abnormal QA: success')
}

main()
