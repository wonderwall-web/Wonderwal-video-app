"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Slot = {
  label: string;
  apiKey: string;
  lastUsed?: number;
};

const LS_SLOTS = "YOSO_API_KEY_SLOTS";
const LS_PRIMARY = "YOSO_API_KEY";

function maskKey(k: string) {
  const s = (k || "").trim();
  if (s.length <= 10) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

function loadSlots(): Slot[] {
  try {
    const raw = localStorage.getItem(LS_SLOTS);
    if (!raw) return [];
    const j = JSON.parse(raw);
    if (!Array.isArray(j)) return [];
    return j
      .map((x: any, i: number) => ({
        label: String(x?.label || `KEY${i + 1}`),
        apiKey: String(x?.apiKey || ""),
        lastUsed: typeof x?.lastUsed === "number" ? x.lastUsed : undefined,
      }))
      .slice(0, 5);
  } catch {
    return [];
  }
}

function saveSlots(slots: Slot[]) {
  localStorage.setItem(LS_SLOTS, JSON.stringify(slots));
}

function pickFirstKey(slots: Slot[]) {
  for (const s of slots) {
    const k = (s.apiKey || "").trim();
    if (k) return k;
  }
  return "";
}

export default function SettingsPage() {
  const [slots, setSlots] = useState<Slot[]>([
    { label: "KEY1", apiKey: "" },
    { label: "KEY2", apiKey: "" },
    { label: "KEY3", apiKey: "" },
    { label: "KEY4", apiKey: "" },
    { label: "KEY5", apiKey: "" },
  ]);

  const [msg, setMsg] = useState("");
  const filled = useMemo(() => slots.filter((s) => (s.apiKey || "").trim()).length, [slots]);

  useEffect(() => {
    const loaded = loadSlots();
    if (loaded.length) {
      const next = [...slots];
      for (let i = 0; i < 5; i++) {
        next[i] = {
          label: `KEY${i + 1}`,
          apiKey: (loaded[i]?.apiKey || "").trim(),
          lastUsed: loaded[i]?.lastUsed,
        };
      }
      setSlots(next);

      const primary = (localStorage.getItem(LS_PRIMARY) || "").trim();
      if (!primary) {
        const first = pickFirstKey(next);
        if (first) localStorage.setItem(LS_PRIMARY, first);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pingKey(apiKey: string) {
    const r = await fetch("/api/gemini/ping", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) throw new Error(JSON.stringify(j));
    return j;
  }

  function onChange(i: number, v: string) {
    const next = [...slots];
    next[i] = { ...next[i], apiKey: v };
    setSlots(next);
  }

  function onSavePrimary() {
    const next = slots.map((s, i) => ({ label: `KEY${i + 1}`, apiKey: (s.apiKey || "").trim(), lastUsed: s.lastUsed }));
    saveSlots(next);

    const first = pickFirstKey(next);
    if (first) {
      localStorage.setItem(LS_PRIMARY, first); // ✅ INI KUNCI: builder baca ini
      setMsg(`SAVED ✅ Primary set: ${maskKey(first)}`);
    } else {
      localStorage.removeItem(LS_PRIMARY);
      setMsg("SAVED ✅ (tapi belum ada key terisi)");
    }
  }

  function onSaveAndBack() {
    onSavePrimary();
    setTimeout(() => {
      window.location.href = "/builder";
    }, 250);
  }

  async function onTestAutoPick() {
    setMsg("Testing first filled key...");
    const first = pickFirstKey(slots);
    if (!first) {
      setMsg("Tidak ada key terisi.");
      return;
    }
    try {
      await pingKey(first);
      localStorage.setItem(LS_PRIMARY, first); // ✅ selalu set primary kalau valid
      setMsg(`OK: KEY valid (ping sukses). Primary = ${maskKey(first)}`);
    } catch (e: any) {
      setMsg(`PING FAIL: ${String(e?.message || e).slice(0, 300)}`);
    }
  }

  function onClearAll() {
    localStorage.removeItem(LS_SLOTS);
    localStorage.removeItem(LS_PRIMARY);
    setSlots([
      { label: "KEY1", apiKey: "" },
      { label: "KEY2", apiKey: "" },
      { label: "KEY3", apiKey: "" },
      { label: "KEY4", apiKey: "" },
      { label: "KEY5", apiKey: "" },
    ]);
    setMsg("Cleared.");
  }

  return (
    <div className="wrap">
      <div className="top">
        <div>
          <div className="h1">Settings — Gemini API Keys</div>
          <div className="sub">Simpan 5 key di browser. Tombol “Save & Back to Home” akan set primary key untuk Builder.</div>
        </div>
        <Link className="back" href="/builder">
          Back
        </Link>
      </div>

      <div className="actions">
        <button className="btn primary" onClick={onTestAutoPick}>
          Test 1 Key (Auto Pick)
        </button>
        <button className="btn" onClick={onSavePrimary}>
          Save
        </button>
        <button className="btn green" onClick={onSaveAndBack}>
          Save & Back to Home
        </button>
        <button className="btn danger" onClick={onClearAll}>
          Clear All
        </button>

        <div className="chips">
          <div className="chip">Filled: {filled}/5</div>
          {msg ? <div className="chip ok">{msg}</div> : null}
        </div>
      </div>

      <div className="list">
        {slots.map((s, i) => (
          <div key={s.label} className="card">
            <div className="row">
              <div className="k">{s.label}</div>
              <div className="small">Preview: {maskKey(s.apiKey)}</div>
            </div>
            <input className="input" value={s.apiKey} onChange={(e) => onChange(i, e.target.value)} placeholder="AIzaSy...." />
          </div>
        ))}
      </div>

      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: radial-gradient(1200px 800px at 20% 0%, #0b1b3a 0%, #060a14 60%, #050712 100%);
          color: #e7eefc;
          padding: 18px;
        }
        .top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          background: rgba(10, 16, 30, 0.55);
          backdrop-filter: blur(10px);
        }
        .h1 {
          font-weight: 900;
          font-size: 20px;
        }
        .sub {
          margin-top: 6px;
          font-size: 12px;
          opacity: 0.75;
          max-width: 760px;
          line-height: 1.35;
        }
        .back {
          text-decoration: none;
          color: #dbeafe;
          font-weight: 800;
          font-size: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(15, 23, 42, 0.6);
        }
        .actions {
          margin-top: 12px;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          background: rgba(10, 16, 30, 0.55);
          backdrop-filter: blur(10px);
        }
        .btn {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(15, 23, 42, 0.7);
          color: #e7eefc;
          font-weight: 900;
          margin-right: 10px;
          cursor: pointer;
        }
        .btn.primary {
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(59, 130, 246, 0.75));
        }
        .btn.green {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(34, 197, 94, 0.7));
        }
        .btn.danger {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(248, 113, 113, 0.75));
        }
        .chips {
          margin-top: 12px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .chip {
          font-size: 12px;
          font-weight: 900;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(15, 23, 42, 0.6);
          opacity: 0.9;
        }
        .chip.ok {
          color: #bbf7d0;
        }
        .list {
          margin-top: 12px;
          display: grid;
          gap: 12px;
        }
        .card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          background: rgba(10, 16, 30, 0.55);
          backdrop-filter: blur(10px);
          padding: 14px;
        }
        .row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .k {
          font-weight: 1000;
          font-size: 14px;
        }
        .small {
          font-size: 12px;
          opacity: 0.7;
        }
        .input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(2, 6, 23, 0.6);
          color: #e7eefc;
          padding: 10px 12px;
          outline: none;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
