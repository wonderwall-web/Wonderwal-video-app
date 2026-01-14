"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDeviceId } from "@/app/lib/devices";

export default function BuilderPage() {
  const router = useRouter();
  const [license, setLicense] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [device, setDevice] = useState("");
  const [prompt, setPrompt] = useState("Tulis 1 paragraf hook fakta aneh tentang lautan.");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const d = getDeviceId();
    setDevice(d);

    const l = localStorage.getItem("LICENSE") || "";
    const k = localStorage.getItem("GEMINI_API_KEY") || "";
    if (!l || !k) {
      router.push("/");
      return;
    }
    setLicense(l);
    setApiKey(k);
  }, [router]);

  async function onGenerate() {
    setMsg("");
    setOut("");
    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, license, device, prompt }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Generate gagal.");
        return;
      }
      setOut(data?.output || "");
    } catch (e: any) {
      setMsg(e?.message || "Generate error.");
    } finally {
      setLoading(false);
    }
  }

  function onLogout() {
    localStorage.removeItem("LICENSE");
    localStorage.removeItem("GEMINI_API_KEY");
    router.push("/");
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Builder</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            License: <code>{license}</code> | Device: <code>{device}</code>
          </div>
        </div>
        <button onClick={onLogout} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #555" }}>
          Logout
        </button>
      </div>

      <label style={{ display: "block", marginBottom: 6 }}>Prompt</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={6}
        style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #444", marginBottom: 12 }}
      />

      <button
        onClick={onGenerate}
        disabled={loading}
        style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #555", cursor: loading ? "not-allowed" : "pointer" }}
      >
        {loading ? "Generating..." : "Generate"}
      </button>

      {msg ? <div style={{ marginTop: 12, color: "#ffb4b4" }}>{msg}</div> : null}

      <div style={{ marginTop: 16 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Output</label>
        <pre style={{ whiteSpace: "pre-wrap", padding: 12, borderRadius: 12, border: "1px solid #333", minHeight: 140 }}>
          {out || ""}
        </pre>
      </div>
    </main>
  );
}
