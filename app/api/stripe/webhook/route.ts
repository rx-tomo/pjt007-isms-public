import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getDb } from '@/lib/db/drizzle/client'
import { stripeEvents, paymentHistory, subscriptions } from '@/lib/db/drizzle/schema'
import { eq } from 'drizzle-orm'
import { logServiceRoleEvent } from '@/lib/server/logging/serviceRoleEvents'
import { hasStripeSecret } from '@/lib/stripe/config'
import { STRIPE_API_VERSION, syncSubscriptionFromStripe } from '@/lib/stripe/subscriptionSync'
import { consumeForceWebhook500Once } from '@/lib/testing/toggles'

export async function POST(request: Request) {
  // テスト専用: 一時的に500を返すトグル
  if (process.env.NODE_ENV !== 'production' && consumeForceWebhook500Once()) {
    return NextResponse.json({ error: 'forced 500 for testing' }, { status: 500 })
  }

  const db = getDb()

  // E2E/開発用: 署名検証を通さず冪等性を検証するショートカット（本番無効）
  if (process.env.NODE_ENV !== 'production') {
    const testEventId = request.headers.get('x-test-event-id')
    if (testEventId) {
      const raw = await request.text()
      const existingEvent = await getExistingEvent(db, String(testEventId))
      if (existingEvent?.processed) {
        return NextResponse.json({ received: true })
      }
      if (!existingEvent) {
        await db.insert(stripeEvents).values({
          id: crypto.randomUUID(),
          stripeEventId: String(testEventId),
          eventType: 'test.mock',
          eventData: raw,
        })
      }
      await markEventProcessed(db, String(testEventId), { processed: true })
      return NextResponse.json({ received: true })
    }
  }
  const secretConfigured = hasStripeSecret()
  const secretKeyRaw = process.env.STRIPE_SECRET_KEY ?? ''
  const webhookSecretRaw = process.env.STRIPE_WEBHOOK_SECRET ?? ''
  const webhookSecret = webhookSecretRaw.trim()

  const useMockWebhook = !secretConfigured || webhookSecret === ''

  if (useMockWebhook) {
    const raw = await request.text()
    console.info('[Stripe Skeleton] webhook fallback payload:', raw)
    return NextResponse.json({ received: true })
  }

  const secretKey = secretKeyRaw.trim()
  const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION })
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (error) {
    console.error('[Stripe] invalid signature', error)
    const payload = safeParseJson(rawBody) ?? {}
    const organizationId = extractOrganizationIdFromStripeObject(payload)
    if (organizationId) {
      await logServiceRoleEvent({
        organizationId,
        userId: null,
        actionName: 'stripe.webhook',
        status: 'denied',
        context: { reason: 'invalid_signature', payload }
      })
    }
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const existingEvent = await getExistingEvent(db, event.id)
  if (existingEvent?.processed) {
    return NextResponse.json({ received: true })
  }

  if (!existingEvent) {
    const eventJson = safeParseJson(rawBody) ?? { id: event.id, type: event.type }
    await db.insert(stripeEvents).values({
      id: crypto.randomUUID(),
      stripeEventId: event.id,
      eventType: event.type,
      eventData: JSON.stringify(eventJson),
    })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutSessionCompleted({ stripe, session })
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await syncSubscriptionFromStripe({ stripe, subscription })
        break
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid({ stripe, invoice })
        break
      }
      default:
        console.info('[Stripe] webhook event ignored', event.type)
    }

    await markEventProcessed(db, event.id, { processed: true })
    const successOrgId = extractOrganizationIdFromStripeObject(
      event.data.object as unknown as Record<string, unknown>
    )
    if (successOrgId) {
      await logServiceRoleEvent({
        organizationId: successOrgId,
        userId: null,
        actionName: 'stripe.webhook',
        status: 'success',
        context: { eventId: event.id, eventType: event.type }
      })
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Stripe] webhook processing failed', error)
    await markEventProcessed(db, event.id, {
      processed: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    const failureOrgId = extractOrganizationIdFromStripeObject(
      event.data.object as unknown as Record<string, unknown>
    )
    if (failureOrgId) {
      await logServiceRoleEvent({
        organizationId: failureOrgId,
        userId: null,
        actionName: 'stripe.webhook',
        status: 'error',
        context: {
          eventId: event.id,
          eventType: event.type,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

function safeParseJson(payload: string) {
  try {
    return JSON.parse(payload)
  } catch (error) {
    console.warn('[Stripe] failed to parse JSON payload', error)
    return null
  }
}

type DbType = ReturnType<typeof getDb>

async function getExistingEvent(db: DbType, eventId: string) {
  const rows = await db
    .select({ id: stripeEvents.id, processed: stripeEvents.processed })
    .from(stripeEvents)
    .where(eq(stripeEvents.stripeEventId, eventId))
    .limit(1)

  return rows[0] ?? null
}

async function markEventProcessed(
  db: DbType,
  eventId: string,
  options: { processed: boolean; error?: string | null }
) {
  await db.update(stripeEvents)
    .set({
      processed: options.processed,
      errorMessage: options.error ?? null,
      processedAt: options.processed ? new Date().toISOString() : null
    })
    .where(eq(stripeEvents.stripeEventId, eventId))
}

async function handleCheckoutSessionCompleted({
  stripe,
  session
}: {
  stripe: Stripe
  session: Stripe.Checkout.Session
}) {
  const organizationId = (session.metadata?.organization_id || session.client_reference_id) as string | undefined
  const planIdFromMetadata = session.metadata?.pricing_plan_id
  const subscriptionId = session.subscription as string | undefined

  if (!organizationId || !subscriptionId) {
    console.warn('[Stripe] checkout.session.completed missing organization/subscription', {
      organizationId,
      subscriptionId
    })
    return
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    apiVersion: STRIPE_API_VERSION
  })

  await syncSubscriptionFromStripe({
    stripe,
    subscription,
    organizationId,
    pricingPlanId: planIdFromMetadata
  })
}

async function handleInvoicePaid({
  stripe,
  invoice
}: {
  stripe: Stripe
  invoice: Stripe.Invoice
}) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice)

  if (!subscriptionId) {
    console.warn('[Stripe] invoice missing subscription context', invoice.id)
    return
  }

  const subscriptionRow = await syncSubscriptionFromStripe({
    stripe,
    subscriptionId
  })

  if (!subscriptionRow) {
    console.warn('[Stripe] subscription row not found after sync', subscriptionId)
    return
  }

  const paidAt = invoice.status_transitions?.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
    : new Date().toISOString()

  const amount = invoice.amount_paid ?? invoice.amount_due ?? 0
  const { paymentIntentId, paymentMethodType } = await resolveInvoicePaymentDetails(invoice, stripe)

  const db = getDb()

  if (!invoice.id) {
    console.warn('[Stripe] invoice missing id')
    return
  }

  // Upsert by stripeInvoiceId
  const existing = await db
    .select({ id: paymentHistory.id })
    .from(paymentHistory)
    .where(eq(paymentHistory.stripeInvoiceId, invoice.id))
    .limit(1)

  const payload = {
    organizationId: subscriptionRow.organizationId!,
    subscriptionId: subscriptionRow.id,
    stripePaymentIntentId: paymentIntentId,
    stripeInvoiceId: invoice.id,
    amount,
    currency: invoice.currency?.toUpperCase() ?? 'JPY',
    status: 'succeeded',
    description: invoice.description ?? `Stripe Invoice ${invoice.number ?? invoice.id}`,
    paymentMethodType,
    paidAt,
  }

  if (existing.length > 0) {
    await db.update(paymentHistory).set(payload).where(eq(paymentHistory.stripeInvoiceId, invoice.id))
  } else {
    await db.insert(paymentHistory).values({ id: crypto.randomUUID(), ...payload })
  }
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  const subscriptionDetails = invoice.parent?.subscription_details
  if (!subscriptionDetails?.subscription) {
    return null
  }

  return typeof subscriptionDetails.subscription === 'string'
    ? subscriptionDetails.subscription
    : subscriptionDetails.subscription.id
}

async function resolveInvoicePaymentDetails(
  invoice: Stripe.Invoice,
  stripe: Stripe
) {
  const payments = invoice.payments?.data ?? []
  const prioritized = payments.find(payment => payment.status === 'paid') ?? payments[0]

  if (!prioritized) {
    return { paymentIntentId: null, paymentMethodType: null }
  }

  const payment = prioritized.payment
  let paymentIntentId: string | null = null
  let paymentMethodType: string | null = null

  if (payment?.payment_intent) {
    if (typeof payment.payment_intent === 'string') {
      paymentIntentId = payment.payment_intent
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(payment.payment_intent, {
          apiVersion: STRIPE_API_VERSION
        })
        paymentMethodType = paymentIntent.payment_method_types?.[0] ?? null
      } catch (error) {
        console.warn('[Stripe] failed to retrieve payment intent for invoice', invoice.id, error)
      }
    } else {
      paymentIntentId = payment.payment_intent.id
      paymentMethodType = payment.payment_intent.payment_method_types?.[0] ?? null
    }
  } else if (payment?.charge) {
    try {
      if (typeof payment.charge === 'string') {
        const charge = await stripe.charges.retrieve(payment.charge, {
          apiVersion: STRIPE_API_VERSION
        })
        paymentMethodType = charge.payment_method_details?.type ?? null
        paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id ?? null
      } else {
        paymentMethodType = payment.charge.payment_method_details?.type ?? null
        paymentIntentId = typeof payment.charge.payment_intent === 'string'
          ? payment.charge.payment_intent
          : payment.charge.payment_intent?.id ?? null
      }
    } catch (error) {
      console.warn('[Stripe] failed to resolve charge for invoice', invoice.id, error)
    }
  }

  return { paymentIntentId, paymentMethodType }
}

function extractOrganizationIdFromStripeObject(object: Record<string, unknown> | null | undefined) {
  if (!object) return null

  const getMetadataOrgId = (payload?: Record<string, unknown>) => {
    if (!payload) return null
    const metadata = payload.metadata as Record<string, unknown> | undefined
    if (metadata && typeof metadata.organization_id === 'string' && metadata.organization_id) {
      return metadata.organization_id
    }
    return null
  }

  const direct = getMetadataOrgId(object)
  if (direct) return direct

  const clientReferenceId = object.client_reference_id
  if (typeof clientReferenceId === 'string' && clientReferenceId) {
    return clientReferenceId
  }

  const nestedSources = ['customer', 'subscription', 'invoice', 'data'] as const
  for (const key of nestedSources) {
    const nested = object[key] as Record<string, unknown> | undefined
    if (!nested) continue
    const nestedOrgId = getMetadataOrgId(nested)
    if (nestedOrgId) {
      return nestedOrgId
    }
  }

  return null
}
