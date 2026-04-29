import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email: string };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "ArbibX Alerts <alerts@arbibx.com>",
        to: email,
        subject: "ArbibX — You're subscribed to AI alerts",
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050407;font-family:'Segoe UI',system-ui,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px;">
      <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#f0a500,#ff6b35);display:inline-flex;align-items:center;justify-content:center;">
        <span style="color:#0a0800;font-size:18px;font-weight:900;">A</span>
      </div>
      <div>
        <div style="font-size:16px;font-weight:800;color:#f4f0ff;letter-spacing:0.08em;font-family:monospace;">ArbibX</div>
        <div style="font-size:9px;color:#2d2848;letter-spacing:0.2em;text-transform:uppercase;font-family:monospace;">TERMINAL</div>
      </div>
    </div>

    <!-- Card -->
    <div style="background:linear-gradient(145deg,rgba(255,255,255,0.032) 0%,rgba(255,255,255,0.010) 100%);border:1px solid rgba(60,48,100,0.6);border-radius:18px;overflow:hidden;">
      <div style="height:3px;background:linear-gradient(90deg,#f0a500,#ff6b35);"></div>

      <div style="padding:32px;">
        <!-- Check icon -->
        <div style="width:52px;height:52px;border-radius:14px;background:rgba(0,229,160,0.08);border:1px solid rgba(0,229,160,0.22);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
          <span style="color:#00e5a0;font-size:26px;">✓</span>
        </div>

        <h1 style="color:#f4f0ff;font-size:22px;font-weight:700;margin:0 0 10px;letter-spacing:-0.02em;">You're all set!</h1>
        <p style="color:#8a82a8;font-size:14px;line-height:1.75;margin:0 0 28px;">
          AI trade alerts are now active for <strong style="color:#f4f0ff;">${email}</strong>.
          You'll get an email whenever Claude AI fires a high-confidence signal.
        </p>

        <!-- What triggers alerts -->
        <div style="background:rgba(240,165,0,0.06);border:1px solid rgba(240,165,0,0.20);border-radius:12px;padding:20px;margin-bottom:28px;">
          <p style="color:#f0a500;font-size:10px;font-weight:700;margin:0 0 14px;text-transform:uppercase;letter-spacing:0.14em;font-family:monospace;">What triggers an alert</p>
          ${[
            "Price target hit on a watchlist stock",
            "AI confidence crosses 80%+ on a new signal",
            "High-probability exit signal on a holding",
            "Significant momentum or volume anomaly",
          ].map(item => `
          <div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">
            <span style="color:#f0a500;font-size:14px;flex-shrink:0;margin-top:1px;">→</span>
            <span style="color:#8a82a8;font-size:13px;line-height:1.55;">${item}</span>
          </div>`).join("")}
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:20px;">
          <a href="https://www.arbibx.com" style="display:inline-block;background:linear-gradient(135deg,#f0a500,#ffbe1a);color:#0a0800;text-decoration:none;padding:13px 36px;border-radius:12px;font-size:14px;font-weight:800;letter-spacing:0.04em;">
            Open ArbibX Terminal →
          </a>
        </div>

        <p style="color:#2d2848;font-size:11px;text-align:center;margin:0;line-height:1.6;font-family:monospace;">
          NOT FINANCIAL ADVICE · FOR INFORMATIONAL PURPOSES ONLY
        </p>
      </div>
    </div>

    <p style="color:#1a1628;font-size:10px;text-align:center;margin-top:20px;font-family:monospace;letter-spacing:0.06em;">
      ArbibX Terminal · Powered by Polygon.io
    </p>
  </div>
</body>
</html>`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      throw new Error(err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json({ error: "Failed to send confirmation email" }, { status: 500 });
  }
}
