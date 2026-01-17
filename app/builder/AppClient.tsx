"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Settings,
  Image as ImageIcon,
  Mic,
  Play,
  Pause,
  Download,
  Film,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import type { Scene, VideoProject, VideoStyle, VideoFormat } from "./types";
import * as GeminiService from "./services/geminiService";
import {
  decode,
  decodeAudioData,
  getAudioContext,
  mergeAudioBuffers,
  audioBufferToWav,
} from "./utils/audioUtils";
import { renderFullProjectToVideo } from "./utils/videoUtils";
import JSZip from "jszip";

const STYLE_OPTIONS: { value: VideoStyle; label: string; desc: string }[] = [
  { value: "ERA_KOLONIAL", label: "Era Kolonial", desc: "VOC, Batavia, pelabuhan, intrik kolonial" },
  { value: "SEJARAH_PERJUANGAN", label: "Perjuangan", desc: "Gerilya, revolusi, heroik, tensi tinggi" },
  { value: "LEGENDA_RAKYAT", label: "Legenda", desc: "Mistis nusantara, folklore, aura magis" },
  { value: "BUDAYA_NUSANTARA", label: "Budaya", desc: "Ritual, tradisi, pasar, warisan budaya" },
];

const FORMAT_OPTIONS: { value: VideoFormat; label: string; desc: string }[] = [
  { value: "SHORT", label: "Short 9:16", desc: "Untuk TikTok/Reels/Shorts" },
  { value: "LONG", label: "Landscape 16:9", desc: "Untuk YouTube / layar lebar" },
];

function safeName(input: string) {
  return (input || "Diorama")
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .slice(0, 40);
}

function friendlyError(e: any) {
  const msg = String(e?.message || e || "");
  if (msg.includes("API_KEY_MISSING")) return "API key belum diisi. Buka Settings lalu tambahkan minimal 1 API key.";
  if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Quota exceeded") || msg.includes("429"))
    return "Kuota/rate limit Gemini sedang habis untuk key yang aktif. Coba isi beberapa key di Settings atau tunggu sebentar lalu coba lagi.";
  if (msg.includes("Failed to fetch")) return "Gagal koneksi ke Gemini. Cek internet atau coba lagi.";
  return msg || "Terjadi error.";
}

export default function AppClient() {
  const [project, setProject] = useState<VideoProject>({
    topic: "",
    style: "SEJARAH_PERJUANGAN",
    format: "SHORT",
    audience: "LOCAL",
    genre: "DRAMA",
    template: "VIRAL_DRAMA",
    scenes: [],
  });

  const [step, setStep] = useState<"setup" | "scenes" | "export">("setup");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);


  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<"A" | "B">("A");

  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null);
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedScene = project.scenes[selectedSceneIndex];

  const aspectRatio = useMemo(() => (project.format === "SHORT" ? "9:16" : "16:9"), [project.format]);

  useEffect(() => {
    return () => {
      audioSourcesRef.current.forEach((s) => {
        try {
          s.stop();
        } catch {}
      });
      audioSourcesRef.current = [];
    };
  }, []);

  function stopAllAudio() {
    audioSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    audioSourcesRef.current = [];
    setPlayingSceneId(null);
  }

  function togglePlay(sceneId: string, buffer: AudioBuffer) {
    if (playingSceneId === sceneId) {
      stopAllAudio();
      return;
    }
    stopAllAudio();

    const ctx = getAudioContext();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.onended = () => {
      setPlayingSceneId((prev) => (prev === sceneId ? null : prev));
      audioSourcesRef.current = audioSourcesRef.current.filter((x) => x !== src);
    };
    src.start();
    audioSourcesRef.current.push(src);
    setPlayingSceneId(sceneId);
  }

  async function pickTrendingTopic() {
    setBusy(true);
    setBusyLabel("Mencari topik trending…");
    setError(null);
    try {
      const t = await GeminiService.findTrendingTopic(project.style);
      setProject((p) => ({ ...p, topic: t }));
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function generateScript() {
    if (!project.topic.trim()) {
      setError("Topik belum diisi.");
      return;
    }
    setBusy(true);
    setBusyLabel("Menyusun 9 panel cerita…");
    setError(null);
    try {
      const res = await GeminiService.generateVideoScript(project);
      setProject((p) => ({ ...p, scenes: res.scenes }));
      setSelectedSceneIndex(0);
      setSelectedSlot("A");
      setStep("scenes");
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function generateAsset(sceneId: string, kind: "IMAGE_A" | "IMAGE_B" | "AUDIO") {
    setError(null);

    setProject((p) => ({
      ...p,
      scenes: p.scenes.map((s) =>
        s.id !== sceneId
          ? s
          : {
              ...s,
              isGeneratingImageA: kind === "IMAGE_A" ? true : s.isGeneratingImageA,
              isGeneratingImageB: kind === "IMAGE_B" ? true : s.isGeneratingImageB,
              isGeneratingAudio: kind === "AUDIO" ? true : s.isGeneratingAudio,
            }
      ),
    }));

    const scene = project.scenes.find((s) => s.id === sceneId);
    if (!scene) return;

    try {
      if (kind === "IMAGE_A" || kind === "IMAGE_B") {
        const slot = kind === "IMAGE_A" ? "A" : "B";
        const prompt = slot === "A" ? scene.imagePromptA : scene.imagePromptB;

        const img = await GeminiService.generateSceneImage(
          prompt,
          project.style,
          aspectRatio,
          project.referenceImage
        );

        setProject((p) => ({
          ...p,
          scenes: p.scenes.map((s) =>
            s.id !== sceneId
              ? s
              : {
                  ...s,
                  ...(slot === "A" ? { imageDataA: img, isGeneratingImageA: false } : {}),
                  ...(slot === "B" ? { imageDataB: img, isGeneratingImageB: false } : {}),
                }
          ),
        }));
      }

      if (kind === "AUDIO") {
        const raw = await GeminiService.generateVoiceover(scene.narrative);
        if (!raw) throw new Error("TTS gagal (audio kosong). Coba lagi atau ganti API key.");
        const buf = await decodeAudioData(decode(raw), getAudioContext());
        setProject((p) => ({
          ...p,
          scenes: p.scenes.map((s) =>
            s.id !== sceneId ? s : { ...s, audioRaw: raw, audioData: buf, isGeneratingAudio: false }
          ),
        }));
      }
    } catch (e: any) {
      setError(friendlyError(e));
      setProject((p) => ({
        ...p,
        scenes: p.scenes.map((s) =>
          s.id !== sceneId
            ? s
            : { ...s, isGeneratingImageA: false, isGeneratingImageB: false, isGeneratingAudio: false }
        ),
      }));
    }
  }

  async function downloadAllAssets() {
    setBusy(true);
    setBusyLabel("Mempaketkan ZIP…");
    setError(null);

    try {
      const zip = new JSZip();
      const folderName = `Wonderwal_${safeName(project.topic)}`;
      const folder = zip.folder(folderName);

      project.scenes.forEach((s, i) => {
        const n = i + 1;
        if (s.imageDataA) folder?.file(`Panel_${n}_A_Setup.jpg`, s.imageDataA, { base64: true });
        if (s.imageDataB) folder?.file(`Panel_${n}_B_Klimaks.jpg`, s.imageDataB, { base64: true });
      });

      const buffers = project.scenes.map((s) => s.audioData).filter(Boolean) as AudioBuffer[];
      if (buffers.length) {
        const merged = mergeAudioBuffers(buffers, getAudioContext());
        if (merged) folder?.file(`${folderName}_Full_Voiceover.wav`, audioBufferToWav(merged));
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${folderName}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function renderVideo() {
    setBusy(true);
    setBusyLabel("Render video…");
    setError(null);

    try {
      const blob = await renderFullProjectToVideo(project.scenes, project.format);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Wonderwal_${safeName(project.topic)}.${blob.type.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  function onUploadRefImage(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.split(",")[1] || "";
      setProject((p) => ({ ...p, referenceImage: base64 }));
    };
    reader.readAsDataURL(file);
  }

  const header = (
    <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0f17]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 ring-1 ring-white/10">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide text-white">Wonderwal Builder</div>
            <div className="text-xs text-white/60">Corporate dark • License system tetap aman</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
          >
            <Settings className="h-4 w-4" />
            Settings API Key
          </Link>
        </div>
      </div>
    </div>
  );

  const banner = error ? (
    <div className="mx-auto max-w-6xl px-5 pt-5">
      <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-red-200" />
        <div className="flex-1">
          <div className="font-semibold">Terjadi kendala</div>
          <div className="text-red-100/90">{error}</div>
          <div className="mt-2 text-xs text-red-100/70">
            Tips cepat: isi 2–5 API key di Settings untuk rotasi saat quota 429.
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-[#0b0f17] text-white">
      {header}
      {banner}

      <div className="mx-auto max-w-6xl px-5 py-8">
        {/* Top step pills */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStep("setup")}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              step === "setup"
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            1) Setup
          </button>
          <button
            onClick={() => setStep("scenes")}
            disabled={!project.scenes.length}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              step === "scenes" && project.scenes.length
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 bg-white/5 text-white/50"
            }`}
          >
            2) Scenes
          </button>
          <button
            onClick={() => setStep("export")}
            disabled={!project.scenes.length}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              step === "export" && project.scenes.length
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/10 bg-white/5 text-white/50"
            }`}
          >
            3) Export
          </button>

          {busy && (
            <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {busyLabel || "Working…"}
            </div>
          )}
        </div>

        {/* SETUP */}
        {step === "setup" && (
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 text-sm font-semibold text-white">Project</div>

                <label className="mb-2 block text-xs text-white/70">Topik</label>
                <div className="flex gap-2">
                  <input
                    value={project.topic}
                    onChange={(e) => setProject((p) => ({ ...p, topic: e.target.value }))}
                    placeholder="Contoh: 'Pertempuran Surabaya 1945' / 'VOC di Batavia' / 'Legenda Roro Jonggrang'"
                    className="w-full rounded-xl border border-white/10 bg-[#0f1522] px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
                  />
                  <button
                    disabled={busy || isSearching}
                    onClick={pickTrendingTopic}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white hover:bg-white/15 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${busy || isSearching ? "animate-spin" : ""}`} />
                    Trending
                  </button>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs text-white/70">Style</div>
                    <div className="grid gap-2">
                      {STYLE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setProject((p) => ({ ...p, style: opt.value }))}
                          className={`rounded-xl border px-4 py-3 text-left ${
                            project.style === opt.value
                              ? "border-white/20 bg-white/10"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div className="text-sm font-semibold">{opt.label}</div>
                          <div className="text-xs text-white/60">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs text-white/70">Format</div>
                    <div className="grid gap-2">
                      {FORMAT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setProject((p) => ({ ...p, format: opt.value }))}
                          className={`rounded-xl border px-4 py-3 text-left ${
                            project.format === opt.value
                              ? "border-white/20 bg-white/10"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div className="text-sm font-semibold">{opt.label}</div>
                          <div className="text-xs text-white/60">{opt.desc}</div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-[#0f1522] p-4">
                      <div className="mb-2 text-xs font-semibold text-white/80">Reference Image (opsional)</div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15"
                        >
                          <Upload className="h-4 w-4" />
                          Upload
                        </button>
                        <div className="text-xs text-white/60">
                          {project.referenceImage ? "Uploaded ✅" : "Tidak ada gambar referensi"}
                        </div>
                        {project.referenceImage && (
                          <button
                            onClick={() => setProject((p) => ({ ...p, referenceImage: undefined }))}
                            className="ml-auto text-xs text-white/60 hover:text-white"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onUploadRefImage(e.target.files?.[0] || null)}
                      />
                    </div>

                    <button
                      disabled={busy}
                      onClick={generateScript}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" />
                      Generate 9 Scenes
                    </button>

                    <div className="mt-3 text-xs text-white/50">
                      Catatan: Jika sering 429 quota, isi beberapa API key di Settings agar otomatis rotasi.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right panel: status */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-3 text-sm font-semibold text-white">Status</div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0f1522] p-3">
                    <CheckCircle2 className={`h-4 w-4 ${project.topic.trim() ? "text-emerald-400" : "text-white/20"}`} />
                    <div className="text-sm">
                      <div className="font-semibold">Topik</div>
                      <div className="text-xs text-white/60">
                        {project.topic.trim() ? "OK" : "Belum diisi"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0f1522] p-3">
                    <ImageIcon className="h-4 w-4 text-white/70" />
                    <div className="text-sm">
                      <div className="font-semibold">Format</div>
                      <div className="text-xs text-white/60">{aspectRatio}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0f1522] p-3">
                    <Settings className="h-4 w-4 text-white/70" />
                    <div className="text-sm">
                      <div className="font-semibold">API Key</div>
                      <div className="text-xs text-white/60">
                        Isi di <Link className="underline hover:text-white" href="/settings">/settings</Link>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#0f1522] p-3 text-xs text-white/60">
                    Sistem lisensi/device lock kamu tetap aman karena UI ini tidak mengubah auth. Ini hanya Builder.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCENES */}
        {step === "scenes" && (
          <div className="grid gap-5 lg:grid-cols-12">
            {/* left list */}
            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">Scenes</div>
                  <button
                    onClick={() => {
                      stopAllAudio();
                      setStep("setup");
                    }}
                    className="text-xs text-white/60 hover:text-white"
                  >
                    Edit Setup
                  </button>
                </div>

                <div className="space-y-2">
                  {project.scenes.map((s, idx) => {
                    const doneImg = Boolean(s.imageDataA || s.imageDataB);
                    const doneAudio = Boolean(s.audioData);
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedSceneIndex(idx);
                          setSelectedSlot("A");
                        }}
                        className={`w-full rounded-xl border px-3 py-3 text-left ${
                          idx === selectedSceneIndex
                            ? "border-white/20 bg-white/10"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">Panel {idx + 1}</div>
                          <div className="flex items-center gap-2 text-[11px] text-white/60">
                            <span className={doneImg ? "text-emerald-400" : "text-white/30"}>IMG</span>
                            <span className={doneAudio ? "text-emerald-400" : "text-white/30"}>AUDIO</span>
                          </div>
                        </div>
                        <div className="mt-1 line-clamp-2 text-xs text-white/60">
                          {s.narrative}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setStep("export")}
                    disabled={!project.scenes.length}
                    className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
                  >
                    Export
                  </button>
                  <button
                    onClick={() => {
                      stopAllAudio();
                      setProject((p) => ({ ...p, scenes: [] }));
                      setStep("setup");
                    }}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* right detail */}
            <div className="lg:col-span-8">
              {!selectedScene ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
                  Pilih scene di kiri.
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Panel {selectedSceneIndex + 1}</div>
                      <div className="text-xs text-white/60">Generate image + audio per panel</div>
                    </div>

                    {selectedScene.audioData && (
                      <button
                        onClick={() => togglePlay(selectedScene.id, selectedScene.audioData!)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
                      >
                        {playingSceneId === selectedScene.id ? (
                          <>
                            <Pause className="h-4 w-4" /> Stop
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" /> Play
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    {/* prompt + actions */}
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-[#0f1522] p-4">
                        <div className="mb-2 text-xs font-semibold text-white/80">Narrative</div>
                        <div className="text-sm text-white/80">{selectedScene.narrative}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => generateAsset(selectedScene.id, "IMAGE_A")}
                          disabled={busy || selectedScene.isGeneratingImageA}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-60"
                        >
                          {selectedScene.isGeneratingImageA ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ImageIcon className="h-4 w-4" />
                          )}
                          Image A
                        </button>

                        <button
                          onClick={() => generateAsset(selectedScene.id, "IMAGE_B")}
                          disabled={busy || selectedScene.isGeneratingImageB}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-60"
                        >
                          {selectedScene.isGeneratingImageB ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ImageIcon className="h-4 w-4" />
                          )}
                          Image B
                        </button>

                        <button
                          onClick={() => generateAsset(selectedScene.id, "AUDIO")}
                          disabled={busy || selectedScene.isGeneratingAudio}
                          className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
                        >
                          {selectedScene.isGeneratingAudio ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Mic className="h-4 w-4" />
                          )}
                          Generate Voiceover
                        </button>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#0f1522] p-4">
                        <div className="mb-2 text-xs font-semibold text-white/80">Prompts</div>
                        <div className="space-y-2 text-xs text-white/60">
                          <div>
                            <div className="font-semibold text-white/70">A</div>
                            <div className="line-clamp-3">{selectedScene.imagePromptA}</div>
                          </div>
                          <div>
                            <div className="font-semibold text-white/70">B</div>
                            <div className="line-clamp-3">{selectedScene.imagePromptB}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* preview */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedSlot("A")}
                          className={`rounded-full border px-3 py-1.5 text-xs ${
                            selectedSlot === "A"
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          Preview A
                        </button>
                        <button
                          onClick={() => setSelectedSlot("B")}
                          className={`rounded-full border px-3 py-1.5 text-xs ${
                            selectedSlot === "B"
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          Preview B
                        </button>
                      </div>

                      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0f1522]">
                        <div className="aspect-[9/16] w-full lg:aspect-[16/10]">
                          {/* preview image */}
                          {(() => {
                            const img =
                              selectedSlot === "A"
                                ? selectedScene.imageDataA || selectedScene.imageDataB
                                : selectedScene.imageDataB || selectedScene.imageDataA;

                            if (!img) {
                              return (
                                <div className="flex h-full items-center justify-center text-sm text-white/50">
                                  Belum ada gambar.
                                </div>
                              );
                            }

                            return (
                              <img
                                src={`data:image/jpeg;base64,${img}`}
                                alt="preview"
                                className="h-full w-full object-cover"
                              />
                            );
                          })()}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={downloadAllAssets}
                          disabled={busy}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-60"
                        >
                          <Download className="h-4 w-4" />
                          ZIP
                        </button>
                        <button
                          onClick={() => setStep("export")}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90"
                        >
                          <Film className="h-4 w-4" />
                          Export
                        </button>
                      </div>

                      <div className="text-xs text-white/50">
                        Tip: generate minimal 1 image + 1 audio per panel untuk hasil video terbaik.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* EXPORT */}
        {step === "export" && (
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 text-sm font-semibold">Export</div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={downloadAllAssets}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white hover:bg-white/15 disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    Download Assets (ZIP)
                  </button>

                  <button
                    onClick={renderVideo}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
                  >
                    <Film className="h-4 w-4" />
                    Render Video
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-[#0f1522] p-4 text-xs text-white/60">
                  Video akan berisi transisi A→B per scene, caption berjalan, dan CTA akhir. Output bisa mp4 atau webm tergantung browser.
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => setStep("scenes")}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                  >
                    Kembali ke Scenes
                  </button>
                  <button
                    onClick={() => setStep("setup")}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                  >
                    Setup Baru
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-3 text-sm font-semibold">Ringkasan</div>

                <div className="space-y-3 text-sm">
                  <div className="rounded-xl border border-white/10 bg-[#0f1522] p-3">
                    <div className="text-xs text-white/60">Topik</div>
                    <div className="font-semibold">{project.topic || "-"}</div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#0f1522] p-3">
                    <div className="text-xs text-white/60">Style</div>
                    <div className="font-semibold">
                      {STYLE_OPTIONS.find((s) => s.value === project.style)?.label || project.style}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#0f1522] p-3">
                    <div className="text-xs text-white/60">Format</div>
                    <div className="font-semibold">{project.format} ({aspectRatio})</div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-[#0f1522] p-3">
                    <div className="text-xs text-white/60">Scenes</div>
                    <div className="font-semibold">{project.scenes.length}</div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-white/50">
                  Pastikan API key di Settings sudah diisi 2–5 untuk rotasi saat quota.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-6xl px-5 text-xs text-white/40">
          Wonderwal • Corporate dark builder UI • Lisensi/device lock tidak diubah
        </div>
      </div>
    </div>
  );
}
