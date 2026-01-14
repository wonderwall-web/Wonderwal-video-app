"use client";

import { useState, useEffect } from "react";
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

export default function Home() {
  const router = useRouter();
  const [license, setLicense] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [device, setDevice] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDevice(getDeviceId());
  }, []);

  async function login() {
    setMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          license,
          device,
          prompt: "ping",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsg(data?.error || "Login gagal");
        return;
      }

      localStorage.setItem("LICENSE", license);
      localStorage.setItem("GEMINI_API_KEY", apiKey);

      router.push("/builder");
    } catch (e: any) {
      setMsg("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ width: 400, padding: 20, border: "1px solid #444", borderRadius: 12 }}>
        <h2>Wonderwal Login</h2>

        <input
          placeholder="License (TEST123)"
          value={license}
          onChange={(e) => setLicense(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 10 }}
        />

        <input
          placeholder="Gemini API Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{ width: "100%", padding: 10, marginTop: 10 }}
        />

        <div style={{ fontSize: 12, marginTop: 10 }}>Device: {device}</div>

        <button
          onClick={login}
          disabled={loading}
          style={{ width: "100%", padding: 12, marginTop: 15 }}
        >
          {loading ? "Loading..." : "Login"}
        </button>

        {msg && <div style={{ color: "red", marginTop: 10 }}>{msg}</div>}
      </div>
    </main>
  );
}
