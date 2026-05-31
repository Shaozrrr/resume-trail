const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function safeParsePrepareJson(text: string) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("AI 返回为空");
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  try {
    return JSON.parse(candidate);
  } catch (_error) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw _error;
  }
}

function getMessageText(message: any) {
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.content)) {
    return message.content
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (part?.type === "text" && typeof part.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join("\n")
      .trim();
  }
  if (typeof message?.text === "string") return message.text;
  return "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "Method not allowed" });
  }

  const apiKey = Deno.env.get("DEEPSEEK_API_KEY") || "";
  const defaultModel = Deno.env.get("DEEPSEEK_MODEL") || "deepseek-v4-pro";
  if (!apiKey) {
    return jsonResponse(500, { ok: false, error: "AI 服务还没配置好 DeepSeek key。" });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch (_error) {
    return jsonResponse(400, { ok: false, error: "请求体不是有效 JSON。" });
  }

  const kind = String(body?.kind || "session");
  const model = String(body?.model || defaultModel);
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length) {
    return jsonResponse(400, { ok: false, error: "缺少 messages，无法生成准备内容。" });
  }

  const attemptConfigs = [
    { jsonMode: true, maxTokens: kind === "answer" ? 2400 : 5200 },
    { jsonMode: false, maxTokens: kind === "answer" ? 2600 : 5600 },
  ];

  let lastError = "AI 服务暂时不可用，请稍后重试。";

  for (const attempt of attemptConfigs) {
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          stream: false,
          max_tokens: attempt.maxTokens,
          response_format: attempt.jsonMode ? { type: "json_object" } : { type: "text" },
          thinking: { type: "disabled" },
          messages,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        lastError = data?.error?.message || data?.error || `DeepSeek 请求失败（${response.status}）`;
        continue;
      }
      const message = data?.choices?.[0]?.message || {};
      const content = getMessageText(message) || String(data?.choices?.[0]?.text || "").trim();
      if (!content) {
        lastError = "DeepSeek 检索完成，但最后没有返回可解析结果，请重新生成一次。";
        continue;
      }
      try {
        const output = safeParsePrepareJson(content);
        return jsonResponse(200, {
          ok: true,
          output: {
            ...output,
            meta: {
              ...(output?.meta || {}),
              provider: "DeepSeek",
              model,
              source: "supabase_edge",
            },
          },
        });
      } catch (_error) {
        lastError = "DeepSeek 检索完成，但最后没有返回可解析结果，请重新生成一次。";
      }
    } catch (_error) {
      lastError = "AI 服务连接失败，请稍后重试。";
    }
  }

  return jsonResponse(502, { ok: false, error: lastError });
});
