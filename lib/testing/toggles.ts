let forceWebhook500Count = 0

export function setForceWebhook500Count(count: number) {
  forceWebhook500Count = Math.max(0, count | 0)
}

export function consumeForceWebhook500Once(): boolean {
  if (forceWebhook500Count > 0) {
    forceWebhook500Count -= 1
    return true
  }
  return false
}
