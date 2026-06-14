import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const CACHE_TABLE = 'rt_public_job_board_cache'
const CACHE_KEY = 'default'
const CACHE_RETENTION_DAYS = 14
const VISIBLE_RETENTION_DAYS = 60
const SHARED_STORAGE_BUCKET = 'rt-shared'
const SHARED_JOB_CACHE_PATH = 'jobs/job-board-cache.json'
const MAINLAND_QUERIES = ['产品经理', 'AI产品经理', '数据产品经理', '商业分析', '产品运营', '增长运营', '前端开发', '后端开发']
const CTGOODJOBS_PAGES = [
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-banking-finance',
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-administration',
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-human-resources',
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-education',
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-engineering',
]
const JOBLUM_HK_PATHS = [
  '/jobs-spec-banking-financial-services',
  '/jobs-spec-information-technology-it',
  '/jobs-spec-sales',
  '/jobs-spec-marketing-communications',
  '/jobs-spec-administration-office-support',
  '/jobs-spec-human-resources-recruitment',
  '/jobs-spec-engineering',
  '/jobs-spec-consulting-strategy',
  '/jobs-spec-retail-consumer-products',
  '/jobs-spec-education-training',
  '/jobs-spec-call-centre-customer-service',
  '/jobs-spec-healthcare-medical',
  '/jobs-spec-government-defence',
  '/jobs-spec-manufacturing-transport-logistics',
]
const GREENHOUSE_SOURCES = [
  { company: 'Databricks', board: 'databricks', source: 'Databricks Careers' },
  { company: 'Stripe', board: 'stripe', source: 'Stripe Careers' },
  { company: 'Figma', board: 'figma', source: 'Figma Careers' },
  { company: 'Airbnb', board: 'airbnb', source: 'Airbnb Careers' },
  { company: 'Coinbase', board: 'coinbase', source: 'Coinbase Careers' },
  { company: 'Asana', board: 'asana', source: 'Asana Careers' },
  { company: 'Instacart', board: 'instacart', source: 'Instacart Careers' },
  { company: 'Robinhood', board: 'robinhood', source: 'Robinhood Careers' },
]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-job-refresh-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\p{Co}/gu, ' ')
    .replace(/\uFFFD/g, ' ')
    .replace(/[\uFE0E\uFE0F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanupDisplayText(value) {
  return normalizeText(decodeHtml(value))
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s*([（(【\[])\s*/g, '$1')
    .replace(/\s*([）)】\]])/g, '$1')
    .replace(/[（(【\[]\s*[）)】\]]/g, '')
    .replace(/^\s*[-–—·•:：;,|/]+\s*/g, '')
    .replace(/\s*[-–—·•:：;,|/]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanupLocationText(value) {
  const text = cleanupDisplayText(value)
    .replace(/\bHong Kong Hong Kong\b/gi, 'Hong Kong')
    .replace(/\bUnited States of America\b/gi, 'United States')
    .replace(/\bRemote(?:\s*-\s*Remote)+\b/gi, 'Remote')
    .trim()
  return /remote|worldwide|anywhere/i.test(text) ? 'Remote' : text
}

function decodeJsonFragment(value) {
  const raw = String(value || '')
  if (!raw) return ''
  try {
    return JSON.parse(`"${raw.replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`)
  } catch {
    return raw
  }
}

function parseJsonText(text) {
  const raw = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    const start = Math.min(...['{', '['].map((token) => {
      const index = raw.indexOf(token)
      return index === -1 ? Number.POSITIVE_INFINITY : index
    }))
    const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'))
    if (!Number.isFinite(start) || end <= start) return {}
    return JSON.parse(raw.slice(start, end + 1))
  }
}

function classifyRegion(value) {
  const text = cleanupLocationText(value).toLowerCase()
  if (/remote|worldwide|anywhere/.test(text)) return 'other'
  if (/香港|hong kong|\bhk\b/.test(text)) return 'hongkong'
  if (/中国|china|mainland|北京|上海|深圳|广州|杭州|成都|南京|苏州|武汉|西安|天津|重庆|长沙|青岛|郑州|厦门|珠海|合肥|宁波|佛山/.test(text)) return 'mainland'
  if (/united states|usa|u\.s\.|canada|new york|san francisco|seattle|boston|austin|chicago|toronto|vancouver|california|redwood city|brooklyn|oakland|bellevue|atlanta|denver|los angeles|washington dc|new jersey|montreal|ottawa|virginia|miami|phoenix|minneapolis|oregon|utah|georgia|massachusetts|illinois|texas|ontario|quebec/.test(text)) return 'northamerica'
  return 'other'
}

function isLikelySourcePlaceholder(name, source) {
  const text = cleanupDisplayText(name).toLowerCase()
  const sourceText = cleanupDisplayText(source).toLowerCase()
  if (!text) return true
  if (sourceText && text === sourceText) return true
  if (text.includes('ctgoodjobs')) return true
  if (text.includes('recruit.com.hk')) return true
  return /^(ctgoodjobs|jobicy|remote ok|remotive|recruit\.com\.hk|talent hong kong|talent 中国|talent|hkslash)$/i.test(text)
}

function isLikelyInvalidCompanyName(name, source) {
  const text = cleanupDisplayText(name)
  if (!text) return true
  if (isLikelySourcePlaceholder(text, source)) return true
  if (/ref\.?\s*no\.?/i.test(text)) return true
  if (/monthly income/i.test(text)) return true
  if (/^\$?\d[\d\s,./()\-a-z]*$/i.test(text)) return true
  if (/^\d+\s+(days?\s+work|vacanc(?:y|ies))/i.test(text)) return true
  if (/^[\d\s$().\-_/]+$/i.test(text)) return true
  return false
}

function hashText(value) {
  const input = String(value || '')
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function isRecentEnough(updatedAt) {
  const text = normalizeText(updatedAt)
  if (!text) return true
  const timestamp = new Date(text).getTime()
  if (!Number.isFinite(timestamp)) return true
  return Date.now() - timestamp <= VISIBLE_RETENTION_DAYS * 24 * 60 * 60 * 1000
}

function normalizePosting(input) {
  const title = cleanupDisplayText(input.title)
  const company = cleanupDisplayText(input.company).replace(/^\d+\s+(?=[A-Za-z])/u, '').trim()
  const url = normalizeText(input.url)
  if (!title || !company || !url) return null
  if (isLikelyInvalidCompanyName(company, input.source || '')) return null
  const location = cleanupLocationText(input.location)
  const updatedAt = normalizeText(input.updated_at || '')
  if (!isRecentEnough(updatedAt)) return null
  const inferredRegion = classifyRegion(`${location} ${company} ${title}`)
  const region = input.region && input.region !== 'other' ? input.region : inferredRegion
  const jdText = decodeHtml(input.jd_text || '').slice(0, 1800)
  return {
    id: `job_${hashText(`${input.source || ''}|${company}|${title}|${location}|${url}`)}`,
    title,
    company,
    location,
    region,
    source: normalizeText(input.source || '公开职位'),
    url,
    jd_text: jdText,
    summary: decodeHtml(input.summary || jdText || `${company} · ${location}`).slice(0, 260),
    updated_at: updatedAt,
  }
}

function makeJobMergeKey(job) {
  return `${job.source}|${job.url}`.toLowerCase()
}

function dedupe(items) {
  const seen = new Set()
  return (items || []).filter((item) => {
    if (!item) return false
    const key = makeJobMergeKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sortJobs(items) {
  const rank = { mainland: 0, hongkong: 1, northamerica: 2, other: 3 }
  return [...(items || [])].sort((a, b) => {
    const regionCmp = (rank[a.region] ?? 9) - (rank[b.region] ?? 9)
    if (regionCmp) return regionCmp
    const companyCmp = String(a.company || '').localeCompare(String(b.company || ''), ['zh-Hans-CN', 'en'], { numeric: true, sensitivity: 'base' })
    if (companyCmp) return companyCmp
    return String(a.title || '').localeCompare(String(b.title || ''), ['zh-Hans-CN', 'en'], { numeric: true, sensitivity: 'base' })
  })
}

async function fetchText(url, label, timeoutMs = 16000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    })
    if (!response.ok) throw new Error(`${label} failed (${response.status})`)
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJson(url, label, timeoutMs = 16000) {
  return parseJsonText(await fetchText(url, label, timeoutMs))
}

async function mapBatched(items, limit, worker) {
  const results = []
  const concurrency = Math.max(1, Math.min(limit || 1, items.length || 1))
  let cursor = 0
  async function run() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => run()))
  return results
}

async function fetchTencentJobs() {
  const pageSize = 160
  async function fetchPage(pageIndex) {
    const url = `https://careers.tencent.com/tencentcareer/api/post/Query?timestamp=${Date.now()}&pageIndex=${pageIndex}&pageSize=${pageSize}&language=zh-cn&area=cn`
    return fetchJson(url, `腾讯招聘 ${pageIndex}`, 18000)
  }
  const firstPage = await fetchPage(1)
  const firstList = Array.isArray(firstPage?.Data?.Posts) ? firstPage.Data.Posts : []
  const totalCount = Number(firstPage?.Data?.Count || firstPage?.Data?.TotalCount || firstList.length) || firstList.length
  const totalPages = Math.max(1, Math.min(Math.ceil(totalCount / pageSize), 50))
  const restPages = await mapBatched(Array.from({ length: totalPages - 1 }, (_, index) => index + 2), 6, async (pageIndex) => {
    try {
      const payload = await fetchPage(pageIndex)
      return Array.isArray(payload?.Data?.Posts) ? payload.Data.Posts : []
    } catch {
      return []
    }
  })
  return firstList.concat(restPages.flat()).map((item) => normalizePosting({
    title: item.RecruitPostName,
    company: '腾讯',
    location: [item.CountryName, item.LocationName, item.WorkPlace].filter(Boolean).join(' · '),
    region: 'mainland',
    source: '腾讯招聘',
    url: item.PostId ? `https://careers.tencent.com/jobdesc.html?postId=${encodeURIComponent(item.PostId)}` : 'https://careers.tencent.com/search.html',
    jd_text: [item.Responsibility, item.Requirement].filter(Boolean).join('\n\n'),
    updated_at: item.LastUpdateTime || '',
  })).filter(Boolean)
}

async function fetchMeituanJobs() {
  const pageRequests = MAINLAND_QUERIES.flatMap((keyword) => Array.from({ length: 10 }, (_, index) => ({ keyword, pageNo: index + 1 })))
  const buckets = await mapBatched(pageRequests, 6, async ({ keyword, pageNo }) => {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 16000)
      const response = await fetch('https://zhaopin.meituan.com/api/official/job/getJobList', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          origin: 'https://zhaopin.meituan.com',
          referer: 'https://zhaopin.meituan.com/web/position',
        },
        body: JSON.stringify({ page: { pageNo, pageSize: 30 }, keywords: keyword }),
      }).finally(() => clearTimeout(timer))
      const payload = await response.json().catch(() => ({}))
      const list = Array.isArray(payload?.data?.list) ? payload.data.list : []
      return list.map((item) => normalizePosting({
        title: item.name,
        company: '美团',
        location: (item.cityList || []).map((city) => city?.name).filter(Boolean).join(' · '),
        region: 'mainland',
        source: '美团招聘',
        url: item.jobUnionId ? `https://zhaopin.meituan.com/web/position/detail?jobUnionId=${encodeURIComponent(item.jobUnionId)}` : 'https://zhaopin.meituan.com/web/position',
        jd_text: [item.jobDuty, item.jobRequirement, item.highLight].filter(Boolean).join('\n\n'),
        summary: [item.jobFamily, item.department?.[0]?.name, item.highLight].filter(Boolean).join(' · '),
      })).filter(Boolean)
    } catch {
      return []
    }
  })
  return buckets.flat()
}

function extractLagouJobsFromPage(text) {
  const match = String(text || '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i)
  if (!match) return []
  const payload = parseJsonText(match[1])
  const list = payload?.props?.pageProps?.initData?.content?.positionResult?.result || []
  return (Array.isArray(list) ? list : []).map((item) => normalizePosting({
    title: item.positionName,
    company: item.companyShortName || item.companyFullName,
    location: [item.city, item.district].filter(Boolean).join(' · '),
    region: 'mainland',
    source: '拉勾招聘',
    url: item.positionId ? `https://www.lagou.com/wn/jobs/${encodeURIComponent(item.positionId)}.html` : 'https://www.lagou.com/wn/jobs',
    jd_text: item.positionDetail || '',
    summary: [item.salary, item.workYear, item.education, item.positionAdvantage].filter(Boolean).join(' · '),
    updated_at: item.createTime || item.formatCreateTime || '',
  })).filter(Boolean)
}

async function fetchLagouJobs() {
  const pageRequests = MAINLAND_QUERIES.flatMap((keyword) => Array.from({ length: 10 }, (_, index) => ({ keyword, page: index + 1 })))
  const buckets = await mapBatched(pageRequests, 3, async ({ keyword, page }) => {
    try {
      const text = await fetchText(`https://www.lagou.com/wn/jobs?cl=false&fromSearch=true&kd=${encodeURIComponent(keyword)}&pn=${page}`, `拉勾招聘 ${keyword} ${page}`, 18000)
      return extractLagouJobsFromPage(text)
    } catch {
      return []
    }
  })
  return buckets.flat()
}

function extractJobrapidoJobs(text, source, region) {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean)
  const jobs = []
  for (let index = 0; index < lines.length; index += 1) {
    const previewMatch = lines[index].match(/^\[(?:打开职位预览：|Open job preview for:)\s*:?\s*([^\]]+?)\]\((https?:\/\/[^)\s]+)\)$/i)
    if (!previewMatch || !(lines[index + 1] && /^###\s+/.test(lines[index + 1]))) continue
    const title = decodeHtml(lines[index + 1].replace(/^###\s+/, '').replace(/\*\*/g, '').replace(/\s+-\s+[^-]+$/, '').trim())
    const location = decodeHtml((lines[index + 2] || '').replace(/\*\*/g, '').trim())
    const company = decodeHtml((lines[index + 3] || '').replace(/\*\*/g, '').trim())
    jobs.push(normalizePosting({ title, company, location, region, source, url: previewMatch[2], summary: `${company} · ${location}` }))
  }
  return jobs.filter(Boolean)
}

async function fetchJobrapidoRegionJobs(source, region, host, queries, pages) {
  const pageRequests = queries.flatMap((query) => Array.from({ length: pages }, (_, index) => ({ query, page: index + 1 })))
  const buckets = await mapBatched(pageRequests, 2, async ({ query, page }) => {
    try {
      const text = await fetchText(`https://r.jina.ai/http://${host}/?q=${encodeURIComponent(query)}&l=${region === 'hongkong' ? 'hong-kong' : '%E4%B8%AD%E5%9B%BD'}&p=${page}`, `${source} ${query} ${page}`, 18000)
      return extractJobrapidoJobs(text, source, region)
    } catch {
      return []
    }
  })
  return buckets.flat()
}

function compactCtgoodjobsFlightText(text) {
  return String(text || '')
    .replace(/"\]\)<\/script><script>self\.__next_f\.push\(\[1,"/g, '')
    .replace(/<\/script><script>self\.__next_f\.push\(\[1,"/g, '')
    .replace(/<script>self\.__next_f\.push\(\[1,"/g, '')
    .replace(/"\]\)<\/script>/g, '')
}

function extractEscapedJsonField(block, field) {
  const pattern = new RegExp(`\\\\"${field}\\\\"\\s*:\\s*\\\\"((?:\\\\\\\\.|[^"])*)\\\\"`)
  const match = String(block || '').match(pattern)
  return match ? decodeJsonFragment(match[1]) : ''
}

function extractCtgoodjobsRecordsFromPage(text) {
  const records = []
  const seen = new Set()
  const raw = compactCtgoodjobsFlightText(text)
  const urlRegex = /\\"url\\"\s*:\s*\\"(https:\/\/jobs\.ctgoodjobs\.hk\/job\/(?:\\\\.|[^"])*)\\"/g
  for (const match of raw.matchAll(urlRegex)) {
    const blockStart = Math.max(0, raw.lastIndexOf('\\"jobTitle\\"', match.index))
    const nextStart = raw.indexOf('\\"jobTitle\\"', match.index + match[0].length)
    const block = raw.slice(blockStart, nextStart === -1 ? Math.min(raw.length, match.index + 3000) : nextStart)
    const url = decodeJsonFragment(match[1])
    if (!url || seen.has(url)) continue
    seen.add(url)
    records.push({
      title: extractEscapedJsonField(block, 'jobTitle'),
      company: extractEscapedJsonField(block, 'companyName'),
      location: 'Hong Kong',
      region: 'hongkong',
      source: 'CTgoodjobs',
      url,
    })
  }
  return records
}

function normalizeCtgoodjobsRecord(record) {
  return normalizePosting({
    title: record.title,
    company: record.company,
    location: record.location || 'Hong Kong',
    region: 'hongkong',
    source: 'CTgoodjobs',
    url: record.url,
    jd_text: record.jd_text || '',
    updated_at: record.updated_at || '',
    summary: `${record.company || ''} · ${record.location || 'Hong Kong'}`,
  })
}

function extractCtgoodjobsTotalPages(text, pageSize) {
  const totalMatch = String(text || '').match(/Explore\s+(\d+)\s+jobs/i) || String(text || '').match(/(\d+)\s+Jobs Matched/i)
  const total = totalMatch ? parseInt(totalMatch[1], 10) : 0
  if (!total || !pageSize) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

async function fetchCtgoodjobsJobs() {
  const buckets = await mapBatched(CTGOODJOBS_PAGES, 3, async (base) => {
    const firstText = await fetchText(base, `CTgoodjobs ${base}`, 18000)
    const firstRecords = extractCtgoodjobsRecordsFromPage(firstText)
    const totalPages = Math.min(extractCtgoodjobsTotalPages(firstText, firstRecords.length), 80)
    const pageUrls = Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => `${base}?page=${index + 2}`)
    const rest = await mapBatched(pageUrls, 6, async (url) => {
      try {
        return extractCtgoodjobsRecordsFromPage(await fetchText(url, `CTgoodjobs ${url}`, 18000))
      } catch {
        return []
      }
    })
    return firstRecords.concat(rest.flat())
  })
  return buckets.flat().map(normalizeCtgoodjobsRecord).filter(Boolean)
}

function extractHkSlashJobsFromPage(text) {
  const match = String(text || '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i)
  if (!match) return []
  const payload = parseJsonText(match[1])
  const list = payload?.props?.initialState?.jobs?.data?.elements || []
  return (Array.isArray(list) ? list : []).map((item) => normalizePosting({
    title: item.name,
    company: item.user?.name || 'HKSlash',
    location: (item.locations || []).map((location) => location?.name || location?.text).filter(Boolean).join(' · ') || 'Hong Kong',
    region: 'hongkong',
    source: 'HKSlash',
    url: item.id ? `https://www.hkslash.com/zh/job/${encodeURIComponent(item.id)}` : 'https://www.hkslash.com/zh/jobs',
    jd_text: item.description || '',
  })).filter(Boolean)
}

async function fetchHkSlashJobs() {
  const firstText = await fetchText('https://www.hkslash.com/zh/jobs?page=1', 'HKSlash 1', 18000)
  const firstJobs = extractHkSlashJobsFromPage(firstText)
  const totalPagesMatch = String(firstText || '').match(/"totalPages":(\d+)/)
  const totalPages = Math.min(totalPagesMatch ? parseInt(totalPagesMatch[1], 10) : 1, 60)
  const rest = await mapBatched(Array.from({ length: totalPages - 1 }, (_, index) => index + 2), 6, async (page) => {
    try {
      return extractHkSlashJobsFromPage(await fetchText(`https://www.hkslash.com/zh/jobs?page=${page}`, `HKSlash ${page}`, 18000))
    } catch {
      return []
    }
  })
  return firstJobs.concat(rest.flat())
}

function extractJoblumHongKongJobsFromPage(text) {
  return [...String(text || '').matchAll(/<div class="result-wrp row">[\s\S]*?<h2 class="job-title">[\s\S]*?<a[\s\S]*?title="([^"]+)"[\s\S]*?href="([^"]+)"[\s\S]*?<span class="company-name">[\s\S]*?<span>\s*([^<]+)\s*<\/span>[\s\S]*?<span class="location location-desktop">\s*<span>\s*([^<]+)\s*<\/span>/gi)]
    .map((match) => normalizePosting({
      title: decodeHtml(match[1]),
      company: decodeHtml(match[3]),
      location: decodeHtml(match[4]),
      region: 'hongkong',
      source: 'Joblum Hong Kong',
      url: match[2].startsWith('http') ? match[2] : `https://hk.joblum.com${match[2]}`,
    }))
    .filter(Boolean)
}

async function fetchJoblumHongKongJobs() {
  const jobs = []
  for (const route of JOBLUM_HK_PATHS) {
    try {
      const firstText = await fetchText(`https://hk.joblum.com${route}`, `Joblum Hong Kong ${route}`, 18000)
      jobs.push(...extractJoblumHongKongJobsFromPage(firstText))
      const pageMatches = [...String(firstText || '').matchAll(/href="([^"]+\?p=(\d+))"/gi)]
      const pageCount = Math.min(pageMatches.reduce((max, match) => Math.max(max, parseInt(match[2], 10) || 1), 1), 50)
      const rest = await mapBatched(Array.from({ length: pageCount - 1 }, (_, index) => `https://hk.joblum.com${route}?p=${index + 2}`), 5, async (url) => {
        try {
          return extractJoblumHongKongJobsFromPage(await fetchText(url, `Joblum Hong Kong ${url}`, 18000))
        } catch {
          return []
        }
      })
      jobs.push(...rest.flat())
    } catch {}
  }
  return jobs
}

function extractRecruitJobsFromPage(text) {
  return [...String(text || '').matchAll(/href=['"]([^'"]*\/job-detail\/([^/'"]+)\/([^/'"]+)\/[^'"]+)['"]/gi)]
    .map((match) => normalizePosting({
      title: decodeURIComponent(match[3] || '').replace(/[-_]+/g, ' ').trim() || '职位未公开',
      company: decodeURIComponent(match[2] || '').replace(/[-_]+/g, ' ').trim() || '公司未公开',
      location: 'Hong Kong',
      region: 'hongkong',
      source: 'Recruit.com.hk',
      url: match[1].startsWith('http') ? match[1] : `https://www.recruit.com.hk${match[1]}`,
    }))
    .filter(Boolean)
}

async function fetchRecruitHongKongJobs() {
  const home = 'https://www.recruit.com.hk/default.aspx'
  const homepage = await fetchText(home, 'Recruit.com.hk 首页', 18000).catch(() => '')
  const links = [home, ...new Set([...String(homepage || '').matchAll(/href=['"]([^'"]*(?:job-function-q|job-category)[^'"]*)['"]/gi)].map((match) => {
    const href = normalizeText(match[1])
    return href.startsWith('http') ? href : `https://www.recruit.com.hk${href}`
  }).filter(Boolean))]
  const buckets = await mapBatched(links, 6, async (url) => {
    try {
      return extractRecruitJobsFromPage(await fetchText(url, url, 18000))
    } catch {
      return []
    }
  })
  return buckets.flat()
}

function extractTalentJobsFromHtml(text, options) {
  const opts = options || {}
  const baseUrl = opts.baseUrl || 'https://hk.talent.com'
  return [...String(text || '').matchAll(/<div[^>]+data-testid="jobcard-container-[^"]+"[\s\S]*?<h2[^>]*class="JobCard_title__[^"]*">([\s\S]*?)<\/h2>[\s\S]*?<span[^>]*class="JobCard_company__[^"]*">([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class="JobCard_location__[^"]*">([\s\S]*?)<\/span>[\s\S]*?<a[^>]+href="(\/view\?id=[^"]+)"[\s\S]*?<time[^>]*dateTime="([^"]*)"/gi)]
    .map((match) => normalizePosting({
      title: decodeHtml(match[1]),
      company: decodeHtml(match[2]),
      location: decodeHtml(match[3]),
      region: opts.region || 'other',
      source: opts.source || 'Talent',
      url: new URL(match[4], baseUrl).toString(),
      updated_at: match[5] || '',
    }))
    .filter(Boolean)
}

async function fetchTalentRegionJobs(options) {
  const jobs = []
  for (const query of options.queries || []) {
    for (let page = 1; page <= (options.pageLimit || 6); page += 1) {
      try {
        const text = await fetchText(`${options.baseUrl}/jobs?k=${query}&l=${options.location}&p=${page}`, `${options.source} ${query} ${page}`, 18000)
        jobs.push(...extractTalentJobsFromHtml(text, options))
      } catch {}
    }
  }
  return jobs
}

async function fetchGreenhouseJobs() {
  const tasks = GREENHOUSE_SOURCES.map(async (source) => {
    const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.board)}/jobs?content=true`, source.source)
    return (data?.jobs || []).map((item) => normalizePosting({
      title: item.title,
      company: source.company,
      location: item.location?.name || '',
      source: source.source,
      url: item.absolute_url,
      jd_text: decodeHtml(item.content || ''),
      updated_at: item.updated_at || '',
    })).filter(Boolean)
  })
  return (await Promise.all(tasks)).flat()
}

async function fetchRemotiveJobs() {
  const data = await fetchJson('https://remotive.com/api/remote-jobs', 'Remotive')
  return (data?.jobs || []).map((item) => normalizePosting({
    title: item.title,
    company: item.company_name,
    location: item.candidate_required_location || 'Remote',
    region: 'other',
    source: 'Remotive',
    url: item.url,
    jd_text: decodeHtml(item.description || ''),
    updated_at: item.publication_date || '',
  })).filter(Boolean)
}

async function fetchJobicyJobs() {
  const data = await fetchJson('https://jobicy.com/api/v2/remote-jobs?count=500', 'Jobicy')
  return (Array.isArray(data?.jobs) ? data.jobs : []).map((item) => normalizePosting({
    title: item.jobTitle || item.title,
    company: item.companyName || item.company || 'Jobicy',
    location: item.jobGeo || item.candidateRequiredLocation || 'Remote',
    region: 'other',
    source: 'Jobicy',
    url: item.url || item.jobUrl,
    jd_text: decodeHtml(item.jobDescription || ''),
    updated_at: item.pubDate || '',
  })).filter(Boolean)
}

async function fetchRemoteOkJobs() {
  const data = await fetchJson('https://remoteok.com/api', 'Remote OK')
  return (Array.isArray(data) ? data.slice(1) : []).map((item) => normalizePosting({
    title: item.position || item.title,
    company: item.company || 'Remote OK',
    location: item.location || 'Remote',
    region: 'other',
    source: 'Remote OK',
    url: item.url ? `https://remoteok.com${item.url}` : item.apply_url,
    jd_text: decodeHtml(item.description || ''),
    updated_at: item.date || '',
  })).filter(Boolean)
}

async function fetchAllSources() {
  async function safeFetch(label, task) {
    const startedAt = Date.now()
    try {
      const result = await task()
      return { source: label, ok: true, jobs: Array.isArray(result) ? result : [], duration_ms: Date.now() - startedAt }
    } catch (error) {
      return { source: label, ok: false, jobs: [], error: error instanceof Error ? error.message : String(error), duration_ms: Date.now() - startedAt }
    }
  }
  return Promise.all([
    safeFetch('腾讯招聘', fetchTencentJobs),
    safeFetch('美团招聘', fetchMeituanJobs),
    safeFetch('拉勾招聘', fetchLagouJobs),
    safeFetch('Jobrapido 中国', () => fetchJobrapidoRegionJobs('Jobrapido 中国', 'mainland', 'cn.jobrapido.com', ['产品', '产品经理', '运营', 'AI', '商业分析', '增长运营', '数据', '开发'], 8)),
    safeFetch('Talent 中国', () => fetchTalentRegionJobs({ region: 'mainland', source: 'Talent 中国', location: '%E4%B8%AD%E5%9B%BD', baseUrl: 'https://cn.talent.com', queries: ['%E4%BA%A7%E5%93%81', '%E6%95%B0%E6%8D%AE', '%E8%BF%90%E8%90%A5', 'AI', '%E5%95%86%E4%B8%9A%E5%88%86%E6%9E%90', '%E5%BC%80%E5%8F%91'], pageLimit: 8 })),
    safeFetch('CTgoodjobs', fetchCtgoodjobsJobs),
    safeFetch('HKSlash', fetchHkSlashJobs),
    safeFetch('Joblum Hong Kong', fetchJoblumHongKongJobs),
    safeFetch('Recruit.com.hk', fetchRecruitHongKongJobs),
    safeFetch('Jobrapido Hong Kong', () => fetchJobrapidoRegionJobs('Jobrapido Hong Kong', 'hongkong', 'hk.jobrapido.com', ['product', 'manager', 'analyst', 'operation', 'business', 'marketing', 'finance'], 6)),
    safeFetch('Talent Hong Kong', () => fetchTalentRegionJobs({ region: 'hongkong', source: 'Talent Hong Kong', location: 'hong+kong', baseUrl: 'https://hk.talent.com', queries: ['product', 'manager', 'analyst', 'finance', 'marketing', 'sales', 'engineer'], pageLimit: 10 })),
    safeFetch('Greenhouse', fetchGreenhouseJobs),
    safeFetch('Talent North America', () => fetchTalentRegionJobs({ region: 'northamerica', source: 'Talent North America', location: 'united+states', baseUrl: 'https://www.talent.com', queries: ['product manager', 'product operations', 'business analyst', 'software engineer', 'data analyst', 'marketing', 'finance'], pageLimit: 8 })),
    safeFetch('Remotive', fetchRemotiveJobs),
    safeFetch('Jobicy', fetchJobicyJobs),
    safeFetch('Remote OK', fetchRemoteOkJobs),
  ])
}

function isWithinRetentionWindow(job, nowMs) {
  const timestamps = [job.updated_at, job.last_seen_at, job.first_seen_at]
    .map((value) => Date.parse(String(value || '')))
    .filter(Number.isFinite)
  if (!timestamps.length) return true
  return nowMs - Math.max(...timestamps) <= CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000
}

function mergeJobCollections(existingJobs, fetchResults, nowIso) {
  const nowMs = Date.parse(nowIso)
  const existingByKey = new Map()
  const existingSourceCounts = new Map()
  for (const job of Array.isArray(existingJobs) ? existingJobs : []) {
    if (!job) continue
    existingByKey.set(makeJobMergeKey(job), job)
    existingSourceCounts.set(job.source, (existingSourceCounts.get(job.source) || 0) + 1)
  }
  const merged = []
  const fetchedSources = new Set()
  for (const result of fetchResults) {
    if (!result?.ok) continue
    const sourceCount = existingSourceCounts.get(result.source) || 0
    const nextCount = Array.isArray(result.jobs) ? result.jobs.length : 0
    if (sourceCount > 0 && (nextCount === 0 || (sourceCount >= 80 && nextCount < sourceCount * 0.55))) continue
    fetchedSources.add(result.source)
    for (const job of dedupe(result.jobs || [])) {
      const key = makeJobMergeKey(job)
      const previous = existingByKey.get(key)
      merged.push({
        ...(previous || {}),
        ...job,
        id: previous?.id || job.id,
        first_seen_at: previous?.first_seen_at || nowIso,
        last_seen_at: nowIso,
      })
    }
  }
  for (const job of Array.isArray(existingJobs) ? existingJobs : []) {
    if (!job || fetchedSources.has(job.source)) continue
    if (!isWithinRetentionWindow(job, nowMs)) continue
    merged.push(job)
  }
  return sortJobs(dedupe(merged)).filter((job) => isWithinRetentionWindow(job, nowMs))
}

async function readExistingCache(supabaseUrl, serviceRoleKey) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${CACHE_TABLE}?select=payload,updated_at&cache_key=eq.${encodeURIComponent(CACHE_KEY)}&limit=1`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  })
  if (!response.ok) return { jobs: [] }
  const rows = await response.json().catch(() => [])
  const payload = Array.isArray(rows) ? rows[0]?.payload : null
  return Array.isArray(payload?.jobs) ? payload : { jobs: [] }
}

async function upsertRemoteCache(supabaseUrl, serviceRoleKey, payload) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${CACHE_TABLE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([{ cache_key: CACHE_KEY, payload, updated_at: payload.updated_at }]),
  })
  if (!response.ok) throw new Error(`cache upsert failed: ${response.status} ${await response.text().catch(() => '')}`)
}

async function uploadSharedCache(supabaseUrl, serviceRoleKey, payload) {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${SHARED_STORAGE_BUCKET}/${SHARED_JOB_CACHE_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'x-upsert': 'true',
    },
    body: JSON.stringify(payload, null, 2),
  })
  if (!response.ok && response.status !== 404) throw new Error(`storage upload failed: ${response.status} ${await response.text().catch(() => '')}`)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' })

  const configuredSecret = Deno.env.get('JOB_REFRESH_SECRET') || ''
  const incomingSecret = request.headers.get('x-job-refresh-secret') || ''
  if (!configuredSecret) return json(500, { ok: false, error: 'JOB_REFRESH_SECRET is not configured.' })
  if (incomingSecret !== configuredSecret) return json(401, { ok: false, error: 'Unauthorized refresh request.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) return json(500, { ok: false, error: 'Supabase function secrets are incomplete.' })

  const startedAt = new Date().toISOString()
  const existing = await readExistingCache(supabaseUrl, serviceRoleKey)
  const results = await fetchAllSources()
  const nowIso = new Date().toISOString()
  const jobs = mergeJobCollections(existing.jobs, results, nowIso)
  if (jobs.length < 1000 && (existing.jobs || []).length > jobs.length) {
    return json(502, {
      ok: false,
      error: 'Refresh produced too few jobs; kept previous cloud cache.',
      fetched_count: jobs.length,
      existing_count: existing.jobs.length,
      source_results: results.map((result) => ({ source: result.source, ok: result.ok, count: result.jobs.length, error: result.error || null })),
    })
  }

  const sourceResults = results.map((result) => ({
    source: result.source,
    ok: result.ok,
    count: result.jobs.length,
    duration_ms: result.duration_ms,
    error: result.error || null,
  }))
  const payload = {
    updated_at: nowIso,
    refresh_started_at: startedAt,
    refresh_completed_at: nowIso,
    source_label: '云端每日职位池',
    source_count: new Set(jobs.map((job) => job.source).filter(Boolean)).size,
    retention_days: VISIBLE_RETENTION_DAYS,
    source_results: sourceResults,
    jobs,
  }
  await upsertRemoteCache(supabaseUrl, serviceRoleKey, payload)
  await uploadSharedCache(supabaseUrl, serviceRoleKey, payload).catch((error) => {
    console.warn('[job-cache] storage mirror skipped', error)
  })
  return json(200, {
    ok: true,
    updated_at: nowIso,
    jobs: jobs.length,
    source_results: sourceResults,
  })
})
