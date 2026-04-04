import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

interface AlertPayload {
  email: string;
  signal: "BUY" | "SELL" | "ADD";
  ticker: string;
  name: string;
  price: number;
  confidence: number;
  reason: string;
  targetPrice?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as AlertPayload;
    const { email, signal, ticker, name, price, confidence, reason, targetPrice } = body;

    if (!email || !ticker || !signal) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const signalColor  = signal === "BUY" || signal === "ADD" ? "#00C896" : "#E8445A";
    const signalBg     = signal === "BUY" || signal === "ADD" ? "rgba(0,200,150,0.10)" : "rgba(232,68,90,0.10)";
    const signalBorder = signal === "BUY" || signal === "ADD" ? "rgba(0,200,150,0.25)" : "rgba(232,68,90,0.25)";
    const signalLabel  = signal === "BUY" ? "BUY SIGNAL" : signal === "ADD" ? "ADD TO POSITION" : "SELL SIGNAL";
    const emoji        = signal === "BUY" ? "&#128200;" : signal === "ADD" ? "&#43;" : "&#128201;";

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050810;font-family:'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

    <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;">
      <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#4F8EF7,#00C896);display:inline-flex;align-items:center;justify-content:center;">
        <span style="color:#fff;font-size:18px;font-weight:700;">A</span>
      </div>
      <div>
        <div style="font-size:18px;font-weight:700;color:#F2F6FF;letter-spacing:0.05em;">ArbibX</div>
        <div style="font-size:11px;color:#3D5A7A;letter-spacing:0.15em;text-transform:uppercase;">AI Signal Alert</div>
      </div>
    </div>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(130,180,255,0.12);border-radius:16px;overflow:hidden;">

      <!-- Signal banner -->
      <div style="background:${signalBg};border-bottom:1px solid ${signalBorder};padding:20px 28px;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:11px;color:${signalColor};text-transform:uppercase;letter-spacing:0.12em;font-weight:600;margin-bottom:4px;">${signalLabel}</div>
          <div style="font-size:28px;font-weight:700;color:#F2F6FF;font-family:monospace;letter-spacing:-0.02em;">${ticker}</div>
          <div style="font-size:13px;color:#7A9CBF;margin-top:2px;">${name}</div>
        </div>
        <div style="font-size:40px;">${emoji}</div>
      </div>

      <div style="padding:28px;">

        <!-- Price + confidence -->
        <div style="display:flex;gap:12px;margin-bottom:24px;">
          <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(130,180,255,0.08);border-radius:10px;padding:14px;">
            <div style="font-size:10px;color:#3D5A7A;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Current Price</div>
            <div style="font-size:22px;font-weight:600;color:#F2F6FF;font-family:monospace;">$${price.toFixed(2)}</div>
          </div>
          <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(130,180,255,0.08);border-radius:10px;padding:14px;">
            <div style="font-size:10px;color:#3D5A7A;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">AI Confidence</div>
            <div style="font-size:22px;font-weight:600;color:${signalColor};font-family:monospace;">${confidence}%</div>
          </div>
          ${targetPrice ? `
          <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(130,180,255,0.08);border-radius:10px;padding:14px;">
            <div style="font-size:10px;color:#3D5A7A;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Price Target</div>
            <div style="font-size:22px;font-weight:600;color:#4F8EF7;font-family:monospace;">$${targetPrice.toFixed(0)}</div>
          </div>` : ""}
        </div>

        <!-- Reason -->
        <div style="background:rgba(79,142,247,0.05);border:1px solid rgba(79,142,247,0.14);border-radius:10px;padding:16px;margin-bottom:24px;">
          <p style="font-size:10px;color:#7EB6FF;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;margin:0 0 8px;">AI Reasoning</p>
          <p style="font-size:14px;color:#C8D5E8;line-height:1.65;margin:0;">${reason}</p>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:20px;">
          <a href="https://arbibx.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#4F8EF7,#00C896);color:#fff;text-decoration:none;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:600;letter-spacing:0.02em;">
            View in ArbibX Terminal &#8594;
          </a>
        </div>

        <p style="color:#3D5A7A;font-size:11px;text-align:center;margin:0;line-height:1.6;">
          Not investment advice. For informational purposes only.<br>
          Past performance does not guarantee future results.
        </p>
      </div>
    </div>

    <p style="color:#1F3550;font-size:11px;text-align:center;margin-top:24px;">
      ArbibX Terminal &mdash; Powered by Polygon.io
    </p>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ArbibX Alerts <onboarding@resend.dev>",
        to: email,
        subject: `ArbibX Alert: ${signalLabel} ??? ${ticker} @ $${price.toFixed(2)}`,
        html,
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Alert send error:", err);
    return NextResponse.json({ error: "Failed to send alert" }, { status: 500 });
  }
}
