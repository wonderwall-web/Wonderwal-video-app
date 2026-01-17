"use client";

import { useEffect, useMemo, useState } from "react";
import {
  clearApiKeySlots,
  loadApiKeySlots,
  markCooldown,
  markUsed,
  msToHuman,
  pickReadyKey,
  saveApiKeySlots,
  updateSlotKey,
  type ApiKeySlot,
  type PickKeyResult,
} from "../lib/apikeyStore";

function isPickFail(p: PickKeyResult): p is Extract<PickKeyResult, { ok: false }> {
  return p.ok === false;
}

function maskKey(k: string) {
  const t = (k || "").trim();
  if (!t) return "";
  if (t.length <= 10) return "**********";
  return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

export default function SettingsPage() {
  const [slots, setSlots] = useState<ApiKeySlot[]>([]);
  const [status, setStatus] = useState<string>("");
  const [testing, setTesting] = useState(false);

  useEffect(() => setSlots(loadApiKeySlots()), []);

  const now = Date.now();
  const summary = useMemo(() => {
    const filled = slots.filter((s) => s.key.trim().length > 0).length;
    const cooling = slots.filter((s) => s.key.trim().length > 0 && s.cooldownUntil > now).length;
    return { filled, cooling };
  }, [slots, now]);

  async function testPickAndPing() {
    setTesting(true);
    setStatus("");
    try {
      const pick = pickReadyKey();

      if (isPickFail(pick)) {
        if (pick.reason === "NO_KEYS") setStatus("Tidak ada API key. Isi minimal 1 key dulu.");
        else {
          const wait = Math.max(0, (pick.nextReadyAt || 0) - Date.now());
          setStatus(`Semua key cooldown. Coba lagi dalam ${msToHuman(wait)}.`);
        }
        return;
      }

      const slot = pick.slot;
      setStatus(`Testing ${slot.label} (${maskKey(slot.key)}) ...`);

      const res = await fetch("/api/gemini/ping", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: slot.key }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        markCooldown(slot.id, 60_000, "429");
        setSlots(loadApiKeySlots());
        setStatus(`429 RESOURCE_EXHAUSTED. ${slot.label} cooldown 60s.`);
        return;
      }

      if (!res.ok) {
        const msg = (data?.error || data?.message || `HTTP_${res.status}`) as string;
        setStatus(`Gagal: ${slot.label} → ${msg}`);
        return;
      }

      markUsed(slot.id);
      setSlots(loadApiKeySlots());
      setStatus(`OK: ${slot.label} valid (ping sukses).`);
    } finally {
      setTesting(false);
    }
  }

  function onChangeKey(slotId: string, value: string) {
    const next = updateSlotKey(slotId, value);
    setSlots(next);
    setStatus("Tersimpan di browser (localStorage).");
  }

  function onClearAll() {
    clearApiKeySlots();
    setSlots(loadApiKeySlots());
    setStatus("Semua API key dihapus dari browser.");
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(slots, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ww_gemini_keys.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJsonFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "[]"));
        if (!Array.isArray(parsed)) throw new Error("invalid");
        saveApiKeySlots(parsed);
        setSlots(loadApiKeySlots());
        setStatus("Import sukses. Keys tersimpan di browser.");
      } catch {
        setStatus("Import gagal. File JSON tidak valid.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b1220", color: "#e5e7eb" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Settings — Gemini API Keys</div>
            <div style={{ opacity: 0.85, marginTop: 6, fontSize: 13 }}>
              Simpan 5 key di browser. Rotasi otomatis saat 429. Jika quota 0, key memang tidak punya kuota.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={testPickAndPing}
              disabled={testing}
              style={{
                background: testing ? "#111827" : "#2563eb",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#fff",
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 700,
                cursor: testing ? "not-allowed" : "pointer",
              }}
            >
              {testing ? "Testing..." : "Test 1 Key (Auto Pick)"}
            </button>

            <button
              onClick={exportJson}
              style={{
                background: "#0f172a",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#e5e7eb",
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Export JSON
            </button>

            <label
              style={{
                background: "#0f172a",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#e5e7eb",
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Import JSON
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJsonFile(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <button
              onClick={onClearAll}
              style={{
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#e5e7eb",
                padding: "10px 14px",
                borderRadius: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Clear All
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ padding: "8px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", fontSize: 12 }}>
            Filled: <b>{summary.filled}/5</b>
          </div>
          <div style={{ padding: "8px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", fontSize: 12 }}>
            Cooldown: <b>{summary.cooling}</b>
          </div>
          {status ? (
            <div style={{ padding: "8px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(34,197,94,0.10)", fontSize: 12 }}>
              {status}
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
          {slots.map((s) => {
            const cd = Math.max(0, s.cooldownUntil - Date.now());
            const isCd = cd > 0 && s.key.trim().length > 0;
            return (
              <div
                key={s.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 16,
                  padding: 14,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>{s.label}</div>
                    {isCd ? (
                      <div style={{ fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.12)" }}>
                        Cooldown {Math.ceil(cd / 1000)}s
                      </div>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    lastUsed: {s.lastUsedAt ? new Date(s.lastUsedAt).toLocaleString() : "-"}
                  </div>
                </div>

                <input
                  value={s.key}
                  onChange={(e) => onChangeKey(s.id, e.target.value)}
                  placeholder="Paste Gemini API key di sini..."
                  spellCheck={false}
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                    padding: "12px 12px",
                    color: "#e5e7eb",
                    outline: "none",
                    fontSize: 14,
                  }}
                />
                <div style={{ fontSize: 12, opacity: 0.75 }}>Preview: <b>{maskKey(s.key)}</b></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
