"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDeviceId } from "@/lib/device";

export default function Page() {
  const router = useRouter();
  const [license, setLicense] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [device, setDevice] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    const d = getDeviceId();
    setDevice(d);
    const savedLicense = localStorage.getItem("LICENSE") || "";
    const savedApiKey = localStorage.getItem("GEMINI_API_KEY") || "";
    setLicense(savedLicense);
    setApiKey(savedApiKey);
  }, []);

  async function onLogin() {
    setMsg("");
    if (!license.trim()) return setMsg("License wajib diisi.");
    if (!apiKey.trim()) return setMsg("Gemini API Key wajib diisi.");

    setLoading(true);
    try {
      // simpan lokal dulu
      localStorage.setItem("LICENSE", license.trim());
      localStorage.setItem("GEMINI_API_KEY", apiKey.trim());

      // opsional: ping generate dengan prompt dummy untuk validasi license+device via backend
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          license: license.trim(),
          device,
          prompt: "ping",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Login gagal.");
        return;
      }

      // sukses → masuk builder
      router.push("/builder");
    } catch (e: any) {
      setMsg(e?.message || "Login error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24, display: "grid", placeItems: "center" }}>
      <div style={{ width: "min(520px, 100%)", border: "1px solid #333", borderRadius: 12, padding: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Wonderwal Login</h1>

        <label style={{ display: "block", marginBottom: 6 }}>License</label>
        <input
          value={license}
          onChange={(e) => setLicense(e.target.value)}
          placeholder="contoh: TEST123"
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #444", marginBottom: 14 }}
        />

        <label style={{ display: "block", marginBottom: 6 }}>Gemini API Key (BYOK)</label>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="AIza..."
          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #444", marginBottom: 14 }}
        />

        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 14 }}>
          Device ID: <code>{device || "-"}</code>
        </div>

        <button
          onClick={onLogin}
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #555",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Login"}
        </button>

        {msg ? <div style={{ marginTop: 12, color: "#ffb4b4" }}>{msg}</div> : null}
      </div>
    </main>
  );
}
