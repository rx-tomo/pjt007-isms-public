export type OpsNotificationPayload = {
  title: string
  text: string
  details?: Record<string, string | number | null>
}

export async function notifyOpsChannel(payload: OpsNotificationPayload) {
  const webhook = process.env.SLACK_WEBHOOK_URL
  if (!webhook) {
    return false
  }

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${payload.title}*`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: payload.text
      }
    }
  ]

  if (payload.details && Object.keys(payload.details).length > 0) {
    const detailLines = Object.entries(payload.details).map(
      ([key, value]) => `• *${key}*: ${value ?? '―'}`
    )

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: detailLines.join('\n')
      }
    })
  }

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: payload.title, blocks })
    })
    return true
  } catch (error) {
    console.error('[OpsNotify] Slack webhook failed', error)
    return false
  }
}
