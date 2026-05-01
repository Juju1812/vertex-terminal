import { NextRequest } from "next/server";

export const maxDuration = 60;
export const dynamic    = "force-dynamic";

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const POLYGON_KEY   = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

const MODEL_CHAIN = ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"] as const;

interface ChatMessage { role: "user" | "assistant"; content: string }
interface ChatContext {
  ticker?:           string | null;
  portfolioTickers?: string[];
  watchlistTickers?: string[];
  tab?:              string;
}

/* ── Live-price snapshot for context ────────────────────────
   Pulls latest price + day change for up to 12 tickers in one
   shot so Claude can reason on actual current numbers instead
   of stale training data. Failure is non-fatal — the chat still
   works without it, just less grounded. */
async function fetchPrices(tickers: string[]): Promise<Record<string, { price: number; changePct: number }>> {
  const uniq = [...new Set(tickers.map(t => t.toUpperCase()))].filter(Boolean).slice(0, 12);
  if (!uniq.length) return {};
  try {
    const r = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${uniq.join(",")}&apiKey=${POLYGON_KEY}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!r.ok) return {};
    const d = await r.json() as { tickers?: Array<{ ticker: string; day: { c: number }; prevDay: { c: number } }> };
    const out: Record<string, { price: number; changePct: number }> = {};
    for (const t of d.tickers ?? []) {
      const cur = t.day?.c, prev = t.prevDay?.c;
      if (cur > 0 && prev > 0) out[t.ticker] = { price: cur, changePct: ((cur - prev) / prev) * 100 };
    }
    return out;
  } catch { return {}; }
}

function buildSystemPrompt(ctx: ChatContext, prices: Record<string, { price: number; changePct: number }>): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    `You are Claude, the AI inside ArbibX — a premium stock terminal for retail investors.`,
    `Today's date: ${today}.`,
    ``,
    `Your role:`,
    `- Answer questions about specific stocks, the market, the user's portfolio, and trading concepts.`,
    `- Be concise and confident. Lead with the answer; expand only if useful.`,
    `- Format with short markdown bullets and bold for tickers/numbers when useful. No tables.`,
    `- Use plain text dollar signs. Don't invent earnings dates, ratings, or numbers — say "I don't have that data" if unsure.`,
    `- When pricing data is provided below, ground your answer in those exact numbers.`,
    `- This is general information, not personalised financial advice. You can give opinions on setups/risk, but always remind the user to do their own research at the end of substantive recommendations.`,
    ``,
  ];

  if (ctx.tab) lines.push(`The user is currently on the **${ctx.tab}** tab.`);

  if (ctx.ticker) {
    const p = prices[ctx.ticker.toUpperCase()];
    lines.push(p
      ? `They are looking at **${ctx.ticker}** (current: $${p.price.toFixed(2)}, day change: ${p.changePct >= 0 ? "+" : ""}${p.changePct.toFixed(2)}%).`
      : `They are looking at **${ctx.ticker}**.`);
  }

  if (ctx.portfolioTickers?.length) {
    const lines2 = ctx.portfolioTickers.slice(0, 12).map(t => {
      const p = prices[t.toUpperCase()];
      return p ? `- ${t}: $${p.price.toFixed(2)} (${p.changePct >= 0 ? "+" : ""}${p.changePct.toFixed(2)}%)` : `- ${t}`;
    });
    lines.push(``, `User's portfolio:`, ...lines2);
  }

  if (ctx.watchlistTickers?.length) {
    lines.push(``, `User's watchlist tickers: ${ctx.watchlistTickers.slice(0, 20).join(", ")}.`);
  }

  return lines.join("\n");
}

/* ── Stream from Anthropic with model fallback ─────────────
   On non-2xx from a model, we drop the upstream and try the
   next model. Once a stream starts we commit and stop falling
   back even if it errors mid-stream (rare). */
async function streamFromAnthropic(systemPrompt: string, messages: ChatMessage[]): Promise<{ stream: ReadableStream<Uint8Array>; model: string } | { error: string }> {
  let lastError = "no models attempted";
  for (const model of MODEL_CHAIN) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         ANTHROPIC_KEY ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          system: systemPrompt,
          messages,
          stream: true,
        }),
      });
      if (r.ok && r.body) {
        console.log(`[chat] using model: ${model}`);
        return { stream: r.body, model };
      }
      const errText = await r.text();
      lastError = `${model}: HTTP ${r.status} — ${errText.slice(0, 200)}`;
      console.warn(`[chat] ${model} failed:`, lastError);
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message : "unknown"}`;
      console.warn(`[chat] ${model} threw:`, lastError);
    }
  }
  return { error: lastError };
}

/* Convert Anthropic SSE → plain-text token stream. The client
   doesn't need the full SSE event metadata, just the deltas, so
   we strip everything except text_delta payloads. */
function toTokenStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buf = "";
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        // Process complete SSE events delimited by \n\n
        let idx;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const evt = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of evt.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const obj = JSON.parse(payload) as { type: string; delta?: { type: string; text?: string } };
              if (obj.type === "content_block_delta" && obj.delta?.type === "text_delta" && obj.delta.text) {
                controller.enqueue(enc.encode(obj.delta.text));
              }
            } catch { /* skip malformed */ }
          }
        }
      }
      controller.close();
    },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!ANTHROPIC_KEY) {
    return new Response("Chat not configured", { status: 503 });
  }
  let body: { messages: ChatMessage[]; context?: ChatContext };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const messages = (body.messages ?? []).filter(m =>
    m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length > 0
  );
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return new Response("messages must end with a user turn", { status: 400 });
  }
  // Cap conversation length to keep tokens / latency sane
  const trimmed = messages.slice(-20);

  const ctx: ChatContext = body.context ?? {};
  const tickerPool = [
    ...(ctx.ticker ? [ctx.ticker] : []),
    ...(ctx.portfolioTickers ?? []),
    ...(ctx.watchlistTickers ?? []),
  ];
  const prices = await fetchPrices(tickerPool);
  const systemPrompt = buildSystemPrompt(ctx, prices);

  const result = await streamFromAnthropic(systemPrompt, trimmed);
  if ("error" in result) {
    return new Response(`Upstream error: ${result.error}`, { status: 502 });
  }

  return new Response(toTokenStream(result.stream), {
    headers: {
      "Content-Type":      "text/plain; charset=utf-8",
      "Cache-Control":     "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Chat-Model":      result.model,
    },
  });
}
