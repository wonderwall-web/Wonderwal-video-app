"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Scene = { id: string; title: string; prompt: string };
type VideoProject = { title: string; scenes: Scene[] };

const STYLE_OPTIONS = ["Clean Dark"] as const;
const FORMAT_OPTIONS = ["9:16", "16:9", "1:1"] as const;

export default function AppClient() {
  const [project, setProject] = useState<VideoProject>({
    title: "Wonderwal Project",
    scenes: [{ id: "s1", title: "Scene 1", prompt: "Halo dunia" }],
  });

  const [format, setFormat] = useState<(typeof FORMAT_OPTIONS)[number]>("9:16");
  const [style, setStyle] = useState<(typeof STYLE_OPTIONS)[number]>("Clean Dark");

  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const sceneCount = useMemo(() => project.scenes.length, [project.scenes.length]);

  async function onGenerateDummy() {
    setBusy(true);
    setMsg("Generating (dummy)...");
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: project.scenes[0]?.prompt || "Halo",
          format,
          style,
        }),
      });
      const j = await r.json().catch(() => ({}));
      setMsg(JSON.stringify(j));
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const bg = "#0b1220";
  const card = "rgba(255,255,255,0.04)";
  const border = "rgba(255,255,255,0.10)";
  const text = "#e5e7eb";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20, display: "grid", gridTemplateColumns: "260px 1fr", gap: 14 }}>
        <aside style={{ border: `1px solid ${border}`, background: card, borderRadius: 16, padding: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Wonderwal Builder</div>
          <div style={{ opacity: 0.8, marginTop: 6, fontSize: 12 }}>No Tailwind • Clean Dark</div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <Link href="/settings" style={{ color: "#93c5fd", textDecoration: "none", fontWeight: 700 }}>
              Settings (API Keys)
            </Link>

            <div style={{ fontSize: 12, opacity: 0.85 }}>Scenes: <b>{sceneCount}</b></div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Format</div>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                style={{ background: "rgba(0,0,0,0.25)", color: text, border: `1px solid ${border}`, borderRadius: 12, padding: "10px 10px" }}
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Style</div>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as any)}
                style={{ background: "rgba(0,0,0,0.25)", color: text, border: `1px solid ${border}`, borderRadius: 12, padding: "10px 10px" }}
              >
                {STYLE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <button
              onClick={onGenerateDummy}
              disabled={busy}
              style={{
                marginTop: 6,
                background: busy ? "#111827" : "#2563eb",
                color: "#fff",
                border: `1px solid ${border}`,
                borderRadius: 12,
                padding: "10px 12px",
                fontWeight: 800,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Working..." : "Generate (Dummy)"}
            </button>
          </div>
        </aside>

        <main style={{ border: `1px solid ${border}`, background: card, borderRadius: 16, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{project.title}</div>
              <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>Edit prompt scene pertama lalu klik Generate.</div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Scene 1 Prompt</div>
            <textarea
              value={project.scenes[0]?.prompt || ""}
              onChange={(e) => {
                const v = e.target.value;
                setProject((p) => ({
                  ...p,
                  scenes: p.scenes.map((sc, idx) => (idx === 0 ? { ...sc, prompt: v } : sc)),
                }));
              }}
              style={{
                width: "100%",
                minHeight: 160,
                background: "rgba(0,0,0,0.25)",
                color: text,
                border: `1px solid ${border}`,
                borderRadius: 12,
                padding: 12,
                outline: "none",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            />

            {msg ? (
              <div style={{ border: `1px solid ${border}`, borderRadius: 12, background: "rgba(0,0,0,0.22)", padding: 12, fontSize: 12, whiteSpace: "pre-wrap" }}>
                {msg}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
