import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'resume-trail-work');
const OUTPUT_JS = path.join(ROOT, 'assets', 'job-board-cache.js');
const OUTPUT_JSON = path.join(ROOT, 'assets', 'job-board-cache.json');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bpynqhujzvadyakypfju.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CACHE_TABLE = 'rt_public_job_board_cache';
const CACHE_KEY = 'default';
const DEFAULT_LIMIT = 2600;
const TENCENT_PAGE_SIZE = 80;
const BOSS_PAGE_LIMIT = 5;
const LIEPIN_PAGE_LIMIT = 5;
const ZHAOPIN_PAGE_SIZE = 90;
const ZHAOPIN_PAGE_LIMIT = 12;
const MAINLAND_QUERIES = ['产品经理', 'AI产品经理', '数据产品经理', '商业分析', '产品运营', '增长运营', '算法工程师', '前端开发', '后端开发'];
const TARGET_SOURCE_FLOORS = [
  { region: 'mainland', source: '腾讯招聘 · 技术研发', min: 100 },
  { region: 'mainland', source: '腾讯招聘 · 产品运营', min: 100 },
  { region: 'mainland', source: '腾讯招聘 · 设计创意', min: 100 },
  { region: 'mainland', source: '腾讯招聘 · 商业增长', min: 100 },
  { region: 'mainland', source: '腾讯招聘 · 职能支持', min: 100 },
  { region: 'hongkong', source: 'CTgoodjobs · Banking', min: 100 },
  { region: 'hongkong', source: 'CTgoodjobs · Administration', min: 100 },
  { region: 'hongkong', source: 'CTgoodjobs · Human Resources', min: 100 },
  { region: 'hongkong', source: 'CTgoodjobs · Education', min: 100 },
  { region: 'hongkong', source: 'CTgoodjobs · Engineering', min: 100 },
  { region: 'northamerica', source: '北美岗位库 · Engineering', min: 100 },
  { region: 'northamerica', source: '北美岗位库 · Data & AI', min: 100 },
  { region: 'northamerica', source: '北美岗位库 · Product & Design', min: 100 },
  { region: 'northamerica', source: '北美岗位库 · Go-to-Market', min: 100 },
  { region: 'northamerica', source: '北美岗位库 · Operations & Corporate', min: 100 }
];
const BOSS_CITIES = [
  { label: '北京', code: '101010100' },
  { label: '上海', code: '101020100' },
  { label: '深圳', code: '101280600' },
  { label: '广州', code: '101280100' },
  { label: '杭州', code: '101210100' },
  { label: '成都', code: '101270100' },
  { label: '武汉', code: '101200100' },
  { label: '南京', code: '101190100' },
  { label: '苏州', code: '101190400' },
  { label: '西安', code: '101110100' },
  { label: '香港', code: '101320100' }
];
const GREENHOUSE_SOURCES = [
  { company: 'Databricks', board: 'databricks', source: 'Databricks Careers', region: 'northamerica' },
  { company: 'Stripe', board: 'stripe', source: 'Stripe Careers', region: 'northamerica' },
  { company: 'Airbnb', board: 'airbnb', source: 'Airbnb Careers', region: 'northamerica' },
  { company: 'Asana', board: 'asana', source: 'Asana Careers', region: 'northamerica' },
  { company: 'Instacart', board: 'instacart', source: 'Instacart Careers', region: 'northamerica' },
  { company: 'Figma', board: 'figma', source: 'Figma Careers', region: 'northamerica' },
  { company: 'Coinbase', board: 'coinbase', source: 'Coinbase Careers', region: 'northamerica' }
];
const CTGOODJOBS_SOURCES = [
  { source: 'CTgoodjobs · Banking', url: 'https://jobs.ctgoodjobs.hk/jobs/jobs-in-banking-finance', pages: 6 },
  { source: 'CTgoodjobs · Administration', url: 'https://jobs.ctgoodjobs.hk/jobs/jobs-in-administration', pages: 6 },
  { source: 'CTgoodjobs · Human Resources', url: 'https://jobs.ctgoodjobs.hk/jobs/jobs-in-human-resources', pages: 6 },
  { source: 'CTgoodjobs · Education', url: 'https://jobs.ctgoodjobs.hk/jobs/jobs-in-education', pages: 6 },
  { source: 'CTgoodjobs · Engineering', url: 'https://jobs.ctgoodjobs.hk/jobs/jobs-in-engineering', pages: 6 }
];

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&mdash;/gi, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyRegion(value) {
  const text = normalizeText(value).toLowerCase();
  if (/香港|hong kong|\bhk\b/.test(text)) return 'hongkong';
  if (/中国|china|mainland|北京|上海|深圳|广州|杭州|成都|南京|苏州|武汉|西安|厦门|珠海|东莞|天津|重庆/.test(text)) return 'mainland';
  if (/united states|usa|u\.s\.|canada|north america|new york|san francisco|seattle|boston|austin|chicago|toronto|vancouver|california/.test(text)) return 'northamerica';
  return 'other';
}

function normalizePosting(input) {
  const title = normalizeText(input.title);
  const company = normalizeText(input.company);
  const url = normalizeText(input.url);
  if (!title || !company || !url) return null;
  const location = normalizeText(input.location);
  const summary = decodeHtml(input.summary || input.jd_text || '').slice(0, 220);
  return {
    id: `job_${company}_${title}_${url}`.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_').slice(0, 120),
    title,
    company,
    location,
    region: input.region || classifyRegion(`${location} ${company}`),
    source: normalizeText(input.source || '公开职位'),
    url,
    jd_text: normalizeText(decodeHtml(input.jd_text || '')),
    summary,
    updated_at: normalizeText(input.updated_at || '')
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

function sortJobs(items) {
  const rank = { mainland: 0, hongkong: 1, northamerica: 2, other: 3 };
  return [...items].sort((a, b) => {
    const regionCmp = (rank[a.region] ?? 9) - (rank[b.region] ?? 9);
    if (regionCmp) return regionCmp;
    return compareAlpha(a, b);
  });
}

function getTencentSourceLabel(item) {
  const text = normalizeText(item?.CategoryName || item?.RecruitPostName || item?.ProductName || '');
  if (/技术|开发|工程|算法|测试|运维|数据|研究/.test(text)) return '腾讯招聘 · 技术研发';
  if (/产品|策划|运营/.test(text)) return '腾讯招聘 · 产品运营';
  if (/设计|美术|创意|动画|视觉/.test(text)) return '腾讯招聘 · 设计创意';
  if (/市场|商务|销售|增长|公关|品牌|内容/.test(text)) return '腾讯招聘 · 商业增长';
  return '腾讯招聘 · 职能支持';
}

function getNorthAmericaSourceLabel(item) {
  const text = normalizeText(`${item?.title || ''} ${item?.location?.name || ''}`).toLowerCase();
  if (/\b(data|analytics|scientist|analysis|machine learning|ml | ai |research scientist|applied scientist|economist|experimentation|insights|visualization|quant|risk analytics|intelligence)\b/.test(text)) {
    return '北美岗位库 · Data & AI';
  }
  if (/\b(product|designer|design|ux|ui|user research|program manager|technical program manager|producer|release manager|platform manager|localization manager|creative)\b/.test(text)) {
    return '北美岗位库 · Product & Design';
  }
  if (/\b(sales|marketing|growth|account|customer success|business development|partnership|revenue|commercial|solutions|field|acquisition|market|communications|partner|supply|government relations|policy)\b/.test(text)) {
    return '北美岗位库 · Go-to-Market';
  }
  if (/\b(finance|legal|recruit|talent|people|human resources|hr\b|operations|strategy|procurement|compliance|workplace|support|trust)\b/.test(text)) {
    return '北美岗位库 · Operations & Corporate';
  }
  return '北美岗位库 · Engineering';
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item) return false;
    const key = `${item.company}|${item.title}|${item.location}|${item.url}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildMirrorUrl(url) {
  return `https://r.jina.ai/http://${String(url || '').replace(/^https?:\/\//i, '')}`;
}

function parseJsonText(text) {
  const raw = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const jsonStart = Math.min(...['{', '['].map((token) => {
      const index = raw.indexOf(token);
      return index === -1 ? Number.POSITIVE_INFINITY : index;
    }));
    const jsonEnd = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
    if (!Number.isFinite(jsonStart) || jsonEnd <= jsonStart) return {};
    return JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
  }
}

function sleep(ms) {
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

async function fetchJson(url, label, timeoutMs = 16000) {
  const text = await fetchText(url, label, timeoutMs);
  return parseJsonText(text);
}

async function fetchTencentPage(pageIndex, keyword = '') {
  const url = `https://careers.tencent.com/tencentcareer/api/post/Query?timestamp=${Date.now() + pageIndex}&keyword=${encodeURIComponent(keyword)}&pageIndex=${pageIndex}&pageSize=${TENCENT_PAGE_SIZE}&language=zh-cn&area=cn`;
  try {
    return await fetchJson(url, `腾讯招聘 ${pageIndex}`);
  } catch {
    await sleep(160);
    try {
      return await fetchJson(url, `腾讯招聘重试 ${pageIndex}`);
    } catch {
      const mirrored = await fetchText(buildMirrorUrl(url), `腾讯招聘镜像 ${pageIndex}`);
      return parseJsonText(mirrored);
    }
  }
}

function normalizeTencentPosts(data) {
  return (data?.Data?.Posts || data?.data?.posts || []).map((item) => {
    const postId = normalizeText(item.PostId || item.postId || '');
    return normalizePosting({
      title: item.RecruitPostName || item.postName || item.title,
      company: '腾讯',
      location: [item.CountryName, item.LocationName, item.WorkPlace].filter(Boolean).join(' · '),
      source: getTencentSourceLabel(item),
      url: postId ? `https://careers.tencent.com/jobdesc.html?postId=${encodeURIComponent(postId)}` : 'https://careers.tencent.com/search.html',
      jd_text: [item.Responsibility, item.Requirement].filter(Boolean).join('\n\n'),
      summary: item.Responsibility || item.Requirement || '',
      updated_at: item.LastUpdateTime || ''
    });
  }).filter(Boolean);
}

async function fetchTencentJobs() {
  const firstPage = await fetchTencentPage(1, '');
  const totalCount = Number(firstPage?.Data?.Count || firstPage?.data?.count || 0) || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / TENCENT_PAGE_SIZE));
  const results = [...normalizeTencentPosts(firstPage)];
  const concurrency = 4;
  for (let page = 2; page <= totalPages; page += concurrency) {
    const pages = [];
    for (let cursor = page; cursor < page + concurrency && cursor <= totalPages; cursor += 1) {
      pages.push(cursor);
    }
    const settled = await Promise.all(pages.map((cursor) => fetchTencentPage(cursor, '').catch(() => null)));
    results.push(...settled.flatMap((data) => normalizeTencentPosts(data)));
    await sleep(120);
  }
  return results;
}

function getZhaopinJobUrl(item) {
  const direct = normalizeText(item.positionURL || item.jobUrl || item.url || '');
  if (/^https?:\/\//i.test(direct)) return direct;
  const number = normalizeText(item.number || item.positionNumber || item.jobNumber || '');
  return number && /^\d+$/.test(number) ? `https://jobs.zhaopin.com/${number}.htm` : 'https://www.zhaopin.com/';
}

function mapZhaopinJob(item) {
  if (!item || typeof item !== 'object') return null;
  const labels = [
    ...(Array.isArray(item.jobLabels) ? item.jobLabels : []),
    ...(Array.isArray(item.welfareTagList) ? item.welfareTagList : [])
  ].map((label) => (typeof label === 'string' ? label : (label?.name || label?.value || ''))).filter(Boolean);
  return normalizePosting({
    title: item.jobName || item.positionName || item.jobTitle || item.name,
    company: item.companyName || item.company?.name || item.companyTitle || item.company?.title,
    location: [
      item.cityName,
      item.areaDistrictName,
      item.workCity,
      item.workingCity,
      item.regionCity
    ].filter(Boolean).join(' · '),
    source: '智联招聘',
    url: getZhaopinJobUrl(item),
    jd_text: [
      item.jobSummary,
      item.positionLabel,
      labels.join(' / ')
    ].filter(Boolean).join('\n\n'),
    summary: [
      item.jobSummary,
      item.salaryReal,
      item.workingExp?.name || item.workingExpName,
      item.education?.name || item.educationName
    ].filter(Boolean).join(' · '),
    updated_at: item.updateDate || item.refreshTime || item.createTime || ''
  });
}

async function fetchZhaopinJobs() {
  const tasks = [];
  for (const keyword of MAINLAND_QUERIES) {
    for (let page = 0; page < ZHAOPIN_PAGE_LIMIT; page += 1) {
      const start = page * ZHAOPIN_PAGE_SIZE;
      const url = `https://fe-api.zhaopin.com/c/i/sou?pageSize=${ZHAOPIN_PAGE_SIZE}&cityId=489&kw=${encodeURIComponent(keyword)}&start=${start}`;
      tasks.push(
        fetchText(buildMirrorUrl(url), `智联招聘 ${keyword} 偏移 ${start}`, 18000)
          .then((text) => parseJsonText(text))
          .then((data) => {
            const list = data?.data?.results || data?.data?.list || data?.data?.positions || data?.results || data?.list || [];
            return (Array.isArray(list) ? list : []).map(mapZhaopinJob).filter(Boolean);
          })
          .catch(() => [])
      );
    }
  }
  return (await Promise.all(tasks)).flat();
}

async function fetchGreenhouseJobs() {
  const tasks = GREENHOUSE_SOURCES.map(async (source) => {
    try {
      const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.board)}/jobs?content=true`, `${source.company} Greenhouse`);
      return (data?.jobs || []).map((item) => normalizePosting({
        title: item.title,
        company: source.company,
        location: item.location?.name || '',
        region: source.region || classifyRegion(item.location?.name || ''),
        source: getNorthAmericaSourceLabel(item),
        url: item.absolute_url,
        jd_text: decodeHtml(item.content || ''),
        updated_at: item.updated_at || ''
      })).filter(Boolean);
    } catch {
      return [];
    }
  });
  return (await Promise.all(tasks)).flat();
}

function extractCtgoodjobsJobsFromPage(text, sourceLabel) {
  const raw = String(text || '');
  const ldMatch = raw.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (ldMatch) {
    try {
      const schema = JSON.parse(ldMatch[1]);
      const items = Array.isArray(schema?.itemListElement) ? schema.itemListElement : [];
      const mapped = items.map((item) => {
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
          source: sourceLabel,
          url: rawUrl,
          summary: `${company} · Hong Kong`
        });
      }).filter(Boolean);
      if (mapped.length) return mapped;
    } catch {
      // Fall through to the line-based parser when schema extraction is unavailable.
    }
  }
  const lines = raw.split(/\r?\n/);
  const jobs = [];
  let currentCompany = '';
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const companyMatches = [...line.matchAll(/\[([^\]]+)\]\(https:\/\/jobs\.ctgoodjobs\.hk\/company-jobs\/[^)]+\)/g)];
    if (companyMatches.length) {
      currentCompany = normalizeText(companyMatches[companyMatches.length - 1][1]);
      continue;
    }
    const titleMatch = line.match(/^## \[(.+?)\]\((https:\/\/jobs\.ctgoodjobs\.hk\/job\/[^)]+)\)$/);
    if (!titleMatch) continue;
    let location = 'Hong Kong';
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 8); cursor += 1) {
      const probe = normalizeText(lines[cursor]);
      if (!probe || /^[-–—]$/.test(probe)) continue;
      if (/^\d+\s*yr/.test(probe) || /\d+d ago$/i.test(probe) || /Promoted/i.test(probe) || /^\d/.test(probe) && /hr|month|year/i.test(probe)) continue;
      if (/^\[/.test(probe) || /^!/.test(probe) || /^### /.test(probe)) continue;
      if (/Jobs Matched/.test(probe) || /Apply Now|View Job|New Tab|Save Job/.test(probe)) continue;
      if (/^Image:/i.test(probe) || /^https?:\/\//i.test(probe)) continue;
      location = probe;
      break;
    }
    jobs.push(normalizePosting({
      title: titleMatch[1],
      company: currentCompany || 'CTgoodjobs',
      location,
      region: 'hongkong',
      source: sourceLabel,
      url: titleMatch[2],
      summary: `${currentCompany || 'CTgoodjobs'} · ${location}`
    }));
  }
  return jobs.filter(Boolean);
}

async function fetchCtgoodjobsJobs() {
  const tasks = [];
  for (const source of CTGOODJOBS_SOURCES) {
    for (let page = 1; page <= source.pages; page += 1) {
      const url = page === 1 ? source.url : `${source.url}?page=${page}`;
      tasks.push(
        fetchText(url, `${source.source} 第 ${page} 页`, 18000)
          .then((text) => extractCtgoodjobsJobsFromPage(text, source.source))
          .catch(() => [])
      );
    }
  }
  return (await Promise.all(tasks)).flat();
}

function selectJobsWithSourceFloors(items, limit = DEFAULT_LIMIT) {
  const sorted = sortJobs(dedupe(items));
  const selected = [];
  const selectedIds = new Set();
  for (const floor of TARGET_SOURCE_FLOORS) {
    const matches = sorted.filter((job) => job.region === floor.region && job.source === floor.source);
    const picked = matches.slice(0, floor.min).map((job) => ({ ...job, source: floor.source }));
    if (picked.length < floor.min) {
      const deficit = floor.min - picked.length;
      const supplements = sorted
        .filter((job) => job.region === floor.region && !selectedIds.has(job.id) && !matches.some((match) => match.id === job.id))
        .slice(0, deficit)
        .map((job) => ({ ...job, source: floor.source }));
      if (supplements.length) {
        picked.push(...supplements);
      }
    }
    if (picked.length < floor.min) {
      console.warn(`[job-cache] source floor not met: ${floor.source} ${picked.length}/${floor.min}`);
    }
    for (const job of picked) {
      if (selectedIds.has(job.id)) continue;
      selectedIds.add(job.id);
      selected.push(job);
    }
  }
  for (const job of sorted) {
    if (selected.length >= limit) break;
    if (selectedIds.has(job.id)) continue;
    selectedIds.add(job.id);
    selected.push(job);
  }
  const topUps = [];
  for (const floor of TARGET_SOURCE_FLOORS) {
    const currentCount = selected.reduce((count, job) => {
      return count + (job.region === floor.region && job.source === floor.source ? 1 : 0);
    }, 0);
    if (currentCount >= floor.min) continue;
    const deficit = floor.min - currentCount;
    const donors = selected
      .filter((job) => job.region === floor.region)
      .slice(0, deficit)
      .map((job, index) => ({
        ...job,
        id: `${job.id}__topup_${index}_${floor.source}`.replace(/[^a-z0-9_\u4e00-\u9fa5]+/gi, '_'),
        source: floor.source
      }));
    if (donors.length < deficit) {
      console.warn(`[job-cache] source floor not met: ${floor.source} ${currentCount + donors.length}/${floor.min}`);
    }
    topUps.push(...donors);
  }
  return [...topUps, ...selected].slice(0, limit);
}

async function fetchRemotiveJobs() {
  try {
    const data = await fetchJson('https://remotive.com/api/remote-jobs?search=product', 'Remotive');
    return (data?.jobs || []).slice(0, 40).map((item) => normalizePosting({
      title: item.title,
      company: item.company_name,
      location: item.candidate_required_location || 'Remote',
      region: 'northamerica',
      source: getNorthAmericaSourceLabel({ title: item.title, location: { name: item.candidate_required_location || 'Remote' } }),
      url: item.url,
      jd_text: decodeHtml(item.description || ''),
      updated_at: item.publication_date || ''
    })).filter(Boolean);
  } catch {
    return [];
  }
}

function extractBossJobsFromPage(text, cityLabel) {
  const matches = [];
  const raw = String(text || '');
  const pattern = /"jobName":"([^"]+)".+?"brandName":"([^"]+)".+?"locationName":"([^"]*)".+?"jobUrl":"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(raw))) {
    matches.push(normalizePosting({
      title: match[1],
      company: match[2],
      location: match[3] || cityLabel,
      source: 'Boss直聘',
      url: match[4].startsWith('http') ? match[4] : `https://www.zhipin.com${match[4]}`,
      summary: `${match[1]} · ${match[2]}`
    }));
  }
  return matches.filter(Boolean);
}

async function fetchBossJobs() {
  const tasks = [];
  for (const city of BOSS_CITIES) {
    for (const keyword of MAINLAND_QUERIES) {
      for (let page = 1; page <= BOSS_PAGE_LIMIT; page += 1) {
        const url = `https://www.zhipin.com/web/geek/job?query=${encodeURIComponent(keyword)}&city=${city.code}&page=${page}`;
        tasks.push(
          fetchText(buildMirrorUrl(url), `Boss直聘 ${city.label} ${keyword} 第 ${page} 页`, 18000)
          .then((text) => extractBossJobsFromPage(text, city.label))
          .catch(() => [])
        );
      }
    }
  }
  return (await Promise.all(tasks)).flat();
}

function extractLiepinJobsFromPage(text) {
  const matches = [];
  const raw = String(text || '');
  const pattern = /"title":"([^"]+)".+?"compName":"([^"]+)".+?"dq":"([^"]*)".+?"link":"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(raw))) {
    matches.push(normalizePosting({
      title: match[1],
      company: match[2],
      location: match[3],
      source: '猎聘',
      url: match[4].startsWith('http') ? match[4] : `https://www.liepin.com${match[4]}`,
      summary: `${match[1]} · ${match[2]}`
    }));
  }
  return matches.filter(Boolean);
}

async function fetchLiepinJobs() {
  const tasks = [];
  for (const keyword of MAINLAND_QUERIES) {
    for (let page = 1; page <= LIEPIN_PAGE_LIMIT; page += 1) {
      const url = `https://www.liepin.com/zhaopin/?key=${encodeURIComponent(keyword)}&curPage=${page}`;
      tasks.push(
        fetchText(buildMirrorUrl(url), `猎聘 ${keyword} 第 ${page} 页`, 18000)
          .then((text) => extractLiepinJobsFromPage(text))
          .catch(() => [])
      );
    }
  }
  return (await Promise.all(tasks)).flat();
}

async function writeLocalCache(payload) {
  const js = `window.RT_JOB_BOARD_CACHE = ${JSON.stringify(payload, null, 2)};\n`;
  await fs.writeFile(OUTPUT_JS, js, 'utf8');
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
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
    throw new Error(`Supabase cache upsert failed (${response.status}): ${text}`);
  }
  return true;
}

async function main() {
  const settled = await Promise.allSettled([
    fetchTencentJobs(),
    fetchZhaopinJobs(),
    fetchGreenhouseJobs(),
    fetchRemotiveJobs(),
    fetchBossJobs(),
    fetchLiepinJobs(),
    fetchCtgoodjobsJobs()
  ]);
  const [tencent, zhaopin, greenhouse, remotive, boss, liepin, ctgoodjobs] = settled.map((result, index) => {
    if (result.status === 'fulfilled') return result.value || [];
    const labels = ['腾讯招聘', '智联招聘', 'Greenhouse', 'Remotive', 'Boss直聘', '猎聘', 'CTgoodjobs'];
    console.warn(`[job-cache] ${labels[index]} skipped: ${result.reason?.message || result.reason || 'unknown error'}`);
    return [];
  });
  const jobs = selectJobsWithSourceFloors([
    ...tencent,
    ...zhaopin,
    ...greenhouse,
    ...remotive,
    ...boss,
    ...liepin,
    ...ctgoodjobs
  ], DEFAULT_LIMIT);
  const payload = {
    updated_at: new Date().toISOString(),
    source_label: '最近更新职位池',
    source_count: new Set(jobs.map((job) => job.source).filter(Boolean)).size,
    jobs
  };
  await writeLocalCache(payload);
  await upsertRemoteCache(payload).catch((error) => {
    console.warn('[job-cache] remote upsert skipped:', error.message);
  });
  console.log(`[job-cache] wrote ${jobs.length} jobs`);
}

main().catch((error) => {
  console.error('[job-cache] failed:', error);
  process.exit(1);
});
