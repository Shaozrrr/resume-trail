import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.RT_PREPARE_AI_PORT || 8788);
const LOCAL_CONFIG_PATH = path.resolve(process.cwd(), '.prepare-ai.local.json');
let localConfig = {};
if (fs.existsSync(LOCAL_CONFIG_PATH)) {
  try {
    localConfig = JSON.parse(fs.readFileSync(LOCAL_CONFIG_PATH, 'utf8'));
  } catch (error) {
    console.warn('[prepare-ai] Failed to parse .prepare-ai.local.json:', error.message);
  }
}
const API_KEY = process.env.DEEPSEEK_API_KEY || localConfig.deepseekApiKey || '';
const MODEL = process.env.DEEPSEEK_MODEL || localConfig.model || 'deepseek-v4-pro';
const API_URL = 'https://api.deepseek.com/chat/completions';
const MIN_JD_LENGTH = 60;

if (!API_KEY) {
  console.error('[prepare-ai] Missing DEEPSEEK_API_KEY');
  process.exit(1);
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function html(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function normalizeText(value, fallback = '') {
  return String(value || fallback).trim();
}

function hasUsableJd(value) {
  return normalizeText(value).length >= MIN_JD_LENGTH;
}

function safeParse(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Empty response');
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  return JSON.parse(candidate);
}

async function callDeepSeek(messages) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `DeepSeek request failed (${response.status})`);
  }
  const content = data?.choices?.[0]?.message?.content;
  return safeParse(content);
}

function buildSessionMessages(input) {
  const payload = {
    company_name: normalizeText(input.company_name, '目标公司'),
    role_name: normalizeText(input.role_name, '目标岗位'),
    role_category: normalizeText(input.role_category),
    jd_text: normalizeText(input.jd_text),
    jd_url: normalizeText(input.jd_url),
    resume_name: normalizeText(input.resume_name),
    resume_text: normalizeText(input.resume_text),
    resume_file_meta: input.resume_file_meta || null
  };
  return [
    {
      role: 'system',
      content:
        '你是资深中文产品经理与面试教练，任务是为求职者生成高度可执行的面试准备工作台。输出必须是纯 JSON，不要 markdown，不要代码块，不要额外解释。要求：1）内容一定围绕岗位面试准备，不写百科空话；2）语言专业、克制、具体；3）所有文案为简体中文；4）优先从 JD 和简历中提炼；5）如果信息不足，明确用“建议补充”而不是编造；6）best_experiences 只能引用简历里真实出现过的经历线索，不能捏造项目、职位、数字和职责；7）如果简历和 JD 匹配度很低，best_experiences 也不要留空，要从现有背景里挑最可迁移的真实线索，并明确说明“这不是直接匹配，而是可迁移能力”；8）best_experiences 最多返回 3 条，而且每条都必须绑定不同的真实线索，禁止把同一套泛化建议换个标题重复写；9）当匹配度低时，至少给 1 条“可以这样讲”的具体表达示例，而不是只给抽象提醒；10）possible_followups 和 risk_warnings 必须给出补挖经历、补做最小项目、补学关键技能、以及如何包装表达的建议，帮助用户把已有背景翻译成岗位语言；11）所有建议都尽量回扣 JD。输出字段必须严格符合 schema：{"research":{"company_overview":{"one_liner":"string","business_lines":["string"],"products_services":["string"],"business_model":"string","market_position":"string","recent_focus":["string"]},"role_analysis":{"role_type":"string","target_capabilities":["string"],"business_context":"string","interviewer_focus":["string"]},"keyword_translation":[{"jd_keyword":"string","meaning":"string","prep_direction":"string"}]},"focus":{"prep_priorities":[{"title":"string","reason":"string","what_to_prepare":["string"]}],"best_experiences":[{"resume_section":"string","why_match":"string","highlight_points":["string"],"possible_followups":["string"]}],"risk_warnings":[{"title":"string","description":"string","avoidance_tip":"string"}]},"questions":{"question_groups":[{"group_name":"string","questions":[{"id":"string","question":"string","question_type":"string","source":"string","importance":"high|medium"}]}]},"meta":{"lens":"string","summary":"string","provider":"string","model":"string"}}'
    },
    {
      role: 'user',
      content: `请基于以下准备会话信息生成面试准备工作台 JSON：\n${JSON.stringify(payload, null, 2)}`
    }
  ];
}

function buildAnswerMessages(input) {
  const payload = {
    company_name: normalizeText(input.company_name, '目标公司'),
    role_name: normalizeText(input.role_name, '目标岗位'),
    role_category: normalizeText(input.role_category),
    jd_text: normalizeText(input.jd_text),
    resume_name: normalizeText(input.resume_name),
    resume_text: normalizeText(input.resume_text),
    question: normalizeText(input.question),
    question_type: normalizeText(input.question_type),
    source: normalizeText(input.source),
    framework_type: normalizeText(input.framework_type, 'STAR')
  };
  return [
    {
      role: 'system',
      content:
        '你是资深面试教练。任务是基于公司、岗位、JD、简历内容，为一条具体问题生成“回答骨架”，不是完整标准答案。输出必须是纯 JSON，不要 markdown，不要代码块，不要额外解释。所有文案为简体中文。要求：结构清晰、强调岗位匹配、避免空话、给出可直接展开的要点；只能引用用户真实简历线索，不能编造项目、角色和结果数字；如果当前简历证据不足，就明确指出缺口，并告诉用户应该补挖哪类经历、补做什么最小案例、补什么技能，再说明如何包装表达。输出 schema：{"question_id":"string","framework_type":"string","structure":[{"section":"string","guidance":"string","suggested_points":["string"]}],"delivery_tips":["string"],"copyable_outline":"string"}'
    },
    {
      role: 'user',
      content: `请基于以下信息生成回答骨架 JSON：\n${JSON.stringify(payload, null, 2)}`
    }
  ];
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/') {
    html(
      res,
      200,
      `<!doctype html>
      <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>履迹 · 面试准备 AI 服务</title>
        <style>
          :root{color-scheme:dark;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC",sans-serif}
          body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at top,rgba(255,255,255,.08),transparent 42%),#09090b;color:#f4f4f5}
          .panel{width:min(680px,calc(100vw - 40px));padding:28px 30px;border-radius:28px;border:1px solid rgba(255,255,255,.1);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.03));box-shadow:0 24px 64px rgba(0,0,0,.32);backdrop-filter:blur(22px)}
          .kicker{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.52);margin-bottom:14px}
          h1{margin:0;font-size:34px;letter-spacing:-.04em}
          p{margin:14px 0 0;line-height:1.8;color:rgba(255,255,255,.72)}
          code{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.08);font-size:12px;color:#fff}
          ul{margin:18px 0 0;padding-left:18px;color:rgba(255,255,255,.72);line-height:1.8}
          .foot{margin-top:20px;font-size:12px;color:rgba(255,255,255,.5)}
        </style>
      </head>
      <body>
        <main class="panel">
          <div class="kicker">Prepare AI</div>
          <h1>面试准备服务已在线</h1>
          <p>这个地址是履迹的本地 AI 后端，不是前台页面。它负责为 <code>准备</code> 模块生成背调、重点、模拟问题和回答骨架。</p>
          <ul>
            <li>健康检查：<code>/health</code></li>
            <li>准备工作台：<code>POST /api/prepare/session</code></li>
            <li>回答骨架：<code>POST /api/prepare/answer</code></li>
          </ul>
          <p class="foot">请回到履迹前台页面继续使用准备模块。</p>
        </main>
      </body>
      </html>`
    );
    return;
  }
  if (req.method === 'GET' && url.pathname === '/health') {
    json(res, 200, { ok: true, provider: 'deepseek', model: MODEL });
    return;
  }
  try {
    if (req.method === 'POST' && url.pathname === '/api/prepare/session') {
      const input = await readBody(req);
      if (!hasUsableJd(input.jd_text)) {
        json(res, 400, { ok: false, error: `JD 文本太短，请至少提供 ${MIN_JD_LENGTH} 个字的职位描述。` });
        return;
      }
      const output = await callDeepSeek(buildSessionMessages(input));
      output.meta = Object.assign({}, output.meta || {}, {
        provider: 'DeepSeek',
        model: MODEL
      });
      json(res, 200, { ok: true, output });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/prepare/answer') {
      const input = await readBody(req);
      if (!hasUsableJd(input.jd_text)) {
        json(res, 400, { ok: false, error: `JD 文本太短，请先补齐至少 ${MIN_JD_LENGTH} 个字的职位描述。` });
        return;
      }
      if (!normalizeText(input.question)) {
        json(res, 400, { ok: false, error: '缺少问题文本，请先输入你要生成回答的问题。' });
        return;
      }
      const output = await callDeepSeek(buildAnswerMessages(input));
      output.framework_type = input.framework_type || output.framework_type || 'STAR';
      json(res, 200, { ok: true, output });
      return;
    }
    json(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[prepare-ai] listening on http://127.0.0.1:${PORT}`);
});
