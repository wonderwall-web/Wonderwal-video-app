"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ClipboardCheck,
  Compass,
  Download,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Upload,
  Video,
  Zap,
} from "lucide-react";

type StyleId = "ERA_KOLONIAL" | "SEJARAH_PERJUANGAN" | "LEGENDA_RAKYAT" | "BUDAYA_NUSANTARA";
type FormatId = "SHORT" | "LONG";

type Scene = {
  id: string;
  narrative: string;
  imagePromptA?: string;
  imagePromptB?: string;
};

type ScriptResult = {
  scenes: Scene[];
};

type VideoProject = {
  topic: string;
  style: StyleId;
  format: FormatId;
  referenceImage?: string;
  scenes: Scene[];
};

const LOADING_MESSAGES = [
  "Menganalisa metafora visual...",
  "Menyiapkan pondasi miniatur...",
  "Memahat detail diorama...",
  "Mencari sudut lensa makro...",
  "Menyesuaikan pencahayaan fajar...",
  "Merekam suara sejarah...",
  "Menghaluskan tekstur batu...",
  "Diorama Nusantara siap dipotret...",
  "Hampir selesai...",
];

function safeJsonParse<T = any>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function pickJsonFromText(text: string): string | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const candidate = text.slice(first, last + 1);
  return safeJsonParse(candidate) ? candidate : null;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function BuilderPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [rawOutput, setRawOutput] = useState<string>("");

  const [project, setProject] = useState<VideoProject>({
    topic: "",
    style: "SEJARAH_PERJUANGAN",
    format: "SHORT",
    scenes: [],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("NUDIORAMA_API_KEY") : null;
    if (saved) setApiKey(saved);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("NUDIORAMA_API_KEY", apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (isLoading) {
      let idx = 0;
      loadingIntervalRef.current = window.setInterval(() => {
        idx = (idx + 1) % LOADING_MESSAGES.length;
        setLoadingMsg(LOADING_MESSAGES[idx]);
      }, 1500);
    } else {
      if (loadingIntervalRef.current) window.clearInterval(loadingIntervalRef.current);
    }
    return () => {
      if (loadingIntervalRef.current) window.clearInterval(loadingIntervalRef.current);
    };
  }, [isLoading]);

  const promptScript = useMemo(() => {
    const aspect = project.format === "SHORT" ? "9:16" : "16:9";
    return [
      "Kamu adalah generator skrip video 'Nusantara Diorama AI'.",
      "Output WAJIB JSON valid saja (tanpa markdown, tanpa penjelasan).",
      "Skema JSON:",
      "{",
      '  "scenes": [',
      "    {",
      '      "id": "string",',
      '      "narrative": "string (narasi 1-3 kalimat, bahasa Indonesia, vivid, dramatis, cocok voiceover)",',
      '      "imagePromptA": "string (prompt gambar diorama makro miniature, setup adegan, high detail, lighting sinematik)",',
      '      "imagePromptB": "string (prompt gambar diorama makro miniature, klimaks/konflik, high detail, lighting sinematik)"',
      "    }",
      "  ]",
      "}",
      "",
      `KONTEKS:`,
      `- Kategori/style: ${project.style}`,
      `- Format: ${project.format} (aspect ${aspect})`,
      `- Topik/kisah: ${project.topic}`,
      "",
      "ATURAN:",
      `- Buat ${project.format === "SHORT" ? "9" : "18"} scenes.`,
      "- Tiap scene harus punya id unik, narrative, imagePromptA, imagePromptB.",
      "- Gunakan gaya 'miniature diorama' (tilt-shift, macro lens, texture detail, museum-grade).",
      "- Jangan sebut 'AI' di narasi. Fokus kisah & emosi.",
    ].join("\n");
  }, [project.format, project.style, project.topic]);

  const promptTrending = useMemo(() => {
    return [
      "Kamu adalah penulis ide topik konten sejarah/legenda/budaya Indonesia.",
      "Output WAJIB JSON valid saja (tanpa markdown).",
      '{ "topic": "string" }',
      `Beri 1 topik yang viral dan spesifik untuk kategori: ${project.style}.`,
      "Topik harus berupa satu kalimat pendek (maks 120 karakter), bahasa Indonesia, konkret (tokoh/tempat/peristiwa).",
    ].join("\n");
  }, [project.style]);

  async function callGenerate(prompt: string) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, prompt }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || data?.message || "Request gagal.");
    if (!data?.ok) throw new Error(data?.error || "Generate gagal.");
    return data?.output as string;
  }

  const handlePickRandomTopic = async () => {
    setIsSearching(true);
    setErrorMessage(null);
    try {
      const out = await callGenerate(promptTrending);
      setRawOutput(out || "");
      const jsonText = pickJsonFromText(out) ?? out;
      const parsed = safeJsonParse<{ topic?: string }>(jsonText);
      const topic = parsed?.topic?.trim();
      if (!topic) throw new Error("Output topik tidak valid.");
      setProject((p) => ({ ...p, topic }));
    } catch {
      setErrorMessage("Gagal mencari topik. Cek API key / koneksi, lalu coba lagi.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!project.topic) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const out = await callGenerate(promptScript);
      setRawOutput(out || "");

      const jsonText = pickJsonFromText(out) ?? out;
      const parsed = safeJsonParse<ScriptResult>(jsonText);

      const scenes = parsed?.scenes?.map((s) => ({
        id: s?.id || uid(),
        narrative: (s?.narrative || "").trim(),
        imagePromptA: (s?.imagePromptA || "").trim(),
        imagePromptB: (s?.imagePromptB || "").trim(),
      }))?.filter((s) => s.narrative);

      if (!scenes || scenes.length === 0) throw new Error("JSON scenes kosong / tidak valid.");

      setProject((p) => ({ ...p, scenes }));
      setCurrentStep(1);
    } catch (e: any) {
      setErrorMessage(e?.message || "Gagal membuat skrip. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyJson = async () => {
    const payload = JSON.stringify({ ...project, scenes: project.scenes }, null, 2);
    await navigator.clipboard.writeText(payload);
  };

  const handleDownloadJson = () => {
    const payload = JSON.stringify({ ...project, scenes: project.scenes }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nusantara_diorama_${(project.topic || "project").replace(/[^a-z0-9]/gi, "_").slice(0, 30)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-comic-dark text-white flex flex-col selection:bg-comic-pink/50 halftone relative font-sans">
      {isLoading && (
        <div className="fixed inset-0 z-[1000] bg-comic-dark/95 flex items-center justify-center p-8 backdrop-blur-md animate-fadeIn">
          <div className="bg-white border-8 border-black p-10 rounded-[3rem] shadow-comic-lg max-w-sm w-full text-center space-y-8 tilt-right">
            <div className="relative">
              <Loader2 size={80} className="animate-spin text-comic-purple mx-auto" strokeWidth={4} />
            </div>
            <h3 className="text-3xl font-display text-black uppercase">Membangun Diorama...</h3>
            <div className="bg-slate-50 border-4 border-black p-4 rounded-2xl text-black font-bold italic text-xs">
              "{loadingMsg}"
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1001] animate-fadeIn w-full max-w-md px-4">
          <div className="bg-white border-4 border-black p-4 rounded-2xl shadow-comic flex items-center gap-4 text-black font-bold tilt-left">
            <AlertCircle className="text-comic-red flex-shrink-0" />
            <div className="flex-1 text-sm">{errorMessage}</div>
            <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-slate-100 rounded">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      )}

      <header className="h-16 border-b-4 border-black bg-comic-yellow sticky top-0 z-[100] flex items-center justify-between px-8 shadow-comic">
        <div
          className="flex items-center gap-3 cursor-pointer font-display text-black text-xl italic"
          onClick={() => setCurrentStep(0)}
        >
          <Compass size={24} className="p-1 bg-comic-pink border-2 border-black rounded shadow-comic" /> NUSANTARA
          DIORAMA AI
        </div>
        <div className="text-[10px] font-black text-black uppercase tracking-tighter hidden sm:block">
          Builder • Generate via /api/generate
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden">
        {currentStep === 0 && (
          <div className="h-full flex items-center justify-center p-4 sm:p-8 animate-fadeIn">
            <div className="w-full max-w-xl bg-white border-4 border-black rounded-[2.5rem] p-6 sm:p-10 shadow-comic-lg space-y-8 tilt-right">
              <div className="text-center">
                <h1 className="text-4xl sm:text-5xl font-display text-black leading-tight uppercase">
                  BUAT <span className="text-comic-purple">DIORAMA</span> SEJARAH
                </h1>
                <p className="text-black/60 font-black italic uppercase text-[10px] tracking-widest mt-2">
                  Physical Macro Miniature Storyteller
                </p>
              </div>

              <div className="space-y-4">
                <label className="bg-slate-200 border-2 border-black px-2 py-0.5 text-[10px] font-black text-black uppercase">
                  API Key (opsional kalau backend kamu pakai server key)
                </label>
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-slate-50 border-4 border-black rounded-2xl p-3 text-sm text-black font-bold shadow-inner focus:outline-none"
                  placeholder="Paste API key (disimpan di localStorage browser)"
                />
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="bg-comic-cyan border-2 border-black px-2 py-0.5 text-[10px] font-black text-black uppercase">
                    1. Pilih Kategori
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "ERA_KOLONIAL", label: "Era Kolonial" },
                      { id: "SEJARAH_PERJUANGAN", label: "Perjuangan" },
                      { id: "LEGENDA_RAKYAT", label: "Legenda" },
                      { id: "BUDAYA_NUSANTARA", label: "Budaya" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setProject({ ...project, style: t.id as StyleId })}
                        className={`flex items-center gap-2 sm:gap-4 p-3 sm:p-4 border-4 border-black font-display text-[10px] sm:text-xs uppercase transition-all ${
                          project.style === t.id
                            ? `bg-comic-yellow text-black translate-y-1 shadow-none`
                            : "bg-white text-black shadow-comic hover:-translate-y-1"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="bg-comic-pink border-2 border-black px-2 py-0.5 text-[10px] font-black text-black uppercase">
                      2. Format
                    </label>
                    <div className="flex gap-2">
                      {(["SHORT", "LONG"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setProject({ ...project, format: f })}
                          className={`flex-1 py-3 border-2 border-black font-display text-black uppercase ${
                            project.format === f ? "bg-comic-yellow" : "bg-white shadow-comic"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-slate-100 border-2 border-dashed border-black rounded-2xl flex items-center justify-center cursor-pointer shadow-inner overflow-hidden min-h-[60px]"
                  >
                    {project.referenceImage ? (
                      <img
                        src={`data:image/jpeg;base64,${project.referenceImage}`}
                        className="w-full h-full object-cover"
                        alt="ref"
                      />
                    ) : (
                      <div className="text-black font-display text-[9px] flex flex-col items-center">
                        <Upload size={12} /> REF IMAGE
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () =>
                            setProject({ ...project, referenceImage: (reader.result as string).split(",")[1] });
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="bg-comic-cyan border-2 border-black px-2 py-0.5 text-[10px] font-black text-black uppercase">
                      3. Tentukan Kisah
                    </label>
                    <button
                      onClick={handlePickRandomTopic}
                      disabled={isSearching || isLoading}
                      className="text-[10px] font-black text-comic-purple flex items-center gap-1 hover:scale-110 uppercase disabled:opacity-50"
                    >
                      {isSearching ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} fill="currentColor" />}{" "}
                      CARI TOPIK
                    </button>
                  </div>
                  <textarea
                    value={project.topic}
                    onChange={(e) => setProject({ ...project, topic: e.target.value })}
                    className="w-full bg-slate-50 border-4 border-black rounded-2xl p-4 text-sm text-black font-bold h-24 shadow-inner focus:outline-none focus:ring-2 ring-comic-purple/20"
                    placeholder="Tulis kejadian sejarah, tokoh, atau legenda..."
                  />
                </div>
              </div>

              <button
                onClick={handleGenerateScript}
                disabled={isLoading || !project.topic}
                className="w-full py-6 bg-comic-yellow border-4 border-black rounded-3xl font-display text-2xl text-black shadow-comic hover:shadow-none transition-all active:scale-95 disabled:opacity-50"
              >
                BANGUN DIORAMA!
              </button>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="p-4 sm:p-8 space-y-6 animate-fadeIn overflow-y-auto h-full custom-scrollbar pb-24">
            <div className="flex justify-between items-center bg-white border-4 border-black p-4 rounded-3xl shadow-comic sticky top-0 z-50">
              <button
                onClick={() => setCurrentStep(0)}
                className="bg-comic-pink p-2 border-4 border-black rounded shadow-comic"
              >
                <ChevronLeft size={20} className="text-black" />
              </button>
              <h2 className="font-display text-black text-xl sm:text-2xl uppercase italic truncate px-2">{project.topic}</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyJson}
                  className="bg-comic-cyan px-4 py-2 border-4 border-black rounded font-display text-[10px] text-black shadow-comic uppercase flex items-center gap-2"
                >
                  <ClipboardCheck size={14} /> COPY JSON
                </button>
                <button
                  onClick={handleDownloadJson}
                  className="bg-comic-yellow px-4 py-2 border-4 border-black rounded font-display text-[10px] text-black shadow-comic uppercase flex items-center gap-2"
                >
                  <Download size={14} /> DOWNLOAD
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
              {project.scenes.map((s, idx) => (
                <div
                  key={s.id}
                  className={`bg-white border-4 border-black p-6 sm:p-8 rounded-[2.5rem] shadow-comic-lg flex flex-col gap-4 ${
                    idx % 2 === 0 ? "tilt-left" : "tilt-right"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-comic-pink border-4 border-black rounded-xl flex items-center justify-center font-display text-2xl text-black shadow-comic">
                        #{idx + 1}
                      </div>
                    </div>

                    <button
                      disabled
                      className="px-4 py-2 border-4 border-black rounded-xl font-display text-[10px] text-black shadow-comic flex items-center gap-2 bg-slate-200 opacity-60 cursor-not-allowed"
                      title="Fitur ini akan dipindah ke endpoint server (/api/image, /api/voice) di langkah berikutnya"
                    >
                      <ImageIcon size={12} /> IMAGE/AUDIO (NEXT)
                    </button>
                  </div>

                  <div className="bg-white border-4 border-black p-4 rounded-2xl shadow-inner text-black font-bold text-xs italic leading-relaxed">
                    "{s.narrative}"
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-black uppercase">Prompt A (Setup)</div>
                    <div className="bg-slate-50 border-2 border-black rounded-xl p-3 text-[11px] text-black font-bold whitespace-pre-wrap">
                      {s.imagePromptA || "-"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-black uppercase">Prompt B (Klimaks)</div>
                    <div className="bg-slate-50 border-2 border-black rounded-xl p-3 text-[11px] text-black font-bold whitespace-pre-wrap">
                      {s.imagePromptB || "-"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border-4 border-black rounded-[2.5rem] shadow-comic-lg p-6 sm:p-8">
              <div className="flex items-center justify-between mb-3">
                <div className="font-display text-black uppercase text-lg italic">RAW OUTPUT (DEBUG)</div>
                <button
                  onClick={() => setRawOutput("")}
                  className="px-4 py-2 bg-slate-100 border-4 border-black rounded font-display text-[10px] text-black shadow-comic uppercase"
                >
                  CLEAR
                </button>
              </div>
              <pre className="bg-slate-50 border-4 border-black rounded-2xl p-4 text-[11px] text-black font-bold overflow-auto max-h-[360px] whitespace-pre-wrap">
{rawOutput || "(kosong)"}
              </pre>
            </div>

            <div className="bg-comic-purple border-4 border-black rounded-[2.5rem] shadow-comic-lg p-6 sm:p-8 flex items-center justify-between">
              <div className="font-display text-white uppercase italic text-sm sm:text-base">
                NEXT: tambah /api/image & /api/voice untuk generate aset tanpa API key di browser
              </div>
              <div className="flex items-center gap-2 text-white font-black text-[10px] uppercase">
                <Video size={16} /> Pro Mode Soon
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: black; border: 2px solid white; border-radius: 10px; }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
