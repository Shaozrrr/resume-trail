import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ROOT = path.resolve(process.cwd(), 'resume-trail-work');
const OUTPUT_JS = path.join(ROOT, 'assets', 'job-board-cache.js');
const OUTPUT_JSON = path.join(ROOT, 'assets', 'job-board-cache.json');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bpynqhujzvadyakypfju.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CACHE_TABLE = 'rt_public_job_board_cache';
const CACHE_KEY = 'default';
const SHARED_STORAGE_BUCKET = 'rt-shared';
const SHARED_JOB_CACHE_PATH = 'jobs/job-board-cache.json';
const DEFAULT_LIMIT = 2600;
const CHROME_BINARY = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const execFileAsync = promisify(execFile);
const MAINLAND_QUERIES = ['产品经理', 'AI产品经理', '数据产品经理', '商业分析', '产品运营', '增长运营', '前端开发', '后端开发'];
const BYTEDANCE_QUERIES = ['运营', '用户', '电商', '商业化', '内容', '豆包', 'TRAE', '生活服务', '音乐', '开发者服务', '产品'];
const TARGET_SOURCE_FLOORS = [
  { region: 'mainland', source: '腾讯招聘', min: 100 },
  { region: 'mainland', source: '美团招聘', min: 100 },
  { region: 'mainland', source: '拉勾招聘', min: 100 },
  { region: 'mainland', source: '实习僧', min: 100 },
  { region: 'mainland', source: 'Jobrapido 中国', min: 100 },
  { region: 'hongkong', source: 'CTgoodjobs', min: 100 },
  { region: 'hongkong', source: 'HKSlash', min: 100 },
  { region: 'hongkong', source: 'Joblum Hong Kong', min: 100 },
  { region: 'hongkong', source: 'Recruit.com.hk', min: 100 },
  { region: 'hongkong', source: 'Talent Hong Kong', min: 100 },
  { region: 'northamerica', source: 'Databricks Careers', min: 100 },
  { region: 'northamerica', source: 'Stripe Careers', min: 100 },
  { region: 'northamerica', source: 'Figma Careers', min: 100 },
  { region: 'northamerica', source: 'Airbnb Careers', min: 80 },
  { region: 'northamerica', source: 'Robinhood Careers', min: 100 },
  { region: 'other', source: 'Jobicy', min: 40 },
  { region: 'other', source: 'Remotive', min: 29 },
  { region: 'other', source: 'Remote OK', min: 30 }
];
const GREENHOUSE_SOURCES = [
  { company: 'Databricks', board: 'databricks', source: 'Databricks Careers' },
  { company: 'Stripe', board: 'stripe', source: 'Stripe Careers' },
  { company: 'Figma', board: 'figma', source: 'Figma Careers' },
  { company: 'Airbnb', board: 'airbnb', source: 'Airbnb Careers' },
  { company: 'Coinbase', board: 'coinbase', source: 'Coinbase Careers' },
  { company: 'Asana', board: 'asana', source: 'Asana Careers' },
  { company: 'Instacart', board: 'instacart', source: 'Instacart Careers' },
  { company: 'Robinhood', board: 'robinhood', source: 'Robinhood Careers' }
];
const CTGOODJOBS_PAGES = [
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-banking-finance',
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-administration',
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-human-resources',
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-education',
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-engineering'
];
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
  '/jobs-spec-manufacturing-transport-logistics'
];
const RECRUIT_HOME = 'https://www.recruit.com.hk/default.aspx';
function normalizeText(value) {
  return String(value || '')
    .replace(/[\uE000-\uF8FF]/g, ' ')
    .replace(/\uFFFD/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashText(value) {
  const input = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyRegion(value) {
  const text = normalizeText(value).toLowerCase();
  if (/remote|worldwide|anywhere/.test(text)) return 'other';
  if (/香港|hong kong|\bhk\b/.test(text)) return 'hongkong';
  if (/中国|china|mainland|北京|上海|深圳|广州|杭州|成都|南京|苏州|武汉|西安|天津|重庆|长沙|青岛|郑州|厦门|珠海|合肥|宁波|佛山/.test(text)) return 'mainland';
  if (/united states|usa|u\.s\.|canada|new york|san francisco|seattle|boston|austin|chicago|toronto|vancouver|california|redwood city|brooklyn|oakland|bellevue|atlanta|denver|los angeles|washington dc|washington, dc|new jersey|montreal|ottawa|virginia|miami|phoenix|minneapolis|oregon|utah|georgia|massachusetts|illinois|texas|ontario|quebec/.test(text)) return 'northamerica';
  return 'other';
}

function isRecentEnough(updatedAt) {
  const text = normalizeText(updatedAt);
  if (!text) return true;
  const timestamp = new Date(text).getTime();
  if (!Number.isFinite(timestamp)) return true;
  return Date.now() - timestamp <= 60 * 24 * 60 * 60 * 1000;
}

function parseJsonText(text) {
  const raw = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const start = Math.min(...['{', '['].map((token) => {
      const index = raw.indexOf(token);
      return index === -1 ? Number.POSITIVE_INFINITY : index;
    }));
    const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
    if (!Number.isFinite(start) || end <= start) return {};
    return JSON.parse(raw.slice(start, end + 1));
  }
}

function normalizePosting(input) {
  const title = normalizeText(input.title);
  const company = normalizeText(input.company);
  const url = normalizeText(input.url);
  if (!title || !company || !url) return null;
  const rawLocation = normalizeText(input.location);
  const location = /remote|worldwide|anywhere/i.test(rawLocation) ? 'Remote' : rawLocation;
  const jdText = decodeHtml(input.jd_text || '').slice(0, 1800);
  const updatedAt = normalizeText(input.updated_at || '');
  if (!isRecentEnough(updatedAt)) return null;
  return {
    id: `job_${hashText(`${input.source || ''}|${company}|${title}|${location}|${url}`)}`,
    title,
    company,
    location,
    region: input.region || classifyRegion(`${location} ${company}`),
    source: normalizeText(input.source || '公开职位'),
    url,
    jd_text: jdText,
    summary: decodeHtml(input.summary || jdText).slice(0, 260),
    updated_at: updatedAt
  };
}

function compareAlpha(a, b) {
  const locale = ['zh-Hans-CN', 'en'];
  const companyCmp = String(a.company || '').localeCompare(String(b.company || ''), locale, { numeric: true, sensitivity: 'base' });
  if (companyCmp) return companyCmp;
  const titleCmp = String(a.title || '').localeCompare(String(b.title || ''), locale, { numeric: true, sensitivity: 'base' });
  if (titleCmp) return titleCmp;
  return String(a.location || '').localeCompare(String(b.location || ''), locale, { numeric: true, sensitivity: 'base' });
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item) return false;
    const key = `${item.source}|${item.company}|${item.title}|${item.location}|${item.url}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortJobs(items) {
  const rank = { mainland: 0, hongkong: 1, northamerica: 2, other: 3 };
  return [...items].sort((a, b) => {
    const regionCmp = (rank[a.region] ?? 9) - (rank[b.region] ?? 9);
    if (regionCmp) return regionCmp;
    return compareAlpha(a, b);
  });
}

function buildMirrorUrl(url) {
  return `https://r.jina.ai/http://${String(url || '').replace(/^https?:\/\//i, '')}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url, label, timeoutMs = 16000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    });
    if (!response.ok) throw new Error(`${label} failed (${response.status})`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHeadlessDom(url, label, timeoutMs = 20000) {
  const result = await execFileAsync(CHROME_BINARY, [
    '--headless=new',
    '--disable-gpu',
    '--dump-dom',
    url
  ], {
    timeout: timeoutMs,
    maxBuffer: 24 * 1024 * 1024
  }).catch((error) => {
    throw new Error(`${label} failed (${error.message || error})`);
  });
  return String(result.stdout || '');
}

async function fetchJson(url, label, timeoutMs = 16000) {
  const text = await fetchText(url, label, timeoutMs);
  return parseJsonText(text);
}

async function fetchTencentJobs() {
  const url = `https://careers.tencent.com/tencentcareer/api/post/Query?timestamp=${Date.now()}&pageIndex=1&pageSize=160&language=zh-cn&area=cn`;
  let payload = null;
  try {
    payload = await fetchJson(url, '腾讯招聘 1', 18000);
  } catch {
    payload = parseJsonText(await fetchText(buildMirrorUrl(url), '腾讯招聘镜像 1', 18000));
  }
  const list = payload?.Data?.Posts || [];
  return list.map((item) => normalizePosting({
      title: item.RecruitPostName,
      company: '腾讯',
      location: [item.CountryName, item.LocationName, item.WorkPlace].filter(Boolean).join(' · '),
      region: 'mainland',
      source: '腾讯招聘',
      url: item.PostId ? `https://careers.tencent.com/jobdesc.html?postId=${encodeURIComponent(item.PostId)}` : 'https://careers.tencent.com/search.html',
      jd_text: [item.Responsibility, item.Requirement].filter(Boolean).join('\n\n'),
      updated_at: item.LastUpdateTime || ''
  })).filter(Boolean);
}

async function fetchMeituanJobs() {
  const jobs = [];
  for (const keyword of MAINLAND_QUERIES) {
    for (let pageNo = 1; pageNo <= 10; pageNo += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 16000);
      let payload = {};
      try {
        const response = await fetch('https://zhaopin.meituan.com/api/official/job/getJobList', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'content-type': 'application/json',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            origin: 'https://zhaopin.meituan.com',
            referer: 'https://zhaopin.meituan.com/web/position'
          },
          body: JSON.stringify({
            page: { pageNo, pageSize: 30 },
            keywords: keyword
          })
        });
        payload = await response.json().catch(() => ({}));
      } catch {
        payload = {};
      } finally {
        clearTimeout(timer);
      }
      const list = Array.isArray(payload?.data?.list) ? payload.data.list : [];
      if (!list.length) break;
      jobs.push(...list.map((item) => normalizePosting({
        title: item.name,
        company: '美团',
        location: (item.cityList || []).map((city) => city?.name).filter(Boolean).join(' · '),
        region: 'mainland',
        source: '美团招聘',
        url: item.jobUnionId ? `https://zhaopin.meituan.com/web/position/detail?jobUnionId=${encodeURIComponent(item.jobUnionId)}` : 'https://zhaopin.meituan.com/web/position',
        jd_text: [item.jobDuty, item.jobRequirement, item.highLight].filter(Boolean).join('\n\n'),
        summary: [item.jobFamily, item.department?.[0]?.name, item.highLight].filter(Boolean).join(' · ')
      })).filter(Boolean));
    }
  }
  return jobs;
}

function extractLagouJobsFromPage(text) {
  const match = String(text || '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match) return [];
  const payload = parseJsonText(match[1]);
  const list = payload?.props?.pageProps?.initData?.content?.positionResult?.result || [];
  return (Array.isArray(list) ? list : []).map((item) => normalizePosting({
    title: item.positionName,
    company: item.companyShortName || item.companyFullName,
    location: [item.city, item.district].filter(Boolean).join(' · '),
    region: 'mainland',
    source: '拉勾招聘',
    url: item.positionId ? `https://www.lagou.com/wn/jobs/${encodeURIComponent(item.positionId)}.html` : 'https://www.lagou.com/wn/jobs',
    jd_text: item.positionDetail || '',
    summary: [item.salary, item.workYear, item.education, item.positionAdvantage].filter(Boolean).join(' · '),
    updated_at: item.createTime || item.formatCreateTime || ''
  })).filter(Boolean);
}

async function fetchLagouJobs() {
  const jobs = [];
  for (const keyword of MAINLAND_QUERIES.slice(0, 4)) {
    for (let page = 1; page <= 5; page += 1) {
      const url = `https://www.lagou.com/wn/jobs?cl=false&fromSearch=true&kd=${encodeURIComponent(keyword)}&pn=${page}`;
      try {
        const text = await fetchText(url, `拉勾招聘 ${keyword} 第 ${page} 页`, 18000);
        jobs.push(...extractLagouJobsFromPage(text));
      } catch {}
      await delay(160);
    }
  }
  return jobs;
}

function extractShixisengJobsFromText(text) {
  const blocks = String(text || '').split(/\n(?=\[[^\]]+\]\(https:\/\/www\.shixiseng\.com\/intern\/)/g);
  return blocks.map((block) => {
    const titleMatch = block.match(/^\[([^\]]+)\]\((https:\/\/www\.shixiseng\.com\/intern\/[^ )]+)[^)]*\)/m);
    if (!titleMatch) return null;
    const companyMatch = block.match(/\n\[([^\]\n]+)\]\(javascript:; "[^"]+"\)/);
    const locationMatch = block.match(/\n([^\n|]+)\|/);
    return normalizePosting({
      title: titleMatch[1].replace(//g, '').trim(),
      company: companyMatch ? companyMatch[1].trim() : '实习僧',
      location: locationMatch ? locationMatch[1].trim() : '中国',
      region: 'mainland',
      source: '实习僧',
      url: titleMatch[2],
      summary: block.split('\n').slice(0, 6).join(' ').replace(/\s+/g, ' ').trim()
    });
  }).filter(Boolean);
}

async function fetchShixisengJobs() {
  const tasks = [];
  for (const keyword of MAINLAND_QUERIES.slice(0, 6)) {
    for (let page = 1; page <= 10; page += 1) {
      const url = `https://r.jina.ai/http://www.shixiseng.com/interns?keyword=${encodeURIComponent(keyword)}&type=intern&city=%E5%85%A8%E5%9B%BD&page=${page}`;
      tasks.push(fetchText(url, `实习僧 ${keyword} 第 ${page} 页`, 18000).then(extractShixisengJobsFromText).catch(() => []));
    }
  }
  return (await Promise.all(tasks)).flat();
}

function extractByteDanceCampusJobsFromDom(text) {
  return [...String(text || '').matchAll(/<a[^>]+data-id="([^"]+)"[^>]+href="([^"]*\/campus\/position\/[^"]+\/detail)"[\s\S]*?<span class="positionItem-title-text">([^<]+)<\/span>[\s\S]*?<div class="subTitle__3sRa3 positionItem-subTitle">([\s\S]*?)<\/div>[\s\S]*?<div class="jobDesc__3ZDgU positionItem-jobDesc">([\s\S]*?)<\/div>/gi)]
    .map((match) => {
      const subMeta = [...match[4].matchAll(/<span[^>]*>([^<]+)<\/span>/gi)].map((item) => decodeHtml(item[1])).filter(Boolean);
      const location = subMeta[0] || '中国大陆';
      const summaryParts = subMeta.slice(1, 4);
      return normalizePosting({
        title: decodeHtml(match[3]),
        company: '字节跳动',
        location,
        region: 'mainland',
        source: '字节跳动校招',
        url: match[2].startsWith('http') ? match[2] : `https://job.bytedance.com${match[2]}`,
        jd_text: decodeHtml(match[5]),
        summary: [...summaryParts, decodeHtml(match[5]).slice(0, 120)].filter(Boolean).join(' · ')
      });
    })
    .filter(Boolean);
}

async function fetchByteDanceCampusJobs() {
  const jobs = [];
  for (const keyword of BYTEDANCE_QUERIES) {
    const url = `https://job.bytedance.com/campus/position?keywords=${encodeURIComponent(keyword)}`;
    try {
      const dom = await fetchHeadlessDom(url, `字节跳动校招 ${keyword}`, 26000);
      jobs.push(...extractByteDanceCampusJobsFromDom(dom));
    } catch {}
    await delay(160);
    if (dedupe(jobs).length >= 120) break;
  }
  return dedupe(jobs);
}

function extractJobrapidoJobs(text, source, region) {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const jobs = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const previewMatch = line.match(/^\[(?:打开职位预览：|Open job preview for:)\s*:?\s*([^\]]+?)\]\((https?:\/\/[^)\s]+)\)$/i);
    if (!previewMatch) continue;
    if (!(lines[index + 1] && /^###\s+/.test(lines[index + 1]))) continue;
    const titleLine = lines[index + 1].replace(/^###\s+/, '');
    const locationLine = lines[index + 2] || '';
    const companyLine = lines[index + 3] || '';
    const title = decodeHtml(titleLine.replace(/\*\*/g, '').replace(/\s+-\s+[^-]+$/, '').trim());
    const location = decodeHtml(locationLine.replace(/\*\*/g, '').trim());
    const company = decodeHtml(companyLine.replace(/\*\*/g, '').trim());
    if (!title || !company || !location) continue;
    jobs.push(normalizePosting({
      title,
      company,
      location,
      region,
      source,
      url: previewMatch[2],
      summary: `${company} · ${location}`
    }));
  }
  return jobs.filter(Boolean);
}

async function fetchJobrapidoMainlandJobs() {
  const jobs = [];
  const queries = ['%E4%BA%A7%E5%93%81', '%E4%BA%A7%E5%93%81%E7%BB%8F%E7%90%86', '%E8%BF%90%E8%90%A5', 'AI'];
  for (const query of queries) {
    for (let page = 1; page <= 4; page += 1) {
      const url = `https://r.jina.ai/http://cn.jobrapido.com/?q=${query}&l=%E4%B8%AD%E5%9B%BD&p=${page}`;
      try {
        const text = await fetchText(url, `Jobrapido 中国 ${query} ${page}`, 18000);
        jobs.push(...extractJobrapidoJobs(text, 'Jobrapido 中国', 'mainland'));
      } catch {}
      await delay(160);
      if (dedupe(jobs).length >= 140) return dedupe(jobs);
    }
    if (dedupe(jobs).length >= 140) break;
  }
  return dedupe(jobs);
}

async function fetchGreenhouseJobs() {
  const tasks = GREENHOUSE_SOURCES.map(async (source) => {
    const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.board)}/jobs?content=true`, source.source);
    return (data?.jobs || []).map((item) => normalizePosting({
      title: item.title,
      company: source.company,
      location: item.location?.name || '',
      source: source.source,
      url: item.absolute_url,
      jd_text: decodeHtml(item.content || ''),
      updated_at: item.updated_at || ''
    })).filter(Boolean);
  });
  return (await Promise.all(tasks)).flat();
}

function extractCtgoodjobsJobsFromPage(text) {
  const raw = String(text || '');
  const ldMatch = raw.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (ldMatch) {
    try {
      const schema = JSON.parse(ldMatch[1]);
      const items = Array.isArray(schema?.itemListElement) ? schema.itemListElement : [];
      return items.map((item) => {
        const rawName = normalizeText(item?.name || '');
        const rawUrl = normalizeText(item?.url || '');
        if (!rawName || !rawUrl) return null;
        const parts = rawName.split(/\s+-\s+/);
        const company = parts.length > 1 ? normalizeText(parts.pop()) : 'CTgoodjobs';
        const title = normalizeText(parts.join(' - ') || rawName);
        return normalizePosting({
          title,
          company,
          location: 'Hong Kong',
          region: 'hongkong',
          source: 'CTgoodjobs',
          url: rawUrl,
          summary: `${company} · Hong Kong`
        });
      }).filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
}

async function fetchCtgoodjobsJobs() {
  const tasks = [];
  for (const base of CTGOODJOBS_PAGES) {
    for (let page = 1; page <= 6; page += 1) {
      const url = page === 1 ? base : `${base}?page=${page}`;
      tasks.push(fetchText(url, `CTgoodjobs ${page}`, 18000).then(extractCtgoodjobsJobsFromPage).catch(() => []));
    }
  }
  return (await Promise.all(tasks)).flat();
}

function extractHkSlashJobsFromPage(text) {
  const match = String(text || '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match) return [];
  const payload = parseJsonText(match[1]);
  const list = payload?.props?.initialState?.jobs?.data?.elements || [];
  return (Array.isArray(list) ? list : []).map((item) => normalizePosting({
    title: item.name,
    company: item.user?.name || 'HKSlash',
    location: (item.locations || []).map((location) => location?.name || location?.text).filter(Boolean).join(' · ') || 'Hong Kong',
    region: 'hongkong',
    source: 'HKSlash',
    url: item.id ? `https://www.hkslash.com/zh/job/${encodeURIComponent(item.id)}` : 'https://www.hkslash.com/zh/jobs',
    jd_text: item.description || '',
    summary: [item.education?.text, item.salaryCurrency?.text].filter(Boolean).join(' · ')
  })).filter(Boolean);
}

async function fetchHkSlashJobs() {
  const tasks = [];
  for (let page = 1; page <= 10; page += 1) {
    tasks.push(fetchText(`https://www.hkslash.com/zh/jobs?page=${page}`, `HKSlash ${page}`, 18000).then(extractHkSlashJobsFromPage).catch(() => []));
  }
  return (await Promise.all(tasks)).flat();
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
      summary: `${decodeHtml(match[3])} · ${decodeHtml(match[4])}`
    }))
    .filter(Boolean);
}

async function fetchJoblumHongKongJobs() {
  const jobs = [];
  for (const route of JOBLUM_HK_PATHS) {
    try {
      const text = await fetchText(`https://hk.joblum.com${route}`, `Joblum Hong Kong ${route}`, 18000);
      jobs.push(...extractJoblumHongKongJobsFromPage(text));
    } catch {}
    await delay(120);
  }
  return jobs;
}

async function fetchJobrapidoHongKongJobs() {
  const jobs = [];
  const queries = ['product', 'manager', 'analyst', 'operation', 'business', 'marketing', 'finance'];
  for (const query of queries) {
    for (let page = 1; page <= 6; page += 1) {
      const url = `https://r.jina.ai/http://hk.jobrapido.com/?q=${encodeURIComponent(query)}&l=hong-kong&p=${page}`;
      try {
        const text = await fetchText(url, `Jobrapido Hong Kong ${query} ${page}`, 18000);
        jobs.push(...extractJobrapidoJobs(text, 'Jobrapido Hong Kong', 'hongkong'));
      } catch {}
      await delay(160);
    }
  }
  return jobs;
}

function extractRecruitJobsFromPage(text) {
  return [...String(text || '').matchAll(/href=['"]([^'"]*\/job-detail\/([^/'"]+)\/([^/'"]+)\/[^'"]+)['"]/gi)]
    .map((match) => {
      const companyName = decodeURIComponent(match[2] || '').replace(/[-_]+/g, ' ').trim() || '公司未公开';
      const title = decodeURIComponent(match[3] || '').replace(/[-_]+/g, ' ').trim() || '职位未公开';
      return normalizePosting({
      title,
      company: companyName,
      location: 'Hong Kong',
      region: 'hongkong',
      source: 'Recruit.com.hk',
      url: match[1].startsWith('http') ? match[1] : `https://www.recruit.com.hk${match[1]}`,
      summary: `${companyName} · Hong Kong`
    });
    })
    .filter(Boolean);
}

function extractRecruitIndexLinks(text) {
  const matches = [...String(text || '').matchAll(/href=['"]([^'"]*(?:job-function-q|job-category)[^'"]*)['"]/gi)];
  return [...new Set(matches.map((match) => {
    const href = normalizeText(match[1]);
    if (!href) return '';
    return href.startsWith('http') ? href : `https://www.recruit.com.hk${href}`;
  }).filter(Boolean))];
}

async function fetchRecruitHongKongJobs() {
  const jobs = [];
  let links = [RECRUIT_HOME];
  try {
    const homepage = await fetchText(RECRUIT_HOME, 'Recruit.com.hk 首页', 18000);
    jobs.push(...extractRecruitJobsFromPage(homepage));
    links = links.concat(extractRecruitIndexLinks(homepage).slice(0, 64));
  } catch {}
  for (const url of [...new Set(links)]) {
    try {
      const text = await fetchText(url, url, 18000);
      jobs.push(...extractRecruitJobsFromPage(text));
    } catch {}
    await delay(120);
  }
  return jobs;
}

function extractTalentJobsFromHtml(text, options) {
  const opts = options || {};
  const baseUrl = opts.baseUrl || 'https://hk.talent.com';
  const region = opts.region || 'other';
  const source = opts.source || 'Talent';
  return [...String(text || '').matchAll(/<div[^>]+data-testid="jobcard-container-[^"]+"[\s\S]*?<h2[^>]*class="JobCard_title__[^"]*">([\s\S]*?)<\/h2>[\s\S]*?<span[^>]*class="JobCard_company__[^"]*">([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class="JobCard_location__[^"]*">([\s\S]*?)<\/span>[\s\S]*?<a[^>]+href="(\/view\?id=[^"]+)"[\s\S]*?<time[^>]*dateTime="([^"]*)"/gi)]
    .map((match) => normalizePosting({
      title: decodeHtml(match[1]),
      company: decodeHtml(match[2]),
      location: decodeHtml(match[3]),
      region,
      source,
      url: new URL(match[4], baseUrl).toString(),
      updated_at: match[5] || ''
    }))
    .filter(Boolean);
}

async function fetchTalentRegionJobs(options) {
  const opts = options || {};
  const domain = opts.domain || 'cn';
  const region = opts.region || 'mainland';
  const source = opts.source || 'Talent';
  const location = opts.location || (domain === 'hk' ? 'hong+kong' : '%E4%B8%AD%E5%9B%BD');
  const queries = Array.isArray(opts.queries) ? opts.queries : [];
  const pageLimit = opts.pageLimit || 6;
  const baseUrl = opts.baseUrl || `https://${domain}.talent.com`;
  const jobs = [];
  for (const query of queries) {
    for (let page = 1; page <= pageLimit; page += 1) {
      const url = `${baseUrl}/jobs?k=${query}&l=${location}&p=${page}`;
      try {
        const text = await fetchText(url, `${source} ${query} ${page}`, 18000);
        jobs.push(...extractTalentJobsFromHtml(text, { baseUrl, region, source }));
      } catch {}
      await delay(120);
    }
  }
  return jobs;
}

async function fetchTalentHongKongJobs() {
  return fetchTalentRegionJobs({
    domain: 'hk',
    region: 'hongkong',
    source: 'Talent Hong Kong',
    location: 'hong+kong',
    baseUrl: 'https://hk.talent.com',
    queries: ['product', 'manager', 'analyst', 'finance', 'marketing', 'sales', 'engineer'],
    pageLimit: 4
  });
}

async function fetchTalentChinaJobs() {
  return fetchTalentRegionJobs({
    domain: 'cn',
    region: 'mainland',
    source: 'Talent 中国',
    location: '%E4%B8%AD%E5%9B%BD',
    baseUrl: 'https://cn.talent.com',
    queries: ['%E4%BA%A7%E5%93%81', '%E6%95%B0%E6%8D%AE', '%E8%BF%90%E8%90%A5', 'AI', '%E5%95%86%E4%B8%9A%E5%88%86%E6%9E%90'],
    pageLimit: 4
  });
}

async function fetchRemotiveJobs() {
  const data = await fetchJson('https://remotive.com/api/remote-jobs', 'Remotive');
  return (data?.jobs || []).slice(0, 120).map((item) => normalizePosting({
    title: item.title,
    company: item.company_name,
    location: item.candidate_required_location || 'Remote',
    region: 'other',
    source: 'Remotive',
    url: item.url,
    jd_text: decodeHtml(item.description || ''),
    updated_at: item.publication_date || ''
  })).filter(Boolean);
}

async function fetchJobicyJobs() {
  const data = await fetchJson('https://jobicy.com/api/v2/remote-jobs?count=120', 'Jobicy');
  const list = Array.isArray(data?.jobs) ? data.jobs : [];
  return list.map((item) => normalizePosting({
    title: item.jobTitle || item.title,
    company: item.companyName || item.company || 'Jobicy',
    location: item.jobGeo || item.candidateRequiredLocation || 'Remote',
    region: 'other',
    source: 'Jobicy',
    url: item.url || item.jobUrl,
    jd_text: decodeHtml(item.jobDescription || ''),
    updated_at: item.pubDate || ''
  })).filter(Boolean);
}

async function fetchRemoteOkJobs() {
  const data = await fetchJson('https://remoteok.com/api', 'Remote OK');
  const list = Array.isArray(data) ? data.slice(1) : [];
  return list.map((item) => normalizePosting({
    title: item.position || item.title,
    company: item.company || 'Remote OK',
    location: item.location || 'Remote',
    region: 'other',
    source: 'Remote OK',
    url: item.url ? `https://remoteok.com${item.url}` : item.apply_url,
    jd_text: decodeHtml(item.description || ''),
    updated_at: item.date || ''
  })).filter(Boolean);
}

function selectJobsWithSourceFloors(items, limit = DEFAULT_LIMIT) {
  const sorted = sortJobs(dedupe(items));
  const picked = [];
  const pickedIds = new Set();
  for (const floor of TARGET_SOURCE_FLOORS) {
    const matches = sorted.filter((job) => job.region === floor.region && job.source === floor.source).slice(0, floor.min);
    if (matches.length < floor.min) {
      console.warn(`[job-cache] source floor not met: ${floor.source} ${matches.length}/${floor.min}`);
    }
    for (const job of matches) {
      if (pickedIds.has(job.id)) continue;
      pickedIds.add(job.id);
      picked.push(job);
    }
  }
  for (const job of sorted) {
    if (picked.length >= limit) break;
    if (pickedIds.has(job.id)) continue;
    pickedIds.add(job.id);
    picked.push(job);
  }
  return picked.slice(0, limit);
}

async function writeLocalCache(payload) {
  await fs.writeFile(OUTPUT_JS, `window.RT_JOB_BOARD_CACHE = ${JSON.stringify(payload, null, 2)};\n`, 'utf8');
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function encodeStoragePath(objectPath) {
  return String(objectPath || '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function ensureSharedBucket() {
  if (!SUPABASE_SERVICE_ROLE_KEY) return false;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      id: SHARED_STORAGE_BUCKET,
      name: SHARED_STORAGE_BUCKET,
      public: true,
      file_size_limit: '20971520',
      allowed_mime_types: ['application/json', 'text/plain', 'image/png', 'image/jpeg', 'image/webp']
    })
  });
  if (response.ok) return true;
  const text = await response.text().catch(() => '');
  if (response.status === 400 || response.status === 409) {
    const lower = String(text || '').toLowerCase();
    if (lower.includes('already exists') || lower.includes('duplicate') || lower.includes('exists')) return true;
  }
  throw new Error(`Supabase shared bucket ensure failed (${response.status}): ${text}`);
}

async function uploadSharedStorageObject(objectPath, body, contentType) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return false;
  await ensureSharedBucket();
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${SHARED_STORAGE_BUCKET}/${encodeStoragePath(objectPath)}`, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'x-upsert': 'true'
    },
    body
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Supabase storage upload failed (${response.status}): ${text}`);
  }
  return true;
}

async function uploadSharedJobCache(payload) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return false;
  return uploadSharedStorageObject(SHARED_JOB_CACHE_PATH, JSON.stringify(payload, null, 2), 'application/json');
}

async function upsertRemoteCache(payload) {
  if (!SUPABASE_SERVICE_ROLE_KEY) return false;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${CACHE_TABLE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify([{
      cache_key: CACHE_KEY,
      payload,
      updated_at: payload.updated_at
    }])
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 404 || /rt_public_job_board_cache/i.test(text)) {
      return false;
    }
    throw new Error(`Supabase cache upsert failed (${response.status}): ${text}`);
  }
  return true;
}

async function main() {
  async function safeFetch(label, task) {
    const startedAt = Date.now();
    console.log(`[job-cache] fetching ${label}...`);
    try {
      const result = await task();
      console.log(`[job-cache] fetched ${label}: ${Array.isArray(result) ? result.length : 0} jobs in ${Date.now() - startedAt}ms`);
      return result;
    } catch (error) {
      console.warn(`[job-cache] ${label} skipped: ${error?.message || error || 'unknown error'}`);
      return [];
    }
  }

  const buckets = [];
  buckets.push(await safeFetch('Jobrapido 中国', fetchJobrapidoMainlandJobs));
  buckets.push(await safeFetch('Talent Hong Kong', fetchTalentHongKongJobs));
  buckets.push(await safeFetch('Joblum Hong Kong', fetchJoblumHongKongJobs));
  buckets.push(await safeFetch('Recruit.com.hk', fetchRecruitHongKongJobs));
  buckets.push(await safeFetch('腾讯招聘', fetchTencentJobs));
  buckets.push(await safeFetch('美团招聘', fetchMeituanJobs));
  buckets.push(await safeFetch('拉勾招聘', fetchLagouJobs));
  buckets.push(await safeFetch('实习僧', fetchShixisengJobs));
  buckets.push(await safeFetch('Greenhouse', fetchGreenhouseJobs));
  buckets.push(await safeFetch('CTgoodjobs', fetchCtgoodjobsJobs));
  buckets.push(await safeFetch('HKSlash', fetchHkSlashJobs));
  buckets.push(await safeFetch('Remotive', fetchRemotiveJobs));
  buckets.push(await safeFetch('Jobicy', fetchJobicyJobs));
  buckets.push(await safeFetch('Remote OK', fetchRemoteOkJobs));
  const jobs = selectJobsWithSourceFloors(buckets.flat(), DEFAULT_LIMIT);
  const payload = {
    updated_at: new Date().toISOString(),
    source_label: '最近更新职位池',
    source_count: new Set(jobs.map((job) => job.source).filter(Boolean)).size,
    jobs
  };
  await writeLocalCache(payload);
  await uploadSharedJobCache(payload).catch((error) => {
    console.warn('[job-cache] shared storage upload skipped:', error.message);
  });
  await upsertRemoteCache(payload).catch((error) => {
    console.warn('[job-cache] remote upsert skipped:', error.message);
  });
  console.log(`[job-cache] wrote ${jobs.length} jobs`);
}

main().catch((error) => {
  console.error('[job-cache] failed:', error);
  process.exit(1);
});
