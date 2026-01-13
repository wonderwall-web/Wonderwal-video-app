"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  Play,
  Pause,
  Video,
  Mic,
  Download,
  Loader2,
  Upload,
  Zap,
  Map,
  Ghost,
  Compass,
  History,
  Castle,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  Heart,
  KeyRound,
  CheckCircle2,
  X,
} from "lucide-react";

type VideoStyle = "ERA_KOLONIAL" | "SEJARAH_PERJUANGAN" | "LEGENDA_RAKYAT" | "BUDAYA_NUSANTARA";
type VideoFormat = "SHORT" | "LONG";

type Scene = {
  id: string;
  narrative: string;
  imagePromptA: string;
  imagePromptB: string;

  imageDataA?: string;
  imageDataB?: string;
  audioRaw?: string;
  audioData?: AudioBuffer;

  isGeneratingImageA?: boolean;
  isGeneratingImageB?: boolean;
  isGeneratingAudio?: boolean;
};

type VideoProject = {
  topic: string;
  style: VideoStyle;
  format: VideoFormat;
  audience?: string;
  genre?: string;
  template?: string;
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

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

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

async function callGenerate(apiKey: string, prompt: string) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey || "",
    },
    body: JSON.stringify({ apiKey, prompt }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || data?.message || "Request gagal");
  if (!data?.ok) throw new Error(data?.error || "Generate gagal");
  return String(data?.output || "");
}

export default function BuilderPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [project, setProject] = useState<VideoProject>({
    topic: "",
    style: "SEJARAH_PERJUANGAN",
    format: "SHORT",
    audience: "LOCAL",
    genre: "DRAMA",
    template: "VIRAL_DRAMA",
    scenes: [],
  });

  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentVisualSlot, setCurrentVisualSlot] = useState<"A" | "B">("A");
  const [showCtaPreview, setShowCtaPreview] = useState(false);

  const currentScene = project.scenes[currentSceneIndex];
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingIntervalRef = useRef<number | null>(null);

  // ADD APIKEY (5 SLOT)
  const [showKeyMenu, setShowKeyMenu] = useState(false);
  const [apiKeys, setApiKeys] = useState<string[]>(["", "", "", "", ""]);
  const [activeKeyIndex, setActiveKeyIndex] = useState(0);
  const apiKey = apiKeys[activeKeyIndex] || "";

  useEffect(() => {
    const saved = localStorage.getItem("NUDIORAMA_KEYS");
    const active = localStorage.getItem("NUDIORAMA_ACTIVE");
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
    localStorage.setItem("NUDIORAMA_KEYS", JSON.stringify(apiKeys));
    localStorage.setItem("NUDIORAMA_ACTIVE", String(activeKeyIndex));
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
      "Output WAJIB JSON valid saja (tanpa markdown).",
      '{ "topic": "string" }',
      `Buat 1 topik viral & spesifik untuk kategori: ${project.style}.`,
      "Bahasa Indonesia, singkat, konkret (tokoh/tempat/peristiwa).",
    ].join("\n");
  }, [project.style]);

  const promptScript = useMemo(() => {
    const aspect = project.format === "SHORT" ? "9:16" : "16:9";
    const count = project.format === "SHORT" ? 9 : 18;
    return [
      "Output WAJIB JSON valid saja (tanpa markdown).",
      "{ scenes: [ { id, narrative, imagePromptA, imagePromptB } ] }",
      `Topik: ${project.topic}`,
      `Kategori: ${project.style}`,
      `Format: ${project.format} (${aspect})`,
      `Jumlah scene: ${count}`,
      "Gaya visual: miniature diorama, macro lens, tilt-shift, museum-grade, lighting sinematik.",
      "Narasi: dramatis, padat, 1-3 kalimat/scene, bahasa Indonesia.",
      "Prompt gambar: harus spesifik (subjek, tempat, era, properti, material, atmosfer).",
    ].join("\n");
  }, [project.topic, project.style, project.format]);

  const togglePlaySceneAudio = (sceneId: string, buffer: AudioBuffer) => {
    audioSourcesRef.current.forEach((s) => {
      try { s.stop(); } catch {}
    });
    audioSourcesRef.current = [];

    if (playingAudioId === sceneId) {
      setPlayingAudioId(null);
      return;
    }

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      setPlayingAudioId((prev) => (prev === sceneId ? null : prev));
      audioSourcesRef.current = audioSourcesRef.current.filter((s) => s !== source);
    };
    source.start();
    audioSourcesRef.current.push(source);
    setPlayingAudioId(sceneId);
  };

  const handlePickRandomTopic = async () => {
    setIsSearching(true);
    setErrorMessage(null);
    try {
      if (!apiKey) throw new Error("API key kosong. Klik ADD APIKEY dulu.");
      const out = await callGenerate(apiKey, promptTrending);
      const jsonText = pickJsonFromText(out) ?? out;
      const parsed = safeJsonParse<{ topic?: string }>(jsonText);
      const topic = parsed?.topic?.trim();
      if (!topic) throw new Error("Output topik tidak valid.");
      setProject((p) => ({ ...p, topic }));
    } catch (e: any) {
      setErrorMessage(e?.message || "Gagal mencari topik. Cek API key/koneksi.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!project.topic) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (!apiKey) throw new Error("API key kosong. Klik ADD APIKEY dulu.");
      const out = await callGenerate(apiKey, promptScript);
      const jsonText = pickJsonFromText(out) ?? out;
      const parsed = safeJsonParse<{ scenes?: any[] }>(jsonText);

      const scenes: Scene[] =
        (parsed?.scenes || [])
          .map((s: any) => ({
            id: String(s?.id || uid()),
            narrative: String(s?.narrative || "").trim(),
            imagePromptA: String(s?.imagePromptA || "").trim(),
            imagePromptB: String(s?.imagePromptB || "").trim(),
          }))
          .filter((s) => s.narrative && s.imagePromptA && s.imagePromptB);

      if (!scenes.length) throw new Error("JSON scenes kosong / tidak valid.");

      setProject((p) => ({ ...p, scenes }));
      setCurrentSceneIndex(0);
      setCurrentStep(1);
    } catch (e: any) {
      setErrorMessage(e?.message || "Gagal membuat skrip. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAsset = async () => {
    setErrorMessage("Fitur image/audio belum diaktifkan di versi Next ini. (Next: /api/image & /api/voice)");
  };

  const handleDownloadSingleImage = (base64Data: string | undefined, filename: string) => {
    if (!base64Data) return;
    const link = document.createElement("a");
    link.href = `data:image/jpeg;base64,${base64Data}`;
    link.download = `${filename}.jpg`;
    link.click();
  };

  const downloadAllAssets = async () => {
    setErrorMessage("ZIP aset belum diaktifkan di versi Next ini. (Next: JSZip + image/audio)");
  };

  const handleExport = async () => {
    setErrorMessage("Render video belum diaktifkan di versi Next ini. (Next: worker/server render)");
  };

  const getCurrentActiveImage = () => {
    if (currentVisualSlot === "A") return currentScene?.imageDataA || currentScene?.imageDataB;
    return currentScene?.imageDataB || currentScene?.imageDataA;
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

      <header className="h-16 border-b-4 border-black bg-comic-yellow sticky top-0 z-[100] flex items-center justify-between px-8 shadow-comic">
        <div className="flex items-center gap-3 cursor-pointer font-display text-black text-xl italic" onClick={() => setCurrentStep(0)}>
          <Compass size={24} className="p-1 bg-comic-pink border-2 border-black rounded shadow-comic" /> NUSANTARA DIORAMA AI
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKeyMenu(true)}
            className="bg-white border-4 border-black rounded-xl px-3 py-2 shadow-comic flex items-center gap-2 text-black font-black text-[10px] uppercase"
          >
            <KeyRound size={16} /> ADD APIKEY
          </button>
          <div className="text-[10px] font-black text-black uppercase tracking-tighter hidden sm:block">
            KEY AKTIF: #{activeKeyIndex + 1} {apiKey ? "✅" : "❌"}
          </div>
        </div>
      </header>

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
                  <div className="w-10 h-10 bg-comic-yellow border-4 border-black rounded-xl flex items-center justify-center font-display text-lg shadow-comic">{i + 1}</div>
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
              <button onClick={() => setShowKeyMenu(false)} className="px-6 py-3 bg-comic-yellow border-4 border-black rounded-2xl font-display text-sm uppercase shadow-comic">
                SIMPAN & TUTUP
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-x-hidden">
        {currentStep === 0 && (
          <div className="h-full flex items-center justify-center p-4 sm:p-8 animate-fadeIn">
            <div className="w-full max-w-xl bg-white border-4 border-black rounded-[2.5rem] p-6 sm:p-10 shadow-comic-lg space-y-8 tilt-right">
              <div className="text-center">
                <h1 className="text-4xl sm:text-5xl font-display text-black leading-tight uppercase">
                  BUAT <span className="text-comic-purple">DIORAMA</span> SEJARAH
                </h1>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="bg-comic-cyan border-2 border-black px-2 py-0.5 text-[10px] font-black text-black uppercase">1. Pilih Kategori</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "ERA_KOLONIAL", label: "Era Kolonial", icon: <Castle size={20} /> },
                      { id: "SEJARAH_PERJUANGAN", label: "Perjuangan", icon: <History size={20} /> },
                      { id: "LEGENDA_RAKYAT", label: "Legenda", icon: <Ghost size={20} /> },
                      { id: "BUDAYA_NUSANTARA", label: "Budaya", icon: <Map size={20} /> },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setProject({ ...project, style: t.id as VideoStyle })}
                        className={`flex items-center gap-2 sm:gap-4 p-3 sm:p-4 border-4 border-black font-display text-[10px] sm:text-xs uppercase transition-all ${
                          project.style === t.id ? `bg-comic-yellow text-black translate-y-1 shadow-none` : "bg-white text-black shadow-comic hover:-translate-y-1"
                        }`}
                      >
                        {t.icon}
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

                  <div onClick={() => fileInputRef.current?.click()} className="bg-slate-100 border-2 border-dashed border-black rounded-2xl flex items-center justify-center cursor-pointer shadow-inner overflow-hidden min-h-[60px]">
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
                    <button onClick={handlePickRandomTopic} disabled={isSearching} className="text-[10px] font-black text-comic-purple flex items-center gap-1 hover:scale-110 uppercase disabled:opacity-50">
                      {isSearching ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} fill="currentColor" />} CARI TOPIK
                    </button>
                  </div>
                  <textarea
                    value={project.topic}
                    onChange={(e) => setProject({ ...project, topic: e.target.value })}
                    className="w-full bg-slate-50 border-4 border-black rounded-2xl p-4 text-sm text-black font-bold h-24 shadow-inner focus:outline-none"
                    placeholder="Tulis kejadian sejarah, tokoh, atau legenda..."
                  />
                </div>
              </div>

              <button onClick={handleGenerateScript} disabled={isLoading || !project.topic} className="w-full py-6 bg-comic-yellow border-4 border-black rounded-3xl font-display text-2xl text-black shadow-comic hover:shadow-none transition-all active:scale-95 disabled:opacity-50">
                BANGUN DIORAMA!
              </button>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="p-4 sm:p-8 space-y-8 animate-fadeIn overflow-y-auto h-full custom-scrollbar pb-32">
            <div className="flex justify-between items-center bg-white border-4 border-black p-4 rounded-3xl shadow-comic sticky top-0 z-50">
              <button onClick={() => setCurrentStep(0)} className="bg-comic-pink p-2 border-4 border-black rounded shadow-comic">
                <ChevronLeft size={20} className="text-black" />
              </button>
              <h2 className="font-display text-black text-xl sm:text-2xl uppercase italic truncate px-2">{project.topic}</h2>
              <button onClick={() => { setCurrentStep(2); setShowCtaPreview(false); }} className="bg-comic-yellow px-4 sm:px-6 py-2 border-4 border-black rounded font-display text-[10px] sm:text-sm text-black shadow-comic uppercase">
                PREVIEW
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
              {project.scenes.map((s, idx) => (
                <div key={s.id} className={`bg-white border-4 border-black p-6 sm:p-8 rounded-[2.5rem] shadow-comic-lg flex flex-col gap-6 ${idx % 2 === 0 ? "tilt-left" : "tilt-right"}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-comic-pink border-4 border-black rounded-xl flex items-center justify-center font-display text-2xl text-black shadow-comic">#{idx + 1}</div>
                    </div>
                    <button onClick={handleGenerateAsset} className="px-4 py-2 border-4 border-black rounded-xl font-display text-[10px] text-black shadow-comic flex items-center gap-2 bg-comic-cyan">
                      <Mic size={12} /> GENERATE SUARA
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="aspect-[9/12] bg-black border-4 border-black rounded-2xl overflow-hidden relative shadow-inner">
                        <div className="h-full flex items-center justify-center opacity-10"><ImageIcon size={40} /></div>
                      </div>
                      <button onClick={handleGenerateAsset} className="w-full py-2 bg-comic-pink border-4 border-black rounded-xl font-display text-[9px] text-black shadow-comic uppercase">
                        A: Setup
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="aspect-[9/12] bg-black border-4 border-black rounded-2xl overflow-hidden relative shadow-inner">
                        <div className="h-full flex items-center justify-center opacity-10"><ImageIcon size={40} /></div>
                      </div>
                      <button onClick={handleGenerateAsset} className="w-full py-2 bg-comic-cyan border-4 border-black rounded-xl font-display text-[9px] text-black shadow-comic uppercase">
                        B: Klimaks
                      </button>
                    </div>
                  </div>

                  <div className="bg-white border-4 border-black p-4 rounded-2xl shadow-inner text-black font-bold text-xs italic leading-relaxed">"{s.narrative}"</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="h-full flex flex-col p-4 sm:p-6 animate-fadeIn halftone bg-slate-900 overflow-hidden">
            <div className="flex-1 flex items-center justify-center relative">
              <button onClick={() => setCurrentStep(1)} className="absolute top-4 left-4 bg-comic-pink p-3 border-4 border-black rounded shadow-comic z-50 text-black hover:scale-110 transition-all">
                <ChevronLeft />
              </button>

              <div className={`aspect-[${project.format === "SHORT" ? "9/16" : "16/9"}] w-full max-w-[min(100%,75vh*${project.format === "SHORT" ? "9/16" : "16/9"})] bg-black border-8 border-black rounded-[3rem] overflow-hidden shadow-comic-lg relative`}>
                {!showCtaPreview ? (
                  <>
                    <div className="w-full h-full flex items-center justify-center opacity-20"><ImageIcon size={64} /></div>
                    <div className="absolute bottom-12 left-0 w-full px-6">
                      <div className="bg-white border-4 border-black p-4 tilt-left shadow-comic text-black font-display text-sm italic">"{currentScene?.narrative}"</div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full bg-comic-yellow flex flex-col items-center justify-center p-10 text-center animate-fadeIn relative">
                    <Heart size={80} fill="#f472b6" className="text-black mb-6 animate-pulse" strokeWidth={3} />
                    <h2 className="text-4xl font-display text-black uppercase leading-tight">
                      GIMANA MENURUT KALIAN?<br /><span className="text-comic-pink text-5xl">FOLLOW YA!</span>
                    </h2>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white border-t-8 border-black p-4 sm:p-6 flex flex-col gap-4">
              <div className="flex justify-center gap-2 sm:gap-4 overflow-x-auto py-2">
                <button onClick={() => { setCurrentVisualSlot("A"); setShowCtaPreview(false); }} className={`px-4 sm:px-6 py-3 border-4 border-black rounded-xl font-display uppercase shadow-comic text-[10px] sm:text-xs ${currentVisualSlot === "A" && !showCtaPreview ? "bg-comic-pink text-black" : "bg-white text-black opacity-50"}`}>
                  Visual A
                </button>
                <button onClick={() => { setCurrentVisualSlot("B"); setShowCtaPreview(false); }} className={`px-4 sm:px-6 py-3 border-4 border-black rounded-xl font-display uppercase shadow-comic text-[10px] sm:text-xs ${currentVisualSlot === "B" && !showCtaPreview ? "bg-comic-cyan text-black" : "bg-white text-black opacity-50"}`}>
                  Visual B
                </button>
                <button onClick={() => setShowCtaPreview(true)} className={`px-4 sm:px-6 py-3 border-4 border-black rounded-xl font-display uppercase shadow-comic text-[10px] sm:text-xs ${showCtaPreview ? "bg-comic-yellow text-black" : "bg-white text-black opacity-50"}`}>
                  CTA Final
                </button>
              </div>

              <div className="flex gap-2 sm:gap-4 justify-center">
                <button onClick={downloadAllAssets} className="px-4 sm:px-6 py-4 bg-comic-cyan border-4 border-black rounded-2xl font-display text-[10px] sm:text-xs text-black shadow-comic uppercase">
                  SIMPAN SEMUA
                </button>
                <button onClick={handleExport} className="px-6 sm:px-10 py-4 bg-comic-yellow border-4 border-black rounded-2xl font-display text-lg sm:text-2xl text-black shadow-comic-lg flex items-center gap-3 uppercase">
                  <Video size={24} /> RENDER VIDEO
                </button>
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
