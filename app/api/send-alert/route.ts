import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY   = process.env.SUPABASE_SECRET_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      email: string;
      ticker: string;
      condition: "above" | "below";
      targetPrice: number;
      currentPrice: number;
      test?: boolean;
    };

    const { email, ticker, condition, targetPrice, currentPrice, test } = body;

    if (!email || !ticker) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const isAbove = condition === "above";
    const color   = isAbove ? "#00e5a0" : "#ff4560";
    const arrow   = isAbove ? "↑" : "↓";
    const subject = test
      ? `ArbibX · Test Alert — ${ticker}`
      : `ArbibX · Price Alert Triggered — ${ticker} ${arrow} $${targetPrice.toFixed(2)}`;

    const pushTitle = test
      ? `ArbibX Test — ${ticker}`
      : `ArbibX Alert: ${ticker} ${arrow} $${targetPrice.toFixed(2)}`;
    const pushBody = test
      ? `Test alert for ${ticker}. Push notifications are working!`
      : `${ticker} is now ${isAbove ? "above" : "below"} your target of $${targetPrice.toFixed(2)}. Current: $${currentPrice.toFixed(2)}`;

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050407;font-family:'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;">
      <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#f0a500,#ff6b35);display:inline-flex;align-items:center;justify-content:center;">
        <span style="color:#0a0800;font-size:18px;font-weight:900;">A</span>
      </div>
      <div>
        <div style="font-size:16px;font-weight:800;color:#f4f0ff;letter-spacing:0.08em;font-family:monospace;">ArbibX</div>
        <div style="font-size:9px;color:#2d2848;letter-spacing:0.2em;text-transform:uppercase;font-family:monospace;">TERMINAL</div>
      </div>
    </div>
    <div style="background:linear-gradient(145deg,rgba(255,255,255,0.032) 0%,rgba(255,255,255,0.010) 100%);border:1px solid rgba(60,48,100,0.6);border-radius:18px;overflow:hidden;">
      <div style="height:3px;background:linear-gradient(90deg,#f0a500,#ff6b35);"></div>
      <div style="background:${isAbove?"rgba(0,229,160,0.08)":"rgba(255,69,96,0.08)"};border-bottom:1px solid ${isAbove?"rgba(0,229,160,0.20)":"rgba(255,69,96,0.20)"};padding:24px 28px;">
        <div style="font-size:10px;color:${color};text-transform:uppercase;letter-spacing:0.16em;font-weight:600;font-family:monospace;margin-bottom:8px;">
          ${test?"TEST ALERT":"PRICE ALERT TRIGGERED"}
        </div>
        <div style="font-size:36px;font-weight:700;color:#f4f0ff;font-family:monospace;letter-spacing:-0.03em;line-height:1;">${ticker}</div>
        <div style="font-size:14px;color:#8a82a8;margin-top:6px;">
          Price ${isAbove?"rose above":"dropped below"} your target of <strong style="color:${color};">$${targetPrice.toFixed(2)}</strong>
        </div>
      </div>
      <div style="padding:28px;">
        <div style="display:flex;gap:12px;margin-bottom:24px;">
          <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(60,48,100,0.5);border-radius:12px;padding:16px;">
            <div style="font-size:9px;color:#4a4468;text-transform:uppercase;letter-spacing:0.12em;font-family:monospace;margin-bottom:6px;">Current Price</div>
            <div style="font-size:24px;font-weight:600;color:#f4f0ff;font-family:monospace;">$${currentPrice.toFixed(2)}</div>
          </div>
          <div style="flex:1;background:${isAbove?"rgba(0,229,160,0.06)":"rgba(255,69,96,0.06)"};border:1px solid ${isAbove?"rgba(0,229,160,0.20)":"rgba(255,69,96,0.20)"};border-radius:12px;padding:16px;">
            <div style="font-size:9px;color:${color};text-transform:uppercase;letter-spacing:0.12em;font-family:monospace;margin-bottom:6px;">Your Target</div>
            <div style="font-size:24px;font-weight:600;color:${color};font-family:monospace;">${arrow} $${targetPrice.toFixed(2)}</div>
          </div>
        </div>
        ${test?`<div style="background:rgba(240,165,0,0.08);border:1px solid rgba(240,165,0,0.25);border-radius:10px;padding:14px;margin-bottom:24px;text-align:center;">
          <p style="font-size:13px;color:#f0a500;margin:0;">This is a test alert — your alerts are working correctly ✓</p>
        </div>`:""}
        <div style="text-align:center;margin-bottom:20px;">
          <a href="https://www.arbibx.com" style="display:inline-block;background:linear-gradient(135deg,#f0a500,#ffbe1a);color:#0a0800;text-decoration:none;padding:13px 36px;border-radius:12px;font-size:14px;font-weight:800;letter-spacing:0.04em;">
            Open ArbibX Terminal →
          </a>
        </div>
        <p style="color:#2d2848;font-size:11px;text-align:center;margin:0;line-height:1.6;font-family:monospace;">NOT FINANCIAL ADVICE · FOR INFORMATIONAL PURPOSES ONLY</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    // Send email
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ArbibX Alerts <alerts@arbibx.com>",
        to: email,
        subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      throw new Error(errText);
    }

    // Fire push notification in parallel (non-blocking — don't fail if push fails)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://www.arbibx.com"}/api/push-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        title: pushTitle,
        body: pushBody,
        url: "/?tab=watchlist",
      }),
    }).catch(() => { /* push is best-effort */ });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Alert send error:", err);
    return NextResponse.json({ error: "Failed to send alert" }, { status: 500 });
  }
}
