"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  Compass,
  Download,
  Image as ImageIcon,
  Loader2,
  Mic,
  Play,
  Pause,
  RefreshCw,
  Upload,
  Video,
  Zap,
  KeyRound,
  CheckCircle2,
  X,
  ClipboardCopy,
} from "lucide-react";

type StyleId = "ERA_KOLONIAL" | "SEJARAH_PERJUANGAN" | "LEGENDA_RAKYAT" | "BUDAYA_NUSANTARA";
type FormatId = "SHORT" | "LONG";

type Scene = {
  id: string;
  narrative: string;
  imagePromptA?: string;
  imagePromptB?: string;
};

type ScriptResult = { scenes: Scene[] };

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

  // UI preview state (tetap ada, tapi image/audio belum diaktifkan)
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentVisualSlot, setCurrentVisualSlot] = useState<"A" | "B">("A");
  const [showCtaPreview, setShowCtaPreview] = useState(false);

  // Audio UI (placeholder, karena audio belum di-generate)
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // File input
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingIntervalRef = useRef<number | null>(null);

  // API KEY MANAGER (5 slot) + menu
  const [showKeyMenu, setShowKeyMenu] = useState(false);
  const [apiKeys, setApiKeys] = useState<string[]>(["", "", "", "", ""]);
  const [activeKeyIndex, setActiveKeyIndex] = useState(0);
  const apiKey = apiKeys[activeKeyIndex] || "";

  const [rawOutput, setRawOutput] = useState("");

  const [project, setProject] = useState<VideoProject>({
    topic: "",
    style: "SEJARAH_PERJUANGAN",
    format: "SHORT",
    scenes: [],
  });

  const currentScene = project.scenes[currentSceneIndex];

  useEffect(() => {
    // Load stored keys
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("NUDIORAMA_KEYS") : null;
    const active = typeof window !== "undefined" ? window.localStorage.getItem("NUDIORAMA_ACTIVE") : null;
    if (saved) {
      const parsed = safeJsonParse<string[]>(saved);
      if (parsed && Array.isArray(parsed) && parsed.length === 5) setApiKeys(parsed);
    }
    if (active) {
      const n = Number(active);
      if (!Number.isNaN(n) && n >= 0 && n < 5) setActiveKeyIndex(n);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("NUDIORAMA_KEYS", JSON.stringify(apiKeys));
      window.localStorage.setItem("NUDIORAMA_ACTIVE", String(activeKeyIndex));
    }
  }, [apiKeys, activeKeyIndex]);

  useEffect(() => {
    if (isLoading) {
      let idx = 0;
      loadingIntervalRef.current = window.setInterval(() => {
        idx = (idx + 1) % LOADING_MESSAGES.length;
        setLoadingMsg(LOADING_MESSAGES[idx]);
      }, 1500);
    } else {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    }
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    };
  }, [isLoading]);

  const promptTrending = useMemo(() => {
    return [
      "Kamu adalah penulis ide topik konten sejarah/legenda/budaya Indonesia.",
      "Output WAJIB JSON valid saja (tanpa markdown).",
      '{ "topic": "string" }',
      `Beri 1 topik yang viral dan spesifik untuk kategori: ${project.style}.`,
      "Topik harus berupa satu kalimat pendek (maks 120 karakter), bahasa Indonesia, konkret (tokoh/tempat/peristiwa).",
    ].join("\n");
  }, [project.style]);

  const promptScript = useMemo(() => {
    const aspect = project.format === "SHORT" ? "9:16" : "16:9";
    const count = project.format === "SHORT" ? 9 : 18;
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
      "KONTEKS:",
      `- Kategori/style: ${project.style}`,
      `- Format: ${project.format} (aspect ${aspect})`,
      `- Topik/kisah: ${project.topic}`,
      project.referenceImage ? "- Ada reference image (gunakan sebagai referensi gaya, bukan copy persis)" : "- Tanpa reference image",
      "",
      "ATURAN:",
      `- Buat ${count} scenes.`,
      "- Tiap scene harus punya id unik, narrative, imagePromptA, imagePromptB.",
      "- Visual harus gaya 'miniature diorama' (tilt-shift, macro lens, texture detail, museum-grade).",
      "- Jangan sebut 'AI' di narasi. Fokus kisah & emosi.",
    ].join("\n");
  }, [project.format, project.style, project.topic, project.referenceImage]);

  async function callGenerate(prompt: string) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey || "",
      },
      body: JSON.stringify({
        apiKey,
        key: apiKey,
        prompt,
      }),
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

      const scenes =
        parsed?.scenes
          ?.map((s) => ({
            id: s?.id || uid(),
            narrative: (s?.narrative || "").trim(),
            imagePromptA: (s?.imagePromptA || "").trim(),
            imagePromptB: (s?.imagePromptB || "").trim(),
          }))
          ?.filter((s) => s.narrative) ?? [];

      if (scenes.length === 0) throw new Error("JSON scenes kosong / tidak valid.");

      setProject((p) => ({ ...p, scenes }));
      setCurrentSceneIndex(0);
      setCurrentVisualSlot("A");
      setShowCtaPreview(false);
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

  const getCurrentActiveImage = () => {
    // Image belum ada (kita belum bikin /api/image), jadi placeholder hitam
    return "";
  };

  const togglePlaySceneAudio = (sceneId: string) => {
    audioSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    audioSourcesRef.current = [];
    if (playingAudioId === sceneId) {
      setPlayingAudioId(null);
      return;
    }
    setPlayingAudioId(sceneId);
    setTimeout(() => setPlayingAudioId(null), 600);
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
            <div className="bg-slate-50 border-4 border-black p-4 rounded-2xl text-black font-bold italic text-xs">"{loadingMsg}"</div>
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

      {/* HEADER */}
      <header className="h-16 border-b-4 border-black bg-comic-yellow sticky top-0 z-[100] flex items-center justify-between px-4 sm:px-8 shadow-comic">
        <div className="flex items-center gap-3 cursor-pointer font-display text-black text-xl italic" onClick={() => setCurrentStep(0)}>
          <Compass size={24} className="p-1 bg-comic-pink border-2 border-black rounded shadow-comic" /> NUSANTARA DIORAMA AI
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKeyMenu(true)}
            className="bg-white border-4 border-black rounded-xl px-3 py-2 shadow-comic flex items-center gap-2 text-black font-black text-[10px] uppercase"
            title="Tambah/atur API key"
          >
            <KeyRound size={16} /> ADD APIKEY
          </button>

          <div className="hidden sm:block bg-white border-4 border-black rounded-xl px-3 py-2 shadow-comic text-black font-black text-[10px] uppercase">
            KEY AKTIF: #{activeKeyIndex + 1} {apiKey ? "✅" : "❌"}
          </div>
        </div>
      </header>

      {/* API KEY MENU MODAL */}
      {showKeyMenu && (
        <div className="fixed inset-0 z-[1200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white border-8 border-black rounded-[2.5rem] shadow-comic-lg p-6 sm:p-8 text-black">
            <div className="flex items-center justify-between mb-4">
              <div className="font-display text-2xl uppercase italic flex items-center gap-2">
                <KeyRound /> API KEY (5 SLOT)
              </div>
              <button onClick={() => setShowKeyMenu(false)} className="p-2 border-4 border-black rounded-xl shadow-comic bg-comic-pink">
                <X />
              </button>
            </div>

            <div className="space-y-3">
              {apiKeys.map((k, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-comic-yellow border-4 border-black rounded-xl flex items-center justify-center font-display text-lg shadow-comic">
                    {i + 1}
                  </div>
                  <input
                    value={k}
                    onChange={(e) => {
                      const copy = [...apiKeys];
                      copy[i] = e.target.value;
                      setApiKeys(copy);
                    }}
                    className="flex-1 bg-slate-50 border-4 border-black rounded-2xl px-4 py-2 text-sm font-bold shadow-inner focus:outline-none"
                    placeholder={`Paste API key slot #${i + 1}`}
                  />
                  <button
                    onClick={() => setActiveKeyIndex(i)}
                    className={`px-4 py-2 border-4 border-black rounded-2xl font-display text-[10px] uppercase shadow-comic flex items-center gap-2 ${
                      activeKeyIndex === i ? "bg-comic-cyan" : "bg-white"
                    }`}
                  >
                    {activeKeyIndex === i ? <CheckCircle2 size={14} /> : null}
                    {activeKeyIndex === i ? "AKTIF" : "PAKAI"}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 bg-slate-50 border-4 border-black rounded-2xl p-4 text-[11px] font-bold">
              Status: Key aktif sekarang = <span className="font-black">#{activeKeyIndex + 1}</span> {apiKey ? "✅ terisi" : "❌ kosong"} (tersimpan di browser)
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setShowKeyMenu(false)}
                className="px-6 py-3 bg-comic-yellow border-4 border-black rounded-2xl font-display text-sm uppercase shadow-comic"
              >
                SIMPAN & TUTUP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN */}
      <main className="flex-1 overflow-x-hidden">
        {/* STEP 0 */}
        {currentStep === 0 && (
          <div className="h-full flex items-center justify-center p-4 sm:p-8 animate-fadeIn">
            <div className="w-full max-w-xl bg-white border-4 border-black rounded-[2.5rem] p-6 sm:p-10 shadow-comic-lg space-y-8 tilt-right">
              <div className="text-center">
                <h1 className="text-4xl sm:text-5xl font-display text-black leading-tight uppercase">
                  BUAT <span className="text-comic-purple">DIORAMA</span> SEJARAH
                </h1>
                <p className="text-black/60 font-black italic uppercase text-[10px] tracking-widest mt-2">Physical Macro Miniature Storyteller</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="bg-comic-cyan border-2 border-black px-2 py-0.5 text-[10px] font-black text-black uppercase">1. Pilih Kategori</label>
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
                        className={`flex items-center justify-center gap-2 p-3 sm:p-4 border-4 border-black font-display text-[10px] sm:text-xs uppercase transition-all ${
                          project.style === t.id ? `bg-comic-yellow text-black translate-y-1 shadow-none` : "bg-white text-black shadow-comic hover:-translate-y-1"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="bg-comic-pink border-2 border-black px-2 py-0.5 text-[10px] font-black text-black uppercase">2. Format</label>
                    <div className="flex gap-2">
                      {(["SHORT", "LONG"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setProject({ ...project, format: f })}
                          className={`flex-1 py-3 border-2 border-black font-display text-black uppercase ${project.format === f ? "bg-comic-yellow" : "bg-white shadow-comic"}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-slate-100 border-2 border-dashed border-black rounded-2xl flex items-center justify-center cursor-pointer shadow-inner overflow-hidden min-h-[60px]"
                    title="Reference image (opsional)"
                  >
                    {project.referenceImage ? (
                      <img src={`data:image/jpeg;base64,${project.referenceImage}`} className="w-full h-full object-cover" alt="ref" />
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
                          reader.onload = () => setProject({ ...project, referenceImage: (reader.result as string).split(",")[1] });
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
                    <label className="bg-comic-cyan border-2 border-black px-2 py-0.5 text-[10px] font-black text-black uppercase">3. Tentukan Kisah</label>
                    <button
                      onClick={handlePickRandomTopic}
                      disabled={isSearching || isLoading}
                      className="text-[10px] font-black text-comic-purple flex items-center gap-1 hover:scale-110 uppercase disabled:opacity-50"
                    >
                      {isSearching ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} fill="currentColor" />} CARI TOPIK
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

              <div className="bg-slate-50 border-4 border-black rounded-2xl p-4 text-black font-bold text-[11px]">
                Key aktif: <span className="font-black">#{activeKeyIndex + 1}</span>{" "}
                {apiKey ? "✅ siap dipakai" : "❌ belum diisi"} — klik <span className="font-black">ADD APIKEY</span> di atas.
              </div>
            </div>
          </div>
        )}

        {/* STEP 1 (Scenes) */}
        {currentStep === 1 && (
          <div className="p-4 sm:p-8 space-y-8 animate-fadeIn overflow-y-auto h-full custom-scrollbar pb-32">
            <div className="flex justify-between items-center bg-white border-4 border-black p-4 rounded-3xl shadow-comic sticky top-0 z-50">
              <button onClick={() => setCurrentStep(0)} className="bg-comic-pink p-2 border-4 border-black rounded shadow-comic">
                <ChevronLeft size={20} className="text-black" />
              </button>

              <h2 className="font-display text-black text-xl sm:text-2xl uppercase italic truncate px-2">{project.topic}</h2>

              <div className="flex gap-2">
                <button
                  onClick={handleCopyJson}
                  className="bg-comic-cyan px-4 sm:px-6 py-2 border-4 border-black rounded font-display text-[10px] sm:text-sm text-black shadow-comic uppercase flex items-center gap-2"
                >
                  <ClipboardCopy size={14} /> COPY JSON
                </button>
                <button
                  onClick={handleDownloadJson}
                  className="bg-comic-yellow px-4 sm:px-6 py-2 border-4 border-black rounded font-display text-[10px] sm:text-sm text-black shadow-comic uppercase flex items-center gap-2"
                >
                  <Download size={14} /> DOWNLOAD
                </button>
                <button
                  onClick={() => {
                    setCurrentStep(2);
                    setShowCtaPreview(false);
                  }}
                  className="bg-white px-4 sm:px-6 py-2 border-4 border-black rounded font-display text-[10px] sm:text-sm text-black shadow-comic uppercase"
                  title="Preview placeholder (image belum diaktifkan)"
                >
                  PREVIEW
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
              {project.scenes.map((s, idx) => (
                <div
                  key={s.id}
                  className={`bg-white border-4 border-black p-6 sm:p-8 rounded-[2.5rem] shadow-comic-lg flex flex-col gap-6 ${idx % 2 === 0 ? "tilt-left" : "tilt-right"}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-comic-pink border-4 border-black rounded-xl flex items-center justify-center font-display text-2xl text-black shadow-comic">
                        #{idx + 1}
                      </div>

                      <button
                        onClick={() => togglePlaySceneAudio(s.id)}
                        className={`w-10 h-10 border-4 border-black rounded-xl flex items-center justify-center shadow-comic hover:scale-110 transition-all text-black ${
                          playingAudioId === s.id ? "bg-comic-red animate-pulse" : "bg-comic-yellow"
                        }`}
                        title="Audio belum diaktifkan (nanti pakai /api/voice)"
                      >
                        {playingAudioId === s.id ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                      </button>
                    </div>

                    <button
                      disabled
                      className="px-4 py-2 border-4 border-black rounded-xl font-display text-[10px] text-black shadow-comic flex items-center gap-2 bg-slate-200 opacity-60 cursor-not-allowed"
                      title="Nanti: /api/voice"
                    >
                      <Mic size={12} /> GENERATE SUARA (NEXT)
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="aspect-[9/12] bg-black border-4 border-black rounded-2xl overflow-hidden relative shadow-inner">
                        <div className="h-full flex items-center justify-center opacity-20">
                          <ImageIcon size={40} />
                        </div>
                      </div>
                      <button
                        disabled
                        className="w-full py-2 bg-slate-200 border-4 border-black rounded-xl font-display text-[9px] text-black shadow-comic uppercase opacity-60 cursor-not-allowed"
                        title="Nanti: /api/image (A)"
                      >
                        A: Setup (NEXT)
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="aspect-[9/12] bg-black border-4 border-black rounded-2xl overflow-hidden relative shadow-inner">
                        <div className="h-full flex items-center justify-center opacity-20">
                          <ImageIcon size={40} />
                        </div>
                      </div>
                      <button
                        disabled
                        className="w-full py-2 bg-slate-200 border-4 border-black rounded-xl font-display text-[9px] text-black shadow-comic uppercase opacity-60 cursor-not-allowed"
                        title="Nanti: /api/image (B)"
                      >
                        B: Klimaks (NEXT)
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border-4 border-black p-4 rounded-2xl shadow-inner text-black font-bold text-xs italic leading-relaxed">
                    "{s.narrative}"
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-black uppercase">Prompt A</div>
                    <div className="bg-slate-50 border-4 border-black rounded-2xl p-3 text-[11px] text-black font-bold whitespace-pre-wrap">
                      {s.imagePromptA || "-"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-black uppercase">Prompt B</div>
                    <div className="bg-slate-50 border-4 border-black rounded-2xl p-3 text-[11px] text-black font-bold whitespace-pre-wrap">
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
          </div>
        )}

        {/* STEP 2 (Preview placeholder) */}
        {currentStep === 2 && (
          <div className="h-full flex flex-col p-4 sm:p-6 animate-fadeIn halftone bg-slate-900 overflow-hidden">
            <div className="flex-1 flex items-center justify-center relative">
              <button
                onClick={() => setCurrentStep(1)}
                className="absolute top-4 left-4 bg-comic-pink p-3 border-4 border-black rounded shadow-comic z-50 text-black hover:scale-110 transition-all"
              >
                <ChevronLeft />
              </button>

              <div
                className={`aspect-[${project.format === "SHORT" ? "9/16" : "16/9"}] w-full max-w-[min(100%,75vh*${project.format === "SHORT" ? "9/16" : "16/9"})] bg-black border-8 border-black rounded-[3rem] overflow-hidden shadow-comic-lg relative`}
              >
                {!showCtaPreview ? (
                  <>
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                      <ImageIcon size={64} />
                    </div>
                    <div className="absolute bottom-12 left-0 w-full px-6">
                      <div className="bg-white border-4 border-black p-4 tilt-left shadow-comic text-black font-display text-sm italic">
                        "{currentScene?.narrative || "Preview belum ada image (next: /api/image)."}"
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full bg-comic-yellow flex flex-col items-center justify-center p-10 text-center animate-fadeIn relative">
                    <h2 className="text-4xl font-display text-black uppercase leading-tight">
                      CTA FINAL<br />
                      <span className="text-comic-pink text-5xl">FOLLOW YA!</span>
                    </h2>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border-t-8 border-black p-4 sm:p-6 flex flex-col gap-4">
              <div className="flex justify-center gap-2 sm:gap-4 overflow-x-auto py-2">
                <button
                  onClick={() => {
                    setCurrentVisualSlot("A");
                    setShowCtaPreview(false);
                  }}
                  className={`px-4 sm:px-6 py-3 border-4 border-black rounded-xl font-display uppercase shadow-comic text-[10px] sm:text-xs ${
                    currentVisualSlot === "A" && !showCtaPreview ? "bg-comic-pink text-black" : "bg-white text-black opacity-50"
                  }`}
                >
                  Visual A
                </button>
                <button
                  onClick={() => {
                    setCurrentVisualSlot("B");
                    setShowCtaPreview(false);
                  }}
                  className={`px-4 sm:px-6 py-3 border-4 border-black rounded-xl font-display uppercase shadow-comic text-[10px] sm:text-xs ${
                    currentVisualSlot === "B" && !showCtaPreview ? "bg-comic-cyan text-black" : "bg-white text-black opacity-50"
                  }`}
                >
                  Visual B
                </button>
                <button
                  onClick={() => setShowCtaPreview(true)}
                  className={`px-4 sm:px-6 py-3 border-4 border-black rounded-xl font-display uppercase shadow-comic text-[10px] sm:text-xs ${
                    showCtaPreview ? "bg-comic-yellow text-black" : "bg-white text-black opacity-50"
                  }`}
                >
                  CTA Final
                </button>
              </div>

              <div className="flex gap-2 sm:gap-4 justify-center">
                <button
                  disabled
                  className="px-4 sm:px-6 py-4 bg-slate-200 border-4 border-black rounded-2xl font-display text-[10px] sm:text-xs text-black shadow-comic uppercase opacity-60 cursor-not-allowed"
                  title="Next: /api/image + /api/voice + zip"
                >
                  SIMPAN SEMUA (NEXT)
                </button>
                <button
                  disabled
                  className="px-6 sm:px-10 py-4 bg-slate-200 border-4 border-black rounded-2xl font-display text-lg sm:text-2xl text-black shadow-comic-lg flex items-center gap-3 uppercase opacity-60 cursor-not-allowed"
                  title="Next: render server-side / worker"
                >
                  <Video size={24} /> RENDER VIDEO (NEXT)
                </button>
              </div>
            </div>

            <div className="h-28 bg-comic-purple border-t-4 border-black flex items-center px-6 gap-6 overflow-x-auto custom-scrollbar flex-shrink-0">
              {project.scenes.map((s, idx) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setCurrentSceneIndex(idx);
                    setShowCtaPreview(false);
                  }}
                  className={`min-w-[100px] h-20 border-4 border-black rounded-xl shadow-comic cursor-pointer overflow-hidden transition-all ${
                    currentSceneIndex === idx && !showCtaPreview ? "scale-110 border-white ring-2 ring-black z-10" : "opacity-40 hover:opacity-100"
                  }`}
                  title="Thumbnail placeholder"
                >
                  <div className="w-full h-full bg-black flex items-center justify-center opacity-30">
                    <ImageIcon size={24} />
                  </div>
                </div>
              ))}
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
