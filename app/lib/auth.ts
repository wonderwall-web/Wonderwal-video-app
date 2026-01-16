import crypto from "crypto";

const COOKIE_NAME = "ww_session";

type SessionPayload = {
  license: string;
  device: string;
  iat: number;
};

function b64urlEncode(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(input: string) {
  const pad = 4 - (input.length % 4 || 4);
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(b64, "base64");
}

export function getSessionCookieName() {
  return COOKIE_NAME;
}

export function signSession(payload: SessionPayload, secret: string) {
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(body).digest();
  return `${body}.${b64urlEncode(sig)}`;
}

export function verifySession(token: string, secret: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, sigB64] = parts;
  const expectedSig = crypto.createHmac("sha256", secret).update(body).digest();
  const gotSig = b64urlDecode(sigB64);

  if (gotSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(gotSig, expectedSig)) return null;

  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as SessionPayload;
    if (!payload?.license || !payload?.device || !payload?.iat) return null;
    return payload;
  } catch {
    return null;
  }
}
