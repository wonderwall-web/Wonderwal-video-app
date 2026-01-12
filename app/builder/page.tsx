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
  KeyRound,
  CheckCircle,
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
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickJsonFromText(text: string): string | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
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

  // 🔑 API KEY MANAGER (5 slot)
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingIntervalRef = useRef<number | null>(null);

  // Load keys
  useEffect(() => {
    const saved = localStorage.getItem("NUDIORAMA_KEYS");
    const active = localStorage.getItem("NUDIORAMA_ACTIVE");
    if (saved) setApiKeys(JSON.parse(saved));
    if (active) setActiveKeyIndex(Number(active));
  }, []);

  // Save keys
  useEffect(() => {
    localStorage.setItem("NUDIORAMA_KEYS", JSON.stringify(apiKeys));
    localStorage.setItem("NUDIORAMA_ACTIVE", String(activeKeyIndex));
  }, [apiKeys, activeKeyIndex]);

  useEffect(() => {
    if (isLoading) {
      let i = 0;
      loadingIntervalRef.current = window.setInterval(() => {
        i = (i + 1) % LOADING_MESSAGES.length;
        setLoadingMsg(LOADING_MESSAGES[i]);
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
      "Output JSON valid saja.",
      '{ "topic": "string" }',
      `Buat 1 topik menarik kategori: ${project.style}.`,
    ].join("\n");
  }, [project.style]);

  const promptScript = useMemo(() => {
    const count = project.format === "SHORT" ? 9 : 18;
    return [
      "Output JSON valid saja.",
      "{ scenes: [ { id, narrative, imagePromptA, imagePromptB } ] }",
      `Topik: ${project.topic}`,
      `Jumlah scene: ${count}`,
      "Gaya visual: miniature diorama, cinematic, macro, tilt-shift",
    ].join("\n");
  }, [project.topic, project.format]);

  async function callGenerate(prompt: string) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ apiKey, key: apiKey, prompt }),
    });

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Generate gagal");
    return data.output;
  }

  const handlePickRandomTopic = async () => {
    setIsSearching(true);
    try {
      const out = await callGenerate(promptTrending);
      setRawOutput(out);
      const json = pickJsonFromText(out) ?? out;
      const parsed = safeJsonParse<{ topic: string }>(json);
      if (parsed?.topic) setProject(p => ({ ...p, topic: parsed.topic }));
    } catch {
      setErrorMessage("Gagal cari topik");
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateScript = async () => {
    setIsLoading(true);
    try {
      const out = await callGenerate(promptScript);
      setRawOutput(out);
      const json = pickJsonFromText(out) ?? out;
      const parsed = safeJsonParse<ScriptResult>(json);

      const scenes =
        parsed?.scenes?.map(s => ({
          id: s.id || uid(),
          narrative: s.narrative,
          imagePromptA: s.imagePromptA,
          imagePromptB: s.imagePromptB,
        })) || [];

      if (!scenes.length) throw new Error();
      setProject(p => ({ ...p, scenes }));
      setCurrentStep(1);
    } catch {
      setErrorMessage("Gagal generate script");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-comic-dark text-white p-6">
      <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
        <Compass /> Builder
      </h1>

      {/* 🔑 API KEY MANAGER */}
      <div className="bg-white text-black p-4 rounded-xl border-4 border-black mb-6">
        <h2 className="font-bold flex items-center gap-2 mb-2">
          <KeyRound size={18} /> API Key Manager (5 Slot)
        </h2>

        <div className="space-y-2">
          {apiKeys.map((k, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={k}
                onChange={(e) => {
                  const copy = [...apiKeys];
                  copy[i] = e.target.value;
                  setApiKeys(copy);
                }}
                placeholder={`API Key #${i + 1}`}
                className="flex-1 border-2 border-black rounded px-3 py-1 text-sm"
              />
              <button
                onClick={() => setActiveKeyIndex(i)}
                className={`px-3 py-1 border-2 border-black rounded ${
                  activeKeyIndex === i ? "bg-green-300" : "bg-gray-100"
                }`}
              >
                {activeKeyIndex === i ? <CheckCircle size={16}/> : "Pakai"}
              </button>
            </div>
          ))}
        </div>

        <div className="text-xs mt-2 text-gray-600">
          Aktif: API Key #{activeKeyIndex + 1}
        </div>
      </div>

      {/* UI Utama */}
      <div className="bg-white text-black p-6 rounded-xl border-4 border-black">
        <textarea
          value={project.topic}
          onChange={e => setProject({ ...project, topic: e.target.value })}
          placeholder="Tulis topik kisah..."
          className="w-full border-2 border-black rounded p-3 mb-4"
        />

        <div className="flex gap-3">
          <button onClick={handlePickRandomTopic} className="px-4 py-2 bg-yellow-300 border-2 border-black rounded">
            {isSearching ? "..." : "Cari Topik"}
          </button>

          <button onClick={handleGenerateScript} className="px-4 py-2 bg-green-300 border-2 border-black rounded">
            Generate
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 bg-red-200 border-2 border-black p-3 rounded">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
