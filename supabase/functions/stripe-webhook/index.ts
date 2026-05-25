import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=denonext'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-11-20',
})
const cryptoProvider = Stripe.createSubtleCryptoProvider()

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function applyMembership(adminClient: ReturnType<typeof createClient>, accountId: string, planKey: string) {
  const now = new Date()
  const { data: account, error } = await adminClient
    .from('rt_accounts')
    .select('id, membership_tier, is_lifetime, membership_expires_at')
    .eq('id', accountId)
    .single()

  if (error || !account) throw new Error('Account not found for membership update')
  if (account.is_lifetime || account.membership_tier === 'lifetime') return

  if (planKey === 'lifetime') {
    await adminClient
      .from('rt_accounts')
      .update({
        membership_tier: 'lifetime',
        is_lifetime: true,
        membership_expires_at: null,
        status: 'active',
        updated_at: now.toISOString(),
      })
      .eq('id', accountId)
    return
  }

  const currentExpiry = account.membership_expires_at ? new Date(account.membership_expires_at) : null
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now
  const nextExpiry = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000)
  await adminClient
    .from('rt_accounts')
    .update({
      membership_tier: 'monthly',
      is_lifetime: false,
      membership_expires_at: nextExpiry.toISOString(),
      status: 'active',
      updated_at: now.toISOString(),
    })
    .eq('id', accountId)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const signature = req.headers.get('Stripe-Signature')
  const body = await req.text()
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!signature || !webhookSecret) return json({ error: 'Webhook signature is not configured.' }, 500)

  let event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider)
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Invalid signature', { status: 400 })
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const metadata = session.metadata || {}
    const accountId = metadata.account_id || ''
    const authUserId = metadata.auth_user_id || ''
    const planKey = metadata.plan_key || 'monthly'

    await adminClient.from('rt_billing_orders').upsert(
      {
        account_id: accountId || null,
        auth_user_id: authUserId || null,
        stripe_checkout_session_id: session.id,
        stripe_customer_email: session.customer_details?.email || session.customer_email || null,
        stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        plan_key: planKey,
        provider: 'stripe',
        payment_status: session.payment_status || 'paid',
        amount_total: session.amount_total || null,
        currency: session.currency || 'cny',
        payment_method_types: session.payment_method_types || [],
        metadata,
        paid_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_checkout_session_id' }
    )

    if (accountId) {
      await applyMembership(adminClient, accountId, planKey)
      await adminClient.from('rt_activity_events').insert({
        account_id: accountId,
        auth_user_id: authUserId || null,
        actor_key: authUserId || accountId,
        event_name: 'membership_payment_completed',
        props: {
          provider: 'stripe',
          plan_key: planKey,
          amount_total: session.amount_total || null,
          currency: session.currency || 'cny',
          stripe_checkout_session_id: session.id,
        },
      })
    }
  }

  if (event.type === 'checkout.session.expired') {
    const session = event.data.object
    await adminClient
      .from('rt_billing_orders')
      .update({
        payment_status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_checkout_session_id', session.id)
  }

  return json({ ok: true })
})
