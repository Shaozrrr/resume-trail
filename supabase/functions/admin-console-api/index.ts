import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const RUNTIME_TABLE = 'rt_public_runtime_settings'
const SHARED_BUCKET = 'rt-shared'
const SHARED_QR_CONFIG_PATH = 'runtime/community-qr.json'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function getServiceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (legacy) return legacy
  const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS') || ''
  if (!secretKeys) return ''
  try {
    return JSON.parse(secretKeys).default || ''
  } catch {
    return ''
  }
}

function getAdminPassword() {
  return Deno.env.get('RT_ADMIN_PASSWORD') || ''
}

function assertAuthorized(body: Record<string, unknown>) {
  const configured = getAdminPassword()
  const input = typeof body.password === 'string' ? body.password : ''
  if (!configured) throw Object.assign(new Error('后台密码还没有配置。'), { status: 500 })
  if (!input || input !== configured) throw Object.assign(new Error('后台密码不正确。'), { status: 401 })
}

function sanitizePatch(input: unknown) {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const id = typeof raw.id === 'string' ? raw.id : ''
  if (!id) throw Object.assign(new Error('缺少账号 ID。'), { status: 400 })
  const allowed = [
    'membership_tier',
    'membership_expires_at',
    'is_lifetime',
    'bonus_prepare_credits',
    'trial_prepare_limit',
    'used_prepare_credits',
    'has_paid_access',
    'status',
    'notes',
    'source_channel',
  ]
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) patch[key] = raw[key]
  }
  if (!Object.keys(patch).length) throw Object.assign(new Error('没有可更新的字段。'), { status: 400 })
  return { id, patch }
}

function dataUrlToUploadPayload(dataUrl: string) {
  const match = String(dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/)
  if (!match) throw Object.assign(new Error('二维码图片格式不支持，请重新上传。'), { status: 400 })
  const mime = match[1]
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
  }
  return {
    mime,
    ext: extMap[mime] || 'png',
    body: bytes,
  }
}

function buildPublicObjectUrl(objectPath: string) {
  const baseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '')
  const encodedPath = objectPath.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  return `${baseUrl}/storage/v1/object/public/${SHARED_BUCKET}/${encodedPath}`
}

async function ensureSharedBucket(adminClient: ReturnType<typeof createClient>) {
  const { error } = await adminClient.storage.createBucket(SHARED_BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/json', 'text/plain'],
  })
  if (error && !/already exists|duplicate|exists/i.test(error.message || '')) throw error
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceKey = getServiceKey()
    if (!supabaseUrl || !serviceKey) return json({ error: '后台服务密钥未配置完整。' }, 500)

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    assertAuthorized(body)

    const action = typeof body.action === 'string' ? body.action : ''
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    if (action === 'list_accounts') {
      const { data, error } = await adminClient
        .from('rt_accounts')
        .select('*')
        .order('last_seen_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
      if (error) throw error
      return json({ ok: true, accounts: (data || []).map((account) => ({ account })) })
    }

    if (action === 'list_events') {
      const days = Math.max(1, Math.min(180, Number(body.days || 30)))
      const limit = Math.max(1, Math.min(5000, Number(body.limit || 3000)))
      const sinceDate = new Date(Date.now() - days * 86400000).toISOString()
      const { data, error } = await adminClient
        .from('rt_activity_events')
        .select('*')
        .gte('created_at', sinceDate)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return json({ ok: true, events: data || [] })
    }

    if (action === 'update_account') {
      const { id, patch } = sanitizePatch(body.patch)
      const { data, error } = await adminClient
        .from('rt_accounts')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      return json({ ok: true, account: data })
    }

    if (action === 'get_user_workspace') {
      const authUserId = typeof body.auth_user_id === 'string' ? body.auth_user_id : ''
      if (!authUserId) return json({ ok: true, workspace: null })
      const { data, error } = await adminClient
        .from('user_data')
        .select('user_id,updated_at,apps,resumes,prepare_sessions,refs,settings')
        .eq('user_id', authUserId)
        .maybeSingle()
      if (error) throw error
      return json({ ok: true, workspace: data || null })
    }

    if (action === 'get_user_workspaces') {
      const authUserIds = Array.isArray(body.auth_user_ids)
        ? Array.from(new Set(body.auth_user_ids.filter((id) => typeof id === 'string' && id).slice(0, 500)))
        : []
      if (!authUserIds.length) return json({ ok: true, workspaces: [] })
      const { data, error } = await adminClient
        .from('user_data')
        .select('user_id,updated_at,apps,resumes,prepare_sessions,refs,settings')
        .in('user_id', authUserIds)
      if (error) throw error
      return json({ ok: true, workspaces: data || [] })
    }

    if (action === 'upsert_runtime_setting') {
      const settingKey = typeof body.setting_key === 'string' ? body.setting_key : ''
      if (!settingKey) throw Object.assign(new Error('缺少配置 key。'), { status: 400 })
      const { data, error } = await adminClient
        .from(RUNTIME_TABLE)
        .upsert({ setting_key: settingKey, setting_value: body.setting_value || {} }, { onConflict: 'setting_key' })
        .select('setting_key,setting_value,updated_at')
        .single()
      if (error) throw error
      return json({ ok: true, setting: data })
    }

    if (action === 'write_shared_community_qr_config') {
      const src = typeof body.src === 'string' ? body.src : ''
      if (!src) throw Object.assign(new Error('缺少二维码地址。'), { status: 400 })
      await ensureSharedBucket(adminClient)
      const payload = { src, updated_at: new Date().toISOString() }
      const { error: uploadError } = await adminClient.storage
        .from(SHARED_BUCKET)
        .upload(SHARED_QR_CONFIG_PATH, JSON.stringify(payload, null, 2), {
          contentType: 'application/json',
          upsert: true,
        })
      if (uploadError) throw uploadError
      return json({ ok: true, setting: payload })
    }

    if (action === 'upload_shared_community_qr') {
      const dataUrl = typeof body.data_url === 'string' ? body.data_url : ''
      const payload = dataUrlToUploadPayload(dataUrl)
      await ensureSharedBucket(adminClient)
      const stamp = Date.now()
      const imagePath = `community/user-cocreation-group-${stamp}.${payload.ext}`
      const { error: imageError } = await adminClient.storage
        .from(SHARED_BUCKET)
        .upload(imagePath, payload.body, { contentType: payload.mime, upsert: true })
      if (imageError) throw imageError
      const src = `${buildPublicObjectUrl(imagePath)}?v=${stamp}`
      const configPayload = { src, updated_at: new Date().toISOString() }
      const { error: configError } = await adminClient.storage
        .from(SHARED_BUCKET)
        .upload(SHARED_QR_CONFIG_PATH, JSON.stringify(configPayload, null, 2), {
          contentType: 'application/json',
          upsert: true,
        })
      if (configError) throw configError
      await adminClient.from(RUNTIME_TABLE).upsert(
        { setting_key: 'community_qr', setting_value: configPayload },
        { onConflict: 'setting_key' }
      )
      return json({ ok: true, src })
    }

    return json({ error: '未知后台操作。' }, 400)
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    console.error('[admin-console-api]', message, error)
    return json({ error: message }, status)
  }
})
