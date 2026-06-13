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
const MAINLAND_QUERIES = ['产品经理', 'AI产品经理', '数据产品经理', '商业分析', '产品运营', '增长运营', '前端开发', '后端开发'];
const TARGET_SOURCE_FLOORS = [
  { region: 'mainland', source: '腾讯招聘', min: 100 },
  { region: 'mainland', source: '美团招聘', min: 100 },
  { region: 'mainland', source: '拉勾招聘', min: 60 },
  { region: 'mainland', source: '实习僧', min: 100 },
  { region: 'mainland', source: 'Jobrapido 中国', min: 100 },
  { region: 'mainland', source: 'Talent 中国', min: 100 },
  { region: 'hongkong', source: 'CTgoodjobs', min: 100 },
  { region: 'hongkong', source: 'HKSlash', min: 100 },
  { region: 'hongkong', source: 'Joblum Hong Kong', min: 100 },
  { region: 'hongkong', source: 'Jobrapido Hong Kong', min: 100 },
  { region: 'hongkong', source: 'Recruit.com.hk', min: 20 },
  { region: 'northamerica', source: 'Databricks Careers', min: 100 },
  { region: 'northamerica', source: 'Stripe Careers', min: 100 },
  { region: 'northamerica', source: 'Figma Careers', min: 100 },
  { region: 'northamerica', source: 'Block Careers', min: 100 },
  { region: 'northamerica', source: 'Robinhood Careers', min: 100 },
  { region: 'other', source: 'Jobicy', min: 40 },
  { region: 'other', source: 'Remotive', min: 30 },
  { region: 'other', source: 'Remote OK', min: 30 }
];
const GREENHOUSE_SOURCES = [
  { company: 'Databricks', board: 'databricks', source: 'Databricks Careers' },
  { company: 'Stripe', board: 'stripe', source: 'Stripe Careers' },
  { company: 'Figma', board: 'figma', source: 'Figma Careers' },
  { company: 'Block', board: 'block', source: 'Block Careers' },
  { company: 'Robinhood', board: 'robinhood', source: 'Robinhood Careers' }
];
const CTGOODJOBS_PAGES = [
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-banking-finance',
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-administration',
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-human-resources',
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-education',
  'https://jobs.ctgoodjobs.hk/jobs/jobs-in-engineering'
];
const RECRUIT_PAGES = [
  'https://www.recruit.com.hk/default.aspx'
];
function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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
  if (/香港|hong kong|\bhk\b/.test(text)) return 'hongkong';
  if (/中国|china|mainland|北京|上海|深圳|广州|杭州|成都|南京|苏州|武汉|西安|天津|重庆|长沙|青岛|郑州|厦门|珠海|合肥|宁波|佛山/.test(text)) return 'mainland';
  if (/united states|usa|u\.s\.|canada|new york|san francisco|seattle|boston|austin|chicago|toronto|vancouver|california|redwood city|brooklyn|oakland|bellevue|atlanta|denver|los angeles|washington dc|washington, dc|new jersey|montreal|ottawa|virginia|miami|phoenix|minneapolis|oregon|utah|georgia|massachusetts|illinois|texas|ontario|quebec/.test(text)) return 'northamerica';
  if (/remote|worldwide|anywhere/.test(text)) return 'other';
  return 'other';
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
  const location = normalizeText(input.location);
  const jdText = decodeHtml(input.jd_text || '').slice(0, 1800);
  return {
    id: `job_${company}_${title}_${url}`.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_').slice(0, 120),
    title,
    company,
    location,
    region: input.region || classifyRegion(`${location} ${company}`),
    source: normalizeText(input.source || '公开职位'),
    url,
    jd_text: jdText,
    summary: decodeHtml(input.summary || jdText).slice(0, 260),
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
      const response = await fetch('https://zhaopin.meituan.com/api/official/job/getJobList', {
        method: 'POST',
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
      const payload = await response.json().catch(() => ({}));
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
  const queries = ['%E4%BA%A7%E5%93%81', '%E4%BA%A7%E5%93%81%E7%BB%8F%E7%90%86', '%E8%BF%90%E8%90%A5', '%E5%BC%80%E5%8F%91', '%E5%B7%A5%E7%A8%8B%E5%B8%88', '%E5%B8%82%E5%9C%BA'];
  for (const query of queries) {
    for (let page = 1; page <= 4; page += 1) {
      const url = `https://r.jina.ai/http://cn.jobrapido.com/?q=${query}&l=%E4%B8%AD%E5%9B%BD&p=${page}`;
      try {
        const text = await fetchText(url, `Jobrapido 中国 ${query} ${page}`, 18000);
        jobs.push(...extractJobrapidoJobs(text, 'Jobrapido 中国', 'mainland'));
      } catch {}
      await delay(160);
    }
  }
  return jobs;
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
  return [...String(text || '').matchAll(/<div class="result-wrp row">[\s\S]*?<h2 class="job-title">[\s\S]*?<a[\s\S]*?title="([^"]+)"[\s\S]*?href="([^"]+)"[\s\S]*?<span class="company-name">[\s\S]*?<span>\s*([^<]+)\s*<\/span>[\s\S]*?<span class="location(?: location-desktop)?">\s*<span>\s*([^<]+)\s*<\/span>/gi)]
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
  const tasks = [];
  for (let page = 1; page <= 12; page += 1) {
    tasks.push(fetchText(`https://hk.joblum.com/jobs?page=${page}`, `Joblum Hong Kong ${page}`, 18000).then(extractJoblumHongKongJobsFromPage).catch(() => []));
  }
  return (await Promise.all(tasks)).flat();
}

async function fetchJobrapidoHongKongJobs() {
  const jobs = [];
  const queries = ['product', 'manager', 'analyst', 'operation'];
  for (const query of queries) {
    for (let page = 1; page <= 4; page += 1) {
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
  return [...String(text || '').matchAll(/<a[^>]+class='[^']*ArticleSectionLink[^']*'[^>]*>([^<]+)<\/a>[\s\S]{0,400}?<a[^>]+href='([^']*job[^']*)'[^>]*>[\s\S]{0,200}?<h3[^>]*>([^<]+)<\/h3>/gi)]
    .map((match) => normalizePosting({
      title: decodeHtml(match[3]),
      company: decodeHtml(match[1]),
      location: 'Hong Kong',
      region: 'hongkong',
      source: 'Recruit.com.hk',
      url: match[2].startsWith('http') ? match[2] : `https://www.recruit.com.hk${match[2]}`,
      summary: `${decodeHtml(match[1])} · Hong Kong`
    }))
    .filter(Boolean);
}

async function fetchRecruitHongKongJobs() {
  const jobs = [];
  for (const url of RECRUIT_PAGES) {
    try {
      const text = await fetchText(url, url, 18000);
      jobs.push(...extractRecruitJobsFromPage(text));
    } catch {}
    await delay(120);
  }
  return jobs;
}

function extractTalentJobs(text, source, region) {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const jobs = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!/^##\s+/.test(line)) continue;
    const title = decodeHtml(line.replace(/^##\s+/, '').replace(/\*\*/g, '').trim());
    const meta = lines[index + 1] || '';
    const metaMatch = meta.match(/^(.+?)•(.+)$/);
    if (!metaMatch) continue;
    const company = decodeHtml(metaMatch[1]).trim();
    const location = decodeHtml(metaMatch[2]).trim();
    let description = '';
    let url = '';
    for (let scan = index + 2; scan < Math.min(lines.length, index + 10); scan += 1) {
      const moreMatch = lines[scan].match(/\[(?:展示更多|Show more)\]\((https?:\/\/[^)\s]+|http:\/\/[^)\s]+)\)/i);
      if (moreMatch) {
        url = moreMatch[1];
        break;
      }
      description += `${description ? ' ' : ''}${lines[scan]}`;
    }
    if (!title || !company || !location || !url) continue;
    jobs.push(normalizePosting({
      title,
      company,
      location,
      region,
      source,
      url,
      jd_text: description,
      summary: decodeHtml(description).slice(0, 220)
    }));
  }
  return jobs.filter(Boolean);
}

async function fetchTalentHongKongJobs() {
  const jobs = [];
  const queries = ['product', 'manager', 'business', 'data'];
  for (const query of queries) {
    for (let page = 1; page <= 6; page += 1) {
      const url = `https://r.jina.ai/http://hk.talent.com/jobs?k=${encodeURIComponent(query)}&l=hong+kong&p=${page}`;
      try {
        const text = await fetchText(url, `Talent Hong Kong ${query} ${page}`, 18000);
        jobs.push(...extractTalentJobs(text, 'Talent Hong Kong', 'hongkong'));
      } catch {}
      await delay(180);
    }
  }
  return jobs;
}

async function fetchTalentChinaJobs() {
  const jobs = [];
  const queries = ['%E4%BA%A7%E5%93%81', '%E4%BA%A7%E5%93%81%E7%BB%8F%E7%90%86', '%E6%95%B0%E6%8D%AE', '%E8%BF%90%E8%90%A5'];
  for (const query of queries) {
    for (let page = 1; page <= 6; page += 1) {
      const url = `https://r.jina.ai/http://cn.talent.com/jobs?k=${query}&l=%E4%B8%AD%E5%9B%BD&p=${page}`;
      try {
        const text = await fetchText(url, `Talent 中国 ${query} ${page}`, 18000);
        jobs.push(...extractTalentJobs(text, 'Talent 中国', 'mainland'));
      } catch {}
      await delay(180);
    }
  }
  return jobs;
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
  async function safeFetch(label, task) {
    try {
      return await task();
    } catch (error) {
      console.warn(`[job-cache] ${label} skipped: ${error?.message || error || 'unknown error'}`);
      return [];
    }
  }

  const buckets = [];
  buckets.push(await safeFetch('Jobrapido 中国', fetchJobrapidoMainlandJobs));
  buckets.push(await safeFetch('Talent 中国', fetchTalentChinaJobs));
  buckets.push(await safeFetch('Jobrapido Hong Kong', fetchJobrapidoHongKongJobs));
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
  await upsertRemoteCache(payload).catch((error) => {
    console.warn('[job-cache] remote upsert skipped:', error.message);
  });
  console.log(`[job-cache] wrote ${jobs.length} jobs`);
}

main().catch((error) => {
  console.error('[job-cache] failed:', error);
  process.exit(1);
});
