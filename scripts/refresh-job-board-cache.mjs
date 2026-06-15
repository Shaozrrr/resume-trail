import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const CWD = process.cwd();
const ROOT = path.basename(CWD) === 'resume-trail-work' ? CWD : path.resolve(CWD, 'resume-trail-work');
const OUTPUT_JS = path.join(ROOT, 'assets', 'job-board-cache.js');
const OUTPUT_JSON = path.join(ROOT, 'assets', 'job-board-cache.json');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bpynqhujzvadyakypfju.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CACHE_TABLE = 'rt_public_job_board_cache';
const CACHE_KEY = 'default';
const SHARED_STORAGE_BUCKET = 'rt-shared';
const SHARED_JOB_CACHE_PATH = 'jobs/job-board-cache.json';
const CACHE_RETENTION_DAYS = 14;
const CHROME_BINARY = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const execFileAsync = promisify(execFile);
const MAINLAND_QUERIES = ['产品经理', 'AI产品经理', '数据产品经理', '商业分析', '产品运营', '增长运营', '前端开发', '后端开发'];
const BYTEDANCE_QUERIES = ['运营', '用户', '电商', '商业化', '内容', '豆包', 'TRAE', '生活服务', '音乐', '开发者服务', '产品'];
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
const LEVER_SOURCES = [
  { company: 'Plaid', board: 'plaid', source: 'Lever' },
  { company: 'Scale AI', board: 'scaleai', source: 'Lever' },
  { company: 'Rippling', board: 'rippling', source: 'Lever' },
  { company: 'Postman', board: 'postman', source: 'Lever' },
  { company: 'Motive', board: 'gomotive', source: 'Lever' }
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
  const raw = String(value || '');
  let repaired = raw;
  if (/[Ãâ€œâ€â€˜â€™]/.test(raw)) {
    try {
      const decoded = Buffer.from(raw, 'latin1').toString('utf8');
      if (decoded && /[^\u0000-\u001f]/.test(decoded)) repaired = decoded;
    } catch {}
  }
  return repaired
    .replace(/\p{Co}/gu, ' ')
    .replace(/\uFFFD/g, ' ')
    .replace(/[\uFE0E\uFE0F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeJsonFragment(value) {
  const raw = String(value || '');
  if (!raw) return '';
  try {
    return JSON.parse(`"${raw.replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`);
  } catch {
    return raw;
  }
}

function squeezeHanSpacing(value) {
  let output = String(value || '');
  let previous = '';
  while (previous !== output) {
    previous = output;
    output = output
      .replace(/([\p{Script=Han}])\s+([\p{Script=Han}])/gu, '$1$2')
      .replace(/([\p{Script=Han}])\s+([A-Za-z0-9])/gu, '$1$2')
      .replace(/([A-Za-z0-9])\s+([\p{Script=Han}])/gu, '$1$2');
  }
  return output;
}

function cleanupDisplayText(value) {
  return squeezeHanSpacing(
    normalizeText(value)
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\s*([（(【\[])\s*/g, '$1')
      .replace(/\s*([）)】\]])/g, '$1')
      .replace(/[（(【\[]\s*[）)】\]]/g, '')
      .replace(/^\s*[-–—·•:：;,|/]+\s*/g, '')
      .replace(/\s*[-–—·•:：;,|/]+\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function cleanupLocationText(value) {
  const text = cleanupDisplayText(value)
    .replace(/\bHong Kong Hong Kong\b/gi, 'Hong Kong')
    .replace(/\bUnited States of America\b/gi, 'United States')
    .replace(/\bRemote(?:\s*-\s*Remote)+\b/gi, 'Remote')
    .trim();
  return /remote|worldwide|anywhere/i.test(text) ? 'Remote' : text;
}

function isLikelySourcePlaceholder(name, source) {
  const text = cleanupDisplayText(name).toLowerCase();
  const sourceText = cleanupDisplayText(source).toLowerCase();
  if (!text) return true;
  if (sourceText && text === sourceText) return true;
  if (text.includes('ctgoodjobs')) return true;
  if (text.includes('recruit.com.hk')) return true;
  if (text === 'talent' || text.includes('talent hong kong')) return true;
  return /^(ctgoodjobs|jobicy|remote ok|remotive|recruit\.com\.hk|talent hong kong|talent 中国|talent|hkslash)$/i.test(text);
}

function isLikelyInvalidCompanyName(name, source) {
  const text = cleanupDisplayText(name);
  if (!text) return true;
  if (isLikelySourcePlaceholder(text, source)) return true;
  if (/ref\.?\s*no\.?/i.test(text)) return true;
  if (/monthly income/i.test(text)) return true;
  if (/^\$?\d[\d\s,./()\-a-z]*$/i.test(text)) return true;
  if (/^\d+\s+(days?\s+work|vacanc(?:y|ies))/i.test(text)) return true;
  if (/^[\d\s$().\-_/]+$/i.test(text)) return true;
  return false;
}

function sanitizeCompanyName(name, source) {
  let text = cleanupDisplayText(name).replace(/^\d+\s+(?=[A-Za-z])/u, '').trim();
  if (source === 'Recruit.com.hk') text = text.replace(/^\d+\s+/, '').trim();
  return text;
}

function sanitizeJobTitle(title) {
  return cleanupDisplayText(title)
    .replace(/^[\-–—|/]+\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function resolvePostingRegion(explicitRegion, locationText, fallbackText) {
  const locationInferred = classifyRegion(locationText);
  const inferred = locationInferred !== 'other' ? locationInferred : classifyRegion(fallbackText);
  const normalized = normalizeText(explicitRegion).toLowerCase();
  if (inferred === 'other' && normalized) return normalized;
  if (!normalized || normalized === 'other') return inferred;
  return normalized;
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
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyRegion(value) {
  const text = cleanupLocationText(value).toLowerCase();
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
  const title = sanitizeJobTitle(input.title);
  const company = sanitizeCompanyName(input.company, input.source || '');
  const url = normalizeText(input.url);
  if (!title || !company || !url) return null;
  if (isLikelyInvalidCompanyName(company, input.source || '')) return null;
  const location = cleanupLocationText(input.location);
  const jdText = decodeHtml(input.jd_text || '').slice(0, 1800);
  const updatedAt = normalizeText(input.updated_at || '');
  if (!isRecentEnough(updatedAt)) return null;
  const region = resolvePostingRegion(input.region, location, `${company} ${title}`);
  return {
    id: `job_${hashText(`${input.source || ''}|${company}|${title}|${location}|${url}`)}`,
    title,
    company,
    location,
    region,
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

function makeJobMergeKey(job) {
  return `${job.source}|${job.url}`.toLowerCase();
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item) return false;
    const key = makeJobMergeKey(item);
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

async function mapBatched(items, limit, worker) {
  const results = [];
  const concurrency = Math.max(1, Math.min(limit || 1, items.length || 1));
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => run()));
  return results;
}

async function fetchTencentJobs() {
  const pageSize = 160;
  async function fetchPage(pageIndex) {
    const url = `https://careers.tencent.com/tencentcareer/api/post/Query?timestamp=${Date.now()}&pageIndex=${pageIndex}&pageSize=${pageSize}&language=zh-cn&area=cn`;
    try {
      return await fetchJson(url, `腾讯招聘 ${pageIndex}`, 18000);
    } catch {
      return parseJsonText(await fetchText(buildMirrorUrl(url), `腾讯招聘镜像 ${pageIndex}`, 18000));
    }
  }
  const firstPage = await fetchPage(1);
  const firstList = Array.isArray(firstPage?.Data?.Posts) ? firstPage.Data.Posts : [];
  const totalCount = Number(firstPage?.Data?.Count || firstPage?.Data?.TotalCount || firstList.length) || firstList.length;
  const totalPages = Math.max(1, Math.min(Math.ceil(totalCount / pageSize), 50));
  const remainingPages = [];
  for (let pageIndex = 2; pageIndex <= totalPages; pageIndex += 1) remainingPages.push(pageIndex);
  const restPages = await mapBatched(remainingPages, 6, async (pageIndex) => {
    try {
      const payload = await fetchPage(pageIndex);
      return Array.isArray(payload?.Data?.Posts) ? payload.Data.Posts : [];
    } catch {
      return [];
    }
  });
  return firstList.concat(restPages.flat()).map((item) => normalizePosting({
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
  for (const keyword of MAINLAND_QUERIES) {
    for (let page = 1; page <= 10; page += 1) {
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
  const blocks = String(text || '').split(/<div data-intern-id="/g).slice(1);
  return blocks.map((block) => {
    const titleMatch = block.match(/href="(https:\/\/www\.shixiseng\.com\/intern\/[^"?]+)[^"]*"[^>]*title="([^"]+)"/i);
    if (!titleMatch) return null;
    const companyMatch = block.match(/<a title="([^"]+)" href="javascript:;" class="title ellipsis"/i);
    const locationMatch = block.match(/<span class="city ellipsis"[^>]*>([^<]+)</i);
    const summaryParts = [...block.matchAll(/<span title="([^"]+)" class="intern-label"/gi)].map((item) => decodeHtml(item[1])).filter(Boolean);
    return normalizePosting({
      title: decodeHtml(titleMatch[2]).replace(/&#xe[0-9a-f]+;/gi, ''),
      company: companyMatch ? decodeHtml(companyMatch[1]) : '',
      location: locationMatch ? decodeHtml(locationMatch[1]) : '中国',
      region: 'mainland',
      source: '实习僧',
      url: decodeHtml(titleMatch[1]),
      summary: summaryParts.join(' · ')
    });
  }).filter(Boolean);
}

function isSuspiciousShixisengTitle(title) {
  const text = cleanupDisplayText(title);
  // 实习僧列表页偶尔会把首字或中间字包在 icon/font 节点里，title 属性只剩残缺文本。
  // 这不是固定字面问题，所以这里只做异常告警；最终标题一律以详情页标题为准。
  return /^[\u4e00-\u9fff]{1,2}[\u4e00-\u9fffA-Za-z0-9（）()·\s-]*(实习|运营|分析|经营)/u.test(text) && text.length <= 6;
}

function extractShixisengDetailTitle(text, company) {
  const raw = String(text || '');
  const markdownTitle = raw.match(/^#\s+(.+?)(?:实习招聘-[^-]+实习生招聘-实习僧)?\s*$/m)?.[1];
  const htmlTitle = raw.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  const title = cleanupDisplayText(markdownTitle || htmlTitle || '')
    .replace(/实习招聘-[\s\S]*?实习生招聘-实习僧$/u, '')
    .replace(/实习招聘-实习僧$/u, '')
    .replace(new RegExp(`-${company || ''}实习生招聘-实习僧$`, 'u'), '')
    .trim();
  return title;
}

async function fetchShixisengDetailTitle(url, company) {
  const direct = await fetchText(url, `实习僧详情 ${url}`, 18000).catch(() => '');
  let title = extractShixisengDetailTitle(direct, company);
  if (title) return title;
  const mirror = await fetchText(`https://r.jina.ai/http://${String(url).replace(/^https?:\/\//, '')}`, `实习僧详情镜像 ${url}`, 18000).catch(() => '');
  title = extractShixisengDetailTitle(mirror, company);
  return title || '';
}

async function repairShixisengJobTitles(jobs) {
  const repaired = await mapBatched(jobs, 8, async (job) => {
    const title = await fetchShixisengDetailTitle(job.url, job.company);
    if (!title) return job;
    if (title === job.title) return job;
    return normalizePosting(Object.assign({}, job, {
      title,
      source: '实习僧'
    })) || Object.assign({}, job, { title });
  });
  return repaired.filter(Boolean);
}

async function fetchShixisengJobs() {
  const tasks = [];
  for (const keyword of MAINLAND_QUERIES.slice(0, 6)) {
    for (let page = 1; page <= 10; page += 1) {
      const url = `https://www.shixiseng.com/interns?keyword=${encodeURIComponent(keyword)}&type=intern&city=%E5%85%A8%E5%9B%BD&page=${page}`;
      const fallbackUrl = `https://r.jina.ai/http://www.shixiseng.com/interns?keyword=${encodeURIComponent(keyword)}&type=intern&city=%E5%85%A8%E5%9B%BD&page=${page}`;
      tasks.push(
        fetchText(url, `实习僧 ${keyword} 第 ${page} 页`, 18000)
          .then(extractShixisengJobsFromText)
          .catch(() => fetchText(fallbackUrl, `实习僧镜像 ${keyword} 第 ${page} 页`, 18000).then(extractShixisengJobsFromText).catch(() => []))
      );
    }
  }
  return repairShixisengJobTitles((await Promise.all(tasks)).flat());
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
  const queries = ['%E4%BA%A7%E5%93%81', '%E4%BA%A7%E5%93%81%E7%BB%8F%E7%90%86', '%E8%BF%90%E8%90%A5', 'AI', '%E5%95%86%E4%B8%9A%E5%88%86%E6%9E%90', '%E5%A2%9E%E9%95%BF%E8%BF%90%E8%90%A5', '%E6%95%B0%E6%8D%AE', '%E5%BC%80%E5%8F%91'];
  const pageRequests = queries.flatMap((query) => Array.from({ length: 8 }, (_, index) => ({ query, page: index + 1 })));
  const buckets = await mapBatched(pageRequests, 2, async ({ query, page }) => {
    const url = `https://r.jina.ai/http://cn.jobrapido.com/?q=${query}&l=%E4%B8%AD%E5%9B%BD&p=${page}`;
    try {
      const text = await fetchText(url, `Jobrapido 中国 ${query} ${page}`, 18000);
      return extractJobrapidoJobs(text, 'Jobrapido 中国', 'mainland');
    } catch {
      return [];
    }
  });
  return dedupe(buckets.flat());
}

async function fetchJobrapidoHongKongJobs() {
  const queries = ['product', 'manager', 'analyst', 'operation', 'business', 'marketing', 'finance'];
  const pageRequests = queries.flatMap((query) => Array.from({ length: 6 }, (_, index) => ({ query, page: index + 1 })));
  const buckets = await mapBatched(pageRequests, 2, async ({ query, page }) => {
    const url = `https://r.jina.ai/http://hk.jobrapido.com/?q=${encodeURIComponent(query)}&l=hong-kong&p=${page}`;
    try {
      const text = await fetchText(url, `Jobrapido Hong Kong ${query} ${page}`, 18000);
      return extractJobrapidoJobs(text, 'Jobrapido Hong Kong', 'hongkong');
    } catch {
      return [];
    }
  });
  return dedupe(buckets.flat());
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

function compactCtgoodjobsFlightText(text) {
  return String(text || '')
    .replace(/"\]\)<\/script><script>self\.__next_f\.push\(\[1,"/g, '')
    .replace(/<\/script><script>self\.__next_f\.push\(\[1,"/g, '')
    .replace(/<script>self\.__next_f\.push\(\[1,"/g, '')
    .replace(/"\]\)<\/script>/g, '');
}

function extractEscapedJsonField(block, field) {
  const pattern = new RegExp(`\\\\"${field}\\\\"\\s*:\\s*\\\\"((?:\\\\\\\\.|[^"])*)\\\\"`);
  const match = String(block || '').match(pattern);
  return match ? decodeJsonFragment(match[1]) : '';
}

function extractCtgoodjobsRecordsFromPage(text) {
  const records = [];
  const seen = new Set();
  const raw = compactCtgoodjobsFlightText(text);
  const urlRegex = /\\"url\\"\s*:\s*\\"(https:\/\/jobs\.ctgoodjobs\.hk\/job\/(?:\\\\.|[^"])*)\\"/g;
  for (const match of raw.matchAll(urlRegex)) {
    const blockStart = Math.max(0, raw.lastIndexOf('\\"jobTitle\\"', match.index));
    const nextStart = raw.indexOf('\\"jobTitle\\"', match.index + match[0].length);
    const block = raw.slice(blockStart, nextStart === -1 ? Math.min(raw.length, match.index + 3000) : nextStart);
    const url = decodeJsonFragment(match[1]);
    if (!url || seen.has(url)) continue;
    const title = extractEscapedJsonField(block, 'jobTitle');
    const company = extractEscapedJsonField(block, 'companyName');
    if (!title && !company) continue;
    seen.add(url);
    records.push({
      title,
      company,
      location: 'Hong Kong',
      region: 'hongkong',
      source: 'CTgoodjobs',
      url
    });
  }
  return records;
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
    summary: `${record.company || ''} · ${record.location || 'Hong Kong'}`
  });
}

function isCtgoodjobsRecordSuspect(record) {
  const raw = `${record?.title || ''} ${record?.company || ''}`;
  const company = cleanupDisplayText(record?.company || '');
  if (/[\p{Co}\uFFFD]/u.test(raw)) return true;
  if (!company || isLikelyInvalidCompanyName(company, 'CTgoodjobs')) return true;
  return /^(?:[$€£¥]|HK\$|\d+\s+(?:days?\s+work|vacanc(?:y|ies))|.*ref\.?\s*no\.?)/i.test(company);
}

function extractCtgoodjobsDetailFromPage(text, url) {
  const raw = compactCtgoodjobsFlightText(text);
  const detail = { url };
  const escapedTitle = raw.match(/\\"title\\"\s*:\s*\\"((?:\\\\.|[^"])*)\\"/);
  const escapedCompany = raw.match(/\\"hiringOrganization\\"\s*:\s*\{[\s\S]{0,900}?\\"name\\"\s*:\s*\\"((?:\\\\.|[^"])*)\\"/);
  if (escapedTitle) detail.title = decodeJsonFragment(escapedTitle[1]);
  if (escapedCompany) detail.company = decodeJsonFragment(escapedCompany[1]);

  const plainTitle = raw.match(/"title"\s*:\s*"([^"]+)"/);
  const plainCompany = raw.match(/"hiringOrganization"\s*:\s*\{[\s\S]{0,900}?"name"\s*:\s*"([^"]+)"/);
  if (!detail.title && plainTitle) detail.title = decodeHtml(plainTitle[1]);
  if (!detail.company && plainCompany) detail.company = decodeHtml(plainCompany[1]);

  const titleTag = decodeHtml(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const titleParts = titleTag.replace(/\s*\|\s*CTgoodjobs\s*$/i, '').split(/\s+-\s+/);
  if (titleParts.length >= 2) {
    if (!detail.company || isLikelyInvalidCompanyName(detail.company, 'CTgoodjobs')) detail.company = titleParts.pop();
    if (!detail.title) detail.title = titleParts.join(' - ');
  }
  const locationMatch = raw.match(/\\"jobLocation\\"\s*:\s*\{[\s\S]{0,1400}?\\"addressLocality\\"\s*:\s*\\"((?:\\\\.|[^"])*)\\"/);
  if (locationMatch) detail.location = decodeJsonFragment(locationMatch[1]);
  const descriptionMatch = raw.match(/\\"description\\"\s*:\s*\\"((?:\\\\.|[^"])*)\\"/);
  if (descriptionMatch) detail.jd_text = decodeJsonFragment(descriptionMatch[1]);
  const dateMatch = raw.match(/\\"datePosted\\"\s*:\s*\\"((?:\\\\.|[^"])*)\\"/) || raw.match(/"datePosted"\s*:\s*"([^"]+)"/);
  if (dateMatch) detail.updated_at = decodeJsonFragment(dateMatch[1]);
  return detail;
}

async function repairCtgoodjobsRecord(record) {
  if (!isCtgoodjobsRecordSuspect(record)) return record;
  try {
    const detailText = await fetchText(record.url, `CTgoodjobs detail ${record.url}`, 18000);
    const detail = extractCtgoodjobsDetailFromPage(detailText, record.url);
    return Object.assign({}, record, detail);
  } catch {
    return record;
  }
}

async function normalizeCtgoodjobsRecords(records) {
  const unique = dedupe((records || []).map((record) => ({
    id: `raw_${hashText(record.url || `${record.company}|${record.title}`)}`,
    source: 'CTgoodjobs',
    url: record.url,
    company: record.company,
    title: record.title,
    location: record.location || 'Hong Kong',
    region: 'hongkong'
  })));
  const repaired = await mapBatched(unique, 5, repairCtgoodjobsRecord);
  return repaired.map(normalizeCtgoodjobsRecord).filter(Boolean);
}

function extractCtgoodjobsTotalPages(text, pageSize) {
  const raw = String(text || '');
  const totalMatch = raw.match(/Explore\s+(\d+)\s+jobs/i) || raw.match(/(\d+)\s+Jobs Matched/i);
  const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
  if (!total || !pageSize) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

async function fetchCtgoodjobsJobs() {
  const buckets = await mapBatched(CTGOODJOBS_PAGES, 3, async (base) => {
    const firstText = await fetchText(base, `CTgoodjobs ${base}`, 18000);
    const firstRecords = extractCtgoodjobsRecordsFromPage(firstText);
    const totalPages = Math.min(extractCtgoodjobsTotalPages(firstText, firstRecords.length), 80);
    const pageUrls = [];
    for (let page = 2; page <= totalPages; page += 1) {
      pageUrls.push(`${base}?page=${page}`);
    }
    const rest = await mapBatched(pageUrls, 6, async (url) => {
      try {
        const text = await fetchText(url, `CTgoodjobs ${url}`, 18000);
        return extractCtgoodjobsRecordsFromPage(text);
      } catch {
        return [];
      }
    });
    return firstRecords.concat(rest.flat());
  });
  return normalizeCtgoodjobsRecords(buckets.flat());
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
  const firstText = await fetchText('https://www.hkslash.com/zh/jobs?page=1', 'HKSlash 1', 18000);
  const firstJobs = extractHkSlashJobsFromPage(firstText);
  const totalPagesMatch = String(firstText || '').match(/"totalPages":(\d+)/);
  const totalPages = Math.min(totalPagesMatch ? parseInt(totalPagesMatch[1], 10) : 1, 60);
  const pages = [];
  for (let page = 2; page <= totalPages; page += 1) {
    pages.push(page);
  }
  const rest = await mapBatched(pages, 6, async (page) => {
    try {
      const text = await fetchText(`https://www.hkslash.com/zh/jobs?page=${page}`, `HKSlash ${page}`, 18000);
      return extractHkSlashJobsFromPage(text);
    } catch {
      return [];
    }
  });
  return firstJobs.concat(rest.flat());
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
      const firstText = await fetchText(`https://hk.joblum.com${route}`, `Joblum Hong Kong ${route}`, 18000);
      jobs.push(...extractJoblumHongKongJobsFromPage(firstText));
      const pageMatches = [...String(firstText || '').matchAll(/href="([^"]+\?p=(\d+))"/gi)];
      const pageCount = Math.min(pageMatches.reduce((max, match) => Math.max(max, parseInt(match[2], 10) || 1), 1), 50);
      const pageUrls = [];
      for (let page = 2; page <= pageCount; page += 1) {
        pageUrls.push(`https://hk.joblum.com${route}?p=${page}`);
      }
      const rest = await mapBatched(pageUrls, 5, async (url) => {
        try {
          const text = await fetchText(url, `Joblum Hong Kong ${url}`, 18000);
          return extractJoblumHongKongJobsFromPage(text);
        } catch {
          return [];
        }
      });
      jobs.push(...rest.flat());
    } catch {}
    await delay(120);
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
    links = links.concat(extractRecruitIndexLinks(homepage));
  } catch {}
  const uniqueLinks = [...new Set(links)];
  const buckets = await mapBatched(uniqueLinks, 6, async (url) => {
    try {
      const text = await fetchText(url, url, 18000);
      return extractRecruitJobsFromPage(text);
    } catch {
      return [];
    }
  });
  jobs.push(...buckets.flat());
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
    let emptyCount = 0;
    for (let page = 1; page <= pageLimit; page += 1) {
      const url = `${baseUrl}/jobs?k=${query}&l=${location}&p=${page}`;
      try {
        const text = await fetchText(url, `${source} ${query} ${page}`, 18000);
        const pageJobs = extractTalentJobsFromHtml(text, { baseUrl, region, source });
        jobs.push(...pageJobs);
        if (!pageJobs.length) {
          emptyCount += 1;
          if (emptyCount >= 2) break;
        } else {
          emptyCount = 0;
        }
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
    pageLimit: 12
  });
}

async function fetchTalentChinaJobs() {
  return fetchTalentRegionJobs({
    domain: 'cn',
    region: 'mainland',
    source: 'Talent 中国',
    location: '%E4%B8%AD%E5%9B%BD',
    baseUrl: 'https://cn.talent.com',
    queries: ['%E4%BA%A7%E5%93%81', '%E6%95%B0%E6%8D%AE', '%E8%BF%90%E8%90%A5', 'AI', '%E5%95%86%E4%B8%9A%E5%88%86%E6%9E%90', '%E5%BC%80%E5%8F%91', '%E5%95%86%E4%B8%9A%E5%8C%96'],
    pageLimit: 10
  });
}

async function fetchTalentNorthAmericaJobs() {
  return fetchTalentRegionJobs({
    domain: 'com',
    region: 'northamerica',
    source: 'Talent North America',
    location: 'united+states',
    baseUrl: 'https://www.talent.com',
    queries: ['product manager', 'product operations', 'business analyst', 'software engineer', 'data analyst', 'marketing', 'finance'],
    pageLimit: 10
  });
}

async function fetchRemotiveJobs() {
  const data = await fetchJson('https://remotive.com/api/remote-jobs', 'Remotive');
  return (data?.jobs || []).map((item) => normalizePosting({
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
  const data = await fetchJson('https://jobicy.com/api/v2/remote-jobs?count=500', 'Jobicy');
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

async function fetchLeverJobs() {
  const buckets = await mapBatched(LEVER_SOURCES, 4, async (source) => {
    try {
      const data = await fetchJson(`https://api.lever.co/v0/postings/${encodeURIComponent(source.board)}?mode=json`, `${source.company} Lever`, 18000);
      const list = Array.isArray(data) ? data : [];
      return list.map((item) => normalizePosting({
        title: item.text,
        company: source.company,
        location: item.categories?.location || item.categories?.team || 'United States',
        region: 'northamerica',
        source: source.source,
        url: item.hostedUrl || item.applyUrl || '',
        jd_text: decodeHtml(item.descriptionPlain || item.description || ''),
        summary: [item.categories?.team, item.categories?.department, item.categories?.commitment].filter(Boolean).join(' · '),
        updated_at: item.createdAt ? new Date(item.createdAt).toISOString() : ''
      })).filter(Boolean);
    } catch {
      return [];
    }
  });
  return buckets.flat();
}

async function readExistingCache() {
  try {
    const raw = await fs.readFile(OUTPUT_JSON, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.jobs) ? parsed : { jobs: [] };
  } catch {
    return { jobs: [] };
  }
}

function isWithinRetentionWindow(job, nowMs) {
  const timestamps = [job.updated_at, job.last_seen_at, job.first_seen_at]
    .map((value) => Date.parse(String(value || '')))
    .filter(Number.isFinite);
  if (!timestamps.length) return true;
  const latest = Math.max(...timestamps);
  return nowMs - latest <= CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

function mergeJobCollections(existingJobs, fetchResults, nowIso) {
  const nowMs = Date.parse(nowIso);
  const existingByKey = new Map();
  const existingSourceCounts = new Map();
  for (const job of Array.isArray(existingJobs) ? existingJobs : []) {
    if (!job) continue;
    existingByKey.set(makeJobMergeKey(job), job);
    existingSourceCounts.set(job.source, (existingSourceCounts.get(job.source) || 0) + 1);
  }
  const merged = [];
  const fetchedSources = new Set();
  for (const result of fetchResults) {
    if (!result?.ok) continue;
    const sourceCount = existingSourceCounts.get(result.source) || 0;
    const nextCount = Array.isArray(result.jobs) ? result.jobs.length : 0;
    if (sourceCount > 0 && (nextCount === 0 || (sourceCount >= 80 && nextCount < sourceCount * 0.55))) {
      console.warn(`[job-cache] ${result.source} kept from previous cache: fetched ${nextCount}, existing ${sourceCount}`);
      continue;
    }
    fetchedSources.add(result.source);
    for (const job of dedupe(result.jobs || [])) {
      const key = makeJobMergeKey(job);
      const previous = existingByKey.get(key);
      merged.push(Object.assign({}, previous || {}, job, {
        id: previous?.id || job.id,
        first_seen_at: previous?.first_seen_at || nowIso,
        last_seen_at: nowIso
      }));
    }
  }
  for (const job of Array.isArray(existingJobs) ? existingJobs : []) {
    if (!job || fetchedSources.has(job.source)) continue;
    if (!isWithinRetentionWindow(job, nowMs)) continue;
    merged.push(job);
  }
  return sortJobs(dedupe(merged)).filter((job) => isWithinRetentionWindow(job, nowMs));
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
      return { source: label, ok: true, jobs: Array.isArray(result) ? result : [] };
    } catch (error) {
      console.warn(`[job-cache] ${label} skipped: ${error?.message || error || 'unknown error'}`);
      return { source: label, ok: false, jobs: [] };
    }
  }

  const existing = await readExistingCache();
  const results = await Promise.all([
    safeFetch('Jobrapido 中国', fetchJobrapidoMainlandJobs),
    safeFetch('Talent 中国', fetchTalentChinaJobs),
    safeFetch('字节跳动校招', fetchByteDanceCampusJobs),
    safeFetch('腾讯招聘', fetchTencentJobs),
    safeFetch('美团招聘', fetchMeituanJobs),
    safeFetch('拉勾招聘', fetchLagouJobs),
    safeFetch('实习僧', fetchShixisengJobs),
    safeFetch('CTgoodjobs', fetchCtgoodjobsJobs),
    safeFetch('HKSlash', fetchHkSlashJobs),
    safeFetch('Joblum Hong Kong', fetchJoblumHongKongJobs),
    safeFetch('Recruit.com.hk', fetchRecruitHongKongJobs),
    safeFetch('Jobrapido Hong Kong', fetchJobrapidoHongKongJobs),
    safeFetch('Talent Hong Kong', fetchTalentHongKongJobs),
    safeFetch('Greenhouse', fetchGreenhouseJobs),
    safeFetch('Lever', fetchLeverJobs),
    safeFetch('Talent North America', fetchTalentNorthAmericaJobs),
    safeFetch('Remotive', fetchRemotiveJobs),
    safeFetch('Jobicy', fetchJobicyJobs),
    safeFetch('Remote OK', fetchRemoteOkJobs)
  ]);
  const nowIso = new Date().toISOString();
  const jobs = mergeJobCollections(existing.jobs, results, nowIso);
  const payload = {
    updated_at: nowIso,
    source_label: '职位池',
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
