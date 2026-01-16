"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function getOrCreateDeviceId() {
  const key = "ww_device_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const id = (crypto as any).randomUUID ? crypto.randomUUID() : `DEV-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, id);
  return id;
}

export default function LoginPage() {
  const router = useRouter();
  const [license, setLicense] = useState("");
  const [device, setDevice] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDevice(getOrCreateDeviceId());
  }, []);

  const maskedDevice = useMemo(() => {
    if (!device) return "";
    if (device.length <= 8) return device;
    return `${device.slice(0, 4)}…${device.slice(-4)}`;
  }, [device]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license, device }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setErr(data?.error || "LOGIN_FAILED");
        setLoading(false);
        return;
      }

      router.replace("/builder");
    } catch {
      setErr("NETWORK_ERROR");
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, border: "1px solid #333", borderRadius: 12, padding: 18 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Login License</h1>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 14 }}>
          Device ID: <b>{maskedDevice || "..."}</b>
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
          <input
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            placeholder="WW-XXXX..."
            style={{ padding: 12, borderRadius: 10, border: "1px solid #333", outline: "none" }}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            required
          />

          <button
            type="submit"
            disabled={loading || !device}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "1px solid #333",
              background: loading ? "#222" : "#111",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {loading ? "Checking..." : "Login"}
          </button>

          {err ? (
            <div style={{ fontSize: 12, color: "#ff6b6b", marginTop: 4 }}>
              Error: <b>{err}</b>
              <div style={{ opacity: 0.85, marginTop: 4 }}>
                Kalau <b>DEVICE_MISMATCH</b>, admin perlu reset device (hapus kolom <b>device_id</b> di sheet).
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </main>
  );
}
