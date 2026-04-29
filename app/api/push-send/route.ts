import { NextRequest, NextResponse } from "next/server";

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY      = process.env.SUPABASE_SECRET_KEY!;

/* ---- VAPID JWT builder (no external lib needed) ----------- */
function base64UrlEncode(data: Uint8Array): string {
  return Buffer.from(data).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function buildVapidJwt(audience: string): Promise<string> {
  const header  = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ:"JWT", alg:"ES256" })));
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: "mailto:alerts@arbibx.com",
  })));

  const keyData = Buffer.from(VAPID_PRIVATE_KEY, "base64");
  const key = await crypto.subtle.importKey(
    "pkcs8", keyData,
    { name:"ECDSA", namedCurve:"P-256" },
    false, ["sign"]
  );

  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sig  = await crypto.subtle.sign({ name:"ECDSA", hash:"SHA-256" }, key, data);
  return `${header}.${payload}.${base64UrlEncode(new Uint8Array(sig))}`;
}

async function sendPush(subscription: PushSubscriptionJSON, payload: string): Promise<void> {
  const endpoint = subscription.endpoint!;
  const audience = new URL(endpoint).origin;
  const jwt      = await buildVapidJwt(audience);
  const authHeader = `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`;

  // Encrypt payload using Web Push encryption
  const { keys } = subscription as { keys: { p256dh: string; auth: string } };
  const p256dh = Buffer.from(keys.p256dh, "base64");
  const auth   = Buffer.from(keys.auth,   "base64");

  // Import recipient public key
  const recipientKey = await crypto.subtle.importKey(
    "raw", p256dh,
    { name:"ECDH", namedCurve:"P-256" },
    false, []
  );

  // Generate ephemeral key pair
  const ephemeral = await crypto.subtle.generateKey(
    { name:"ECDH", namedCurve:"P-256" },
    true, ["deriveKey","deriveBits"]
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name:"ECDH", public: recipientKey },
    ephemeral.privateKey, 256
  );

  const ephemeralPublicRaw = await crypto.subtle.exportKey("raw", ephemeral.publicKey);

  // HKDF to derive content encryption key and nonce
  const prk = await crypto.subtle.importKey("raw", sharedBits, { name:"HKDF" }, false, ["deriveKey","deriveBits"]);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const hkdfInput = new Uint8Array([
    ...new Uint8Array(auth),
    ...new Uint8Array(ephemeralPublicRaw),
    ...p256dh,
  ]);

  const ikm = await crypto.subtle.deriveBits(
    { name:"HKDF", hash:"SHA-256", salt: new Uint8Array(hkdfInput), info: new TextEncoder().encode("Content-Encoding: auth\0") },
    prk, 256
  );

  const ikmKey = await crypto.subtle.importKey("raw", ikm, { name:"HKDF" }, false, ["deriveKey","deriveBits"]);

  const keyInfo   = new TextEncoder().encode("Content-Encoding: aesgcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");

  const contentKey = await crypto.subtle.deriveKey(
    { name:"HKDF", hash:"SHA-256", salt, info: keyInfo },
    ikmKey, { name:"AES-GCM", length:128 }, false, ["encrypt"]
  );

  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name:"HKDF", hash:"SHA-256", salt, info: nonceInfo },
    ikmKey, 96
  ));

  // Pad and encrypt
  const payloadBytes = new TextEncoder().encode(payload);
  const padded = new Uint8Array(2 + payloadBytes.length);
  padded.set(payloadBytes, 2);

  const encrypted = await crypto.subtle.encrypt(
    { name:"AES-GCM", iv: nonce },
    contentKey, padded
  );

  const ephemeralPublicB64 = Buffer.from(ephemeralPublicRaw).toString("base64")
    .replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");

  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type":  "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Encryption":    `salt=${Buffer.from(salt).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"")}`,
      "Crypto-Key":    `dh=${ephemeralPublicB64};p256ecdsa=${VAPID_PUBLIC_KEY}`,
      "TTL": "86400",
    },
    body: encrypted,
  });

  if (!r.ok && r.status !== 201) {
    throw new Error(`Push failed: ${r.status} ${await r.text()}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, title, body, url } = await req.json() as {
      email: string;
      title: string;
      body: string;
      url?: string;
    };

    if (!email || !title || !body) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Look up subscription from Supabase
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}&select=push_subscription`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const rows = await r.json() as { push_subscription: string | null }[];
    const raw  = rows[0]?.push_subscription;
    if (!raw) return NextResponse.json({ error: "No subscription found" }, { status: 404 });

    const subscription = JSON.parse(raw) as PushSubscriptionJSON;
    const payload = JSON.stringify({ title, body, url: url ?? "/" });
    await sendPush(subscription, payload);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Push send error:", err);
    return NextResponse.json({ error: "Failed to send push" }, { status: 500 });
  }
}
