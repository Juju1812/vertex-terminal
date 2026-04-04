import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "ArbibX Alerts <alerts@arbibx.com>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email: string };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (!RESEND_API_KEY) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    await sendEmail(
      email,
      "ArbibX AI Alerts ??? You're subscribed!",
      `<!DOCTYPE html>
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
        <div style="font-size:11px;color:#3D5A7A;letter-spacing:0.15em;text-transform:uppercase;">Terminal</div>
      </div>
    </div>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(130,180,255,0.12);border-radius:16px;padding:32px;">
      <div style="width:48px;height:48px;border-radius:12px;background:rgba(0,200,150,0.10);border:1px solid rgba(0,200,150,0.25);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <span style="font-size:24px;">&#10003;</span>
      </div>
      <h1 style="color:#F2F6FF;font-size:22px;font-weight:600;margin:0 0 8px;">You're all set!</h1>
      <p style="color:#7A9CBF;font-size:14px;line-height:1.7;margin:0 0 24px;">
        AI trade alerts are now active for <strong style="color:#C8D5E8;">${email}</strong>.
        You'll get an email whenever our models identify a high-confidence signal to buy, add to, or exit a position.
      </p>

      <div style="background:rgba(79,142,247,0.07);border:1px solid rgba(79,142,247,0.18);border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="color:#7EB6FF;font-size:12px;font-weight:600;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.08em;">What triggers an alert?</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:5px 0;color:#00C896;font-size:14px;width:20px;">&#8594;</td>
            <td style="padding:5px 0;color:#7A9CBF;font-size:13px;line-height:1.5;">Confidence score crosses 80%+ on a new signal</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#00C896;font-size:14px;width:20px;">&#8594;</td>
            <td style="padding:5px 0;color:#7A9CBF;font-size:13px;line-height:1.5;">AI signals a high-probability exit on a holding</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#00C896;font-size:14px;width:20px;">&#8594;</td>
            <td style="padding:5px 0;color:#7A9CBF;font-size:13px;line-height:1.5;">Portfolio concentration risk exceeds safe thresholds</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#00C896;font-size:14px;width:20px;">&#8594;</td>
            <td style="padding:5px 0;color:#7A9CBF;font-size:13px;line-height:1.5;">Significant momentum or volume anomaly detected</td>
          </tr>
        </table>
      </div>

      <p style="color:#3D5A7A;font-size:12px;margin:0;line-height:1.6;">
        Not investment advice. ArbibX signals are for informational purposes only.
        Past performance does not guarantee future results.
      </p>
    </div>

    <p style="color:#1F3550;font-size:11px;text-align:center;margin-top:24px;">
      ArbibX Terminal &mdash; Powered by Polygon.io
    </p>
  </div>
</body>
</html>`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return NextResponse.json({ error: "Failed to send confirmation email" }, { status: 500 });
  }
}
