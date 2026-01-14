"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getDeviceId() {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("DEVICE_ID");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("DEVICE_ID", id);
  }
  return id;
}

export default function BuilderPage() {
  const router = useRouter();

  const [license, setLicense] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [device, setDevice] = useState("");

  const [prompt, setPrompt] = useState("Tulis 1 paragraf hook fakta aneh tentang lautan.");
  const [out, setOut] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const d = getDeviceId();
    setDevice(d);

    const l = localStorage.getItem("LICENSE") || "";
    const k = localStorage.getItem("GEMINI_API_KEY") || "";

    if (!l || !k) {
      router.replace("/");
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
        const err = data?.error || "GENERATE_FAILED";
        const detail = data?.detail ? ` | ${data.detail}` : "";
        setMsg(`${err}${detail}`);
        return;
      }

      setOut(data?.output || "");
    } catch (e: any) {
      setMsg(e?.message || "GENERATE_ERROR");
    } finally {
      setLoading(false);
    }
  }

  function onLogout() {
    localStorage.removeItem("LICENSE");
    localStorage.removeItem("GEMINI_API_KEY");
    router.replace("/");
  }

  return (
    <main style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Builder</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            License: <code>{license || "-"}</code> | Device: <code>{device || "-"}</code>
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

      {msg ? (
        <div style={{ marginTop: 12, color: "#ffb4b4", whiteSpace: "pre-wrap" }}>
          {msg}
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Output</label>
        <pre style={{ whiteSpace: "pre-wrap", padding: 12, borderRadius: 12, border: "1px solid #333", minHeight: 140 }}>
          {out || ""}
        </pre>
      </div>
    </main>
  );
}
