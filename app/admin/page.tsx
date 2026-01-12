"use client";

import { useState } from "react";

export default function Page() {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setOut("");

    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, prompt }),
      });

      const data = await r.json();
      setOut(data.output || "ERROR");
    } catch {
      setOut("ERROR");
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h2>Admin Panel (Secure Mode)</h2>

      <div>
        <div>API Key (tidak disimpan)</div>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste API key kamu"
          style={{ width: 600, padding: 10 }}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <div>Prompt</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{ width: 600, height: 140, padding: 10 }}
        />
      </div>

      <button onClick={run} disabled={loading} style={{ marginTop: 10, padding: "10px 20px" }}>
        {loading ? "Running..." : "Generate"}
      </button>

      <pre style={{ marginTop: 20, whiteSpace: "pre-wrap" }}>{out}</pre>
    </div>
  );
}
