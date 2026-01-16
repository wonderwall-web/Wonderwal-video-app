"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiKeyItem, loadKeys, saveKeys, getActiveIndex, setActiveIndex } from "../lib/apikeyStore";

function mask(k: string) {
  if (!k) return "";
  if (k.length <= 10) return k;
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const k = loadKeys();
    setKeys(k.length ? k : [{ key: "" }]);
    setActive(getActiveIndex());
  }, []);

  const filledCount = useMemo(() => keys.filter((x) => x.key.trim()).length, [keys]);

  function setKeyAt(i: number, v: string) {
    const next = keys.slice();
    next[i] = { ...(next[i] || { key: "" }), key: v.trim() };
    setKeys(next);
  }

  function addSlot() {
    if (keys.length >= 5) return;
    setKeys([...keys, { key: "" }]);
  }

  function removeAt(i: number) {
    const next = keys.filter((_, idx) => idx !== i);
    setKeys(next.length ? next : [{ key: "" }]);
    const nextActive = Math.min(active, Math.max(0, next.length - 1));
    setActive(nextActive);
  }

  function saveAll() {
    const clean = keys
      .map((k) => ({ key: k.key.trim(), cooldownUntil: k.cooldownUntil }))
      .filter((k) => k.key)
      .slice(0, 5);

    saveKeys(clean);
    setKeys(clean.length ? clean : [{ key: "" }]);
    setActive(Math.min(active, Math.max(0, clean.length - 1)));
    setActiveIndex(Math.min(active, Math.max(0, clean.length - 1)));
    alert("Saved.");
  }

  function setActiveUi(i: number) {
    setActive(i);
    setActiveIndex(i);
  }

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Settings</h1>

      <section style={{ border: "1px solid #333", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Gemini API Keys (max 5)</h2>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
          Key aktif dipakai duluan. Kalau kena limit, sistem akan rotasi ke key berikutnya.
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {keys.map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "center" }}>
              <input
                value={it.key}
                onChange={(e) => setKeyAt(i, e.target.value)}
                placeholder={`API Key #${i + 1}`}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #333", outline: "none" }}
              />
              <button
                onClick={() => setActiveUi(i)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #333",
                  background: active === i ? "#1f2937" : "#111",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {active === i ? "ACTIVE" : "Use"}
              </button>
              <button
                onClick={() => removeAt(i)}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #333", background: "#111", cursor: "pointer" }}
              >
                Remove
              </button>

              <div style={{ gridColumn: "1 / -1", fontSize: 12, opacity: 0.75 }}>
                {it.cooldownUntil && it.cooldownUntil > Date.now()
                  ? `Cooldown: ${Math.ceil((it.cooldownUntil - Date.now()) / 1000)}s`
                  : `Preview: ${mask(it.key)}`}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            onClick={addSlot}
            disabled={keys.length >= 5}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #333", background: "#111", cursor: "pointer" }}
          >
            Add Slot
          </button>
          <button
            onClick={saveAll}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #333", background: "#111", cursor: "pointer", fontWeight: 800 }}
          >
            Save
          </button>
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8, alignSelf: "center" }}>
            Filled: <b>{filledCount}</b>/5
          </div>
        </div>
      </section>
    </main>
  );
}
