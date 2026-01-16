"use client";

import { useEffect, useState } from "react";
import { ApiKeyItem, loadKeys, saveKeys } from "../lib/apikeyStore";

export default function SettingsPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([{ key: "" }]);

  useEffect(() => {
    const k = loadKeys();
    setKeys(k.length ? k : [{ key: "" }]);
  }, []);

  function setKeyAt(i: number, v: string) {
    const next = keys.slice();
    next[i] = { key: v };
    setKeys(next);
  }

  function addSlot() {
    if (keys.length >= 5) return;
    setKeys([...keys, { key: "" }]);
  }

  function removeAt(i: number) {
    const next = keys.filter((_, idx) => idx !== i);
    setKeys(next.length ? next : [{ key: "" }]);
  }

  function onSave() {
    const cleaned = keys
      .map((x) => ({ key: (x.key || "").trim() }))
      .filter((x) => x.key)
      .slice(0, 5);

    saveKeys(cleaned);
    setKeys(cleaned.length ? cleaned : [{ key: "" }]);
    alert("Saved (max 5 keys).");
  }

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Settings</h1>

      <section style={{ border: "1px solid #333", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Gemini API Keys (max 5)</h2>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
          Keys disimpan di browser (localStorage). Tidak dikirim kemana-mana sampai kamu pakai untuk generate.
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {keys.map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input
                value={it.key}
                onChange={(e) => setKeyAt(i, e.target.value)}
                placeholder={`API Key #${i + 1}`}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #333", outline: "none" }}
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                onClick={() => removeAt(i)}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #333", background: "#111", cursor: "pointer" }}
              >
                Remove
              </button>
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
            onClick={onSave}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #333", background: "#111", cursor: "pointer", fontWeight: 800 }}
          >
            Save
          </button>
        </div>
      </section>
    </main>
  );
}
