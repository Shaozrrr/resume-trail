import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=denonext'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-11-20',
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function resolveBaseUrl(input?: string | null) {
  const fallback = (Deno.env.get('APP_BASE_URL') || '').trim()
  const candidate = (input || '').trim()
  const value = candidate.startsWith('http://') || candidate.startsWith('https://') ? candidate : fallback
  if (!value) return null
  return value
}

function buildReturnUrl(baseUrl: string, status: 'success' | 'cancel', planKey: string) {
  const url = new URL(baseUrl)
  url.searchParams.set('billing', status)
  url.searchParams.set('plan', planKey)
  return url.toString()
}

function getPriceId(planKey: string) {
  if (planKey === 'monthly') return Deno.env.get('STRIPE_PRICE_MONTHLY_CNY') || ''
  if (planKey === 'lifetime') return Deno.env.get('STRIPE_PRICE_LIFETIME_CNY') || ''
  return ''
}

function getPaymentMethodTypes(methodKey?: string) {
  if (methodKey === 'wechat') return ['wechat_pay']
  if (methodKey === 'alipay') return ['alipay']
  return ['wechat_pay', 'alipay', 'card']
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const authHeader = req.headers.get('Authorization') || ''

  if (!Deno.env.get('STRIPE_SECRET_KEY')) {
    return json({ error: 'Stripe secret is not configured yet.' }, 500)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()
  if (userError || !user) {
    return json({ error: '请先登录账号，再开通会员。' }, 401)
  }

  const body = await req.json().catch(() => ({}))
  const planKey = typeof body.plan_key === 'string' ? body.plan_key : ''
  const methodKey = typeof body.method_key === 'string' ? body.method_key : ''
  const accountId = typeof body.account_id === 'string' ? body.account_id : ''
  const returnUrl = resolveBaseUrl(typeof body.return_url === 'string' ? body.return_url : '')
  const priceId = getPriceId(planKey)

  if (!priceId) return json({ error: '这个会员计划还没配置 Stripe Price。' }, 500)
  if (!returnUrl) return json({ error: '还没配置支付回跳地址 APP_BASE_URL。' }, 500)

  const { data: account, error: accountError } = await adminClient
    .from('rt_accounts')
    .select('id, auth_user_id, email, membership_tier, is_lifetime, membership_expires_at')
    .eq('id', accountId)
    .eq('auth_user_id', user.id)
    .single()

  if (accountError || !account) {
    return json({ error: '账号校验失败，请先重新登录后再试。' }, 403)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: getPaymentMethodTypes(methodKey),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: buildReturnUrl(returnUrl, 'success', planKey),
    cancel_url: buildReturnUrl(returnUrl, 'cancel', planKey),
    customer_email: account.email || user.email || undefined,
    allow_promotion_codes: false,
    locale: 'auto',
    metadata: {
      account_id: account.id,
      auth_user_id: user.id,
      plan_key: planKey,
      method_key: methodKey || 'auto',
      source: 'resume_trail_web',
    },
  })

  await adminClient.from('rt_billing_orders').upsert(
    {
      account_id: account.id,
      auth_user_id: user.id,
      stripe_checkout_session_id: session.id,
      stripe_customer_email: account.email || user.email || null,
      stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      plan_key: planKey,
      provider: 'stripe',
      payment_status: session.payment_status || 'unpaid',
      amount_total: session.amount_total || null,
      currency: session.currency || 'cny',
      payment_method_types: session.payment_method_types || [],
      checkout_url: session.url || null,
      metadata: session.metadata || {},
    },
    { onConflict: 'stripe_checkout_session_id' }
  )

  return json({
    ok: true,
    url: session.url,
    session_id: session.id,
  })
})
