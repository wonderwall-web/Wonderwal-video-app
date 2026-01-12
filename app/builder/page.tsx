"use client";

import { useEffect, useState } from "react";
import { Key, Plus, Check, X, Sparkles } from "lucide-react";

export default function BuilderPage() {
  const [apiKeys, setApiKeys] = useState<string[]>(["", "", "", "", ""]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("NUDIORAMA_KEYS");
    const active = localStorage.getItem("NUDIORAMA_ACTIVE");
    if (saved) setApiKeys(JSON.parse(saved));
    if (active) setActiveIndex(Number(active));
  }, []);

  useEffect(() => {
    localStorage.setItem("NUDIORAMA_KEYS", JSON.stringify(apiKeys));
    localStorage.setItem("NUDIORAMA_ACTIVE", String(activeIndex));
  }, [apiKeys, activeIndex]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex">
      
      {/* Sidebar */}
      <aside className="w-64 bg-[#020617] border-r border-white/10 p-6 flex flex-col gap-6">
        <div className="text-xl font-bold flex items-center gap-2">
          <Sparkles size={20}/> Nusantara AI
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg font-medium hover:opacity-90"
        >
          <Plus size={16}/> Add API Key
        </button>

        <div className="text-xs opacity-60">
          Active Key: #{activeIndex + 1}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col">
        <header className="h-14 border-b border-white/10 flex items-center px-6 text-sm opacity-80">
          Builder
        </header>

        <div className="flex-1 flex items-center justify-center text-white/40">
          UI Builder kamu nanti tampil di sini (clean workspace seperti AI Studio)
        </div>
      </main>

      {/* Modal API Key Manager */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0f172a] w-full max-w-lg rounded-xl border border-white/10 p-6 space-y-4">
            
            <div className="flex justify-between items-center">
              <h2 className="font-semibold flex items-center gap-2">
                <Key size={18}/> API Key Manager (5 Slot)
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X size={18}/>
              </button>
            </div>

            <div className="space-y-3">
              {apiKeys.map((k, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={k}
                    onChange={(e) => {
                      const copy = [...apiKeys];
                      copy[i] = e.target.value;
                      setApiKeys(copy);
                    }}
                    placeholder={`API Key slot #${i + 1}`}
                    className="flex-1 bg-black/40 border border-white/10 px-3 py-2 rounded text-sm"
                  />
                  <button
                    onClick={() => setActiveIndex(i)}
                    className={`px-3 rounded text-sm border ${
                      activeIndex === i
                        ? "bg-green-500 text-black"
                        : "border-white/20"
                    }`}
                  >
                    {activeIndex === i ? <Check size={16}/> : "Use"}
                  </button>
                </div>
              ))}
            </div>

            <div className="text-xs opacity-50 pt-2">
              Keys disimpan lokal di browser user.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
