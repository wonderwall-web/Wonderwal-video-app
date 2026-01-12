"use client";

import { useEffect, useState } from "react";

export default function Page() {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user_google_api_key") || "";
      if (saved) setApiKey(saved);
    } catch {}
  }, []);

  const run = async () => {
    setLoading(true);
    setOut("");

    try {
      localStorage.setItem("user_google_api_key", apiKey);

      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, prompt }),
      });

      const data = await r.json();
      if (data.ok) setOut(data.output || "");
      else setOut("ERROR: " + (data.error || "unknown"));
    } catch {
      setOut("ERROR");
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h2>Admin Panel</h2>

      <div style={{ marginBottom: 12 }}>
        <div>Google AI Studio API Key</div>
        <input
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste API Key..."
          style={{ width: 600, padding: 10 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div>Prompt</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Tulis prompt..."
          style={{ width: 600, height: 140, padding: 10 }}
        />
      </div>

      <button onClick={run} disabled={loading} style={{ padding: "10px 20px" }}>
        {loading ? "Running..." : "Generate"}
      </button>{" "}
      <a href="/logout">Logout</a>

      <pre style={{ marginTop: 20, whiteSpace: "pre-wrap" }}>{out}</pre>
    </div>
  );
}
