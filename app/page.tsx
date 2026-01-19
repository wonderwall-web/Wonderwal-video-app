"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function getOrCreateDeviceId() {
  const KEY = "ww_device_id_v1";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && existing.trim()) return existing.trim();
    const v = (globalThis.crypto?.randomUUID?.() || `dev_${Math.random().toString(16).slice(2)}_${Date.now()}`).toLowerCase();
    localStorage.setItem(KEY, v);
    return v;
  } catch {
    return `dev_fallback_${Date.now()}`;
  }
}

function shortDevice(d: string) {
  if (!d) return "-";
  if (d.length <= 10) return d;
  return `${d.slice(0, 4)}...${d.slice(-4)}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [license, setLicense] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  const canSubmit = useMemo(() => license.trim().length >= 6 && !!deviceId && !loading, [license, deviceId, loading]);

  async function onLogin() {
    if (!canSubmit) return;
    setLoading(true);
    setErr("");

    try {
      const res = await fetchWithTimeout(
        "/api/login",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ license: license.trim(), device: deviceId }),
        },
        12_000
      );

      const data = await res.json().catch(() => ({} as any));

      // sukses: Apps Script kamu biasanya balikin status OK/BOUND
      if (data?.ok === true && (data?.status === "OK" || data?.status === "BOUND" || data?.valid === true)) {
        // optional: simpan license terakhir
        try {
          localStorage.setItem("ww_last_license_v1", license.trim());
        } catch {}

        router.replace("/builder");
        return;
      }

      // error: tampilkan dengan jelas
      const msg =
        data?.error ||
        data?.status ||
        (res.ok ? "LOGIN_FAILED" : `HTTP_${res.status}`) ||
        "LOGIN_FAILED";

      setErr(String(msg));
    } catch (e: any) {
      if (String(e?.name) === "AbortError") setErr("TIMEOUT");
      else setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b1220", color: "#e5e7eb", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 520, borderRadius: 18, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", padding: 18 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Wonderwal Login</div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>Device: {shortDevice(deviceId)}</div>

        <input
          value={license}
          onChange={(e) => setLicense(e.target.value)}
          placeholder="Masukkan license (WW-...)"
          spellCheck={false}
          style={{
            marginTop: 14,
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.25)",
            color: "#e5e7eb",
            outline: "none",
            fontSize: 14,
          }}
        />

        <button
          onClick={onLogin}
          disabled={!canSubmit}
          style={{
            marginTop: 12,
            width: "100%",
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: canSubmit ? "#2563eb" : "rgba(255,255,255,0.06)",
            color: "#fff",
            fontWeight: 800,
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: loading ? 0.9 : 1,
          }}
        >
          {loading ? "Checking..." : "Login"}
        </button>

        {err ? (
          <div style={{ marginTop: 10, color: "#fca5a5", fontSize: 12, lineHeight: 1.5 }}>
            Error: {err}
            <div style={{ marginTop: 6, opacity: 0.9 }}>
              Kalau DEVICE_MISMATCH, admin reset dengan mengosongkan kolom <b>device_id</b> di sheet.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
