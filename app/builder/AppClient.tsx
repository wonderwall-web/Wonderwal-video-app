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
    return "Kuota/rate limit Gemini habis pada API key yang aktif. Isi 2–5 API key di Settings agar rotasi, atau gunakan key dari project yang kuotanya aktif.";
  if (msg.includes("Failed to fetch")) return "Gagal koneksi. Cek internet atau coba lagi.";
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
    setIsSearching(true);
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
      setIsSearching(false);
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

  const readyScenes = project.scenes.length > 0;

  return (
    <div className="ww">
      <style jsx global>{`
        :root {
          color-scheme: dark;
        }
        body {
          margin: 0;
          background: #0b0f17;
          color: #e9eef9;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji",
            "Segoe UI Emoji";
        }
        a {
          color: inherit;
          text-decoration: none;
        }
        .ww * {
          box-sizing: border-box;
        }
      `}</style>

      <style jsx>{`
        .ww {
          min-height: 100vh;
          background: radial-gradient(1200px 600px at 20% -10%, rgba(120, 90, 255, 0.25), transparent 60%),
            radial-gradient(900px 500px at 85% 0%, rgba(0, 200, 255, 0.14), transparent 55%),
            linear-gradient(180deg, #0b0f17, #070a10);
        }

        .topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          backdrop-filter: blur(10px);
          background: rgba(11, 15, 23, 0.65);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .topbarInner {
          max-width: 1180px;
          margin: 0 auto;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 240px;
        }
        .logo {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.10);
          display: grid;
          place-items: center;
        }
        .brandText {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
        }
        .brandName {
          font-weight: 700;
          letter-spacing: 0.2px;
          font-size: 14px;
        }
        .brandSub {
          font-size: 12px;
          color: rgba(233, 238, 249, 0.65);
          margin-top: 2px;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn {
          height: 38px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(233, 238, 249, 0.92);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: 120ms ease;
          font-size: 13px;
          font-weight: 600;
        }
        .btn:hover {
          background: rgba(255, 255, 255, 0.10);
          transform: translateY(-1px);
        }
        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .btnPrimary {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.82));
          color: #0b0f17;
          border: 1px solid rgba(255, 255, 255, 0.18);
        }
        .btnPrimary:hover {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.86));
        }

        .chip {
          height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.05);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: rgba(233, 238, 249, 0.80);
        }

        .shell {
          max-width: 1180px;
          margin: 0 auto;
          padding: 18px;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 14px;
        }

        .sidebar {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          min-height: calc(100vh - 92px);
        }

        .sideHeader {
          padding: 14px 14px 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .sideTitle {
          font-size: 13px;
          font-weight: 700;
          margin: 0;
        }
        .sideHint {
          font-size: 12px;
          color: rgba(233, 238, 249, 0.60);
          margin-top: 6px;
        }

        .nav {
          padding: 10px;
          display: grid;
          gap: 8px;
        }
        .navBtn {
          height: 40px;
          border-radius: 12px;
          padding: 0 12px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.03);
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: 120ms ease;
        }
        .navBtn:hover {
          background: rgba(255, 255, 255, 0.07);
        }
        .navBtnActive {
          background: rgba(255, 255, 255, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.16);
        }
        .navLeft {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: rgba(233, 238, 249, 0.92);
          font-size: 13px;
          font-weight: 650;
        }
        .navRight {
          font-size: 12px;
          color: rgba(233, 238, 249, 0.55);
        }

        .main {
          display: grid;
          gap: 14px;
        }

        .banner {
          border-radius: 16px;
          border: 1px solid rgba(255, 80, 80, 0.25);
          background: rgba(255, 80, 80, 0.10);
          padding: 12px 14px;
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        .bannerTitle {
          font-weight: 750;
          font-size: 13px;
        }
        .bannerMsg {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(255, 220, 220, 0.92);
          line-height: 1.35;
        }
        .bannerTip {
          margin-top: 8px;
          font-size: 11px;
          color: rgba(255, 220, 220, 0.75);
        }

        .card {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }

        .cardHeader {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .cardTitle {
          font-size: 13px;
          font-weight: 800;
          color: rgba(233, 238, 249, 0.92);
        }
        .cardBody {
          padding: 16px;
        }

        .row {
          display: grid;
          gap: 10px;
        }

        .label {
          font-size: 12px;
          color: rgba(233, 238, 249, 0.70);
          margin-bottom: 6px;
        }

        .inputRow {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .input {
          width: 100%;
          height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(15, 21, 34, 0.86);
          color: rgba(233, 238, 249, 0.92);
          padding: 0 12px;
          outline: none;
          font-size: 13px;
        }
        .input::placeholder {
          color: rgba(233, 238, 249, 0.35);
        }
        .input:focus {
          border-color: rgba(255, 255, 255, 0.18);
        }

        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .selectTile {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.03);
          padding: 12px;
          cursor: pointer;
          transition: 120ms ease;
        }
        .selectTile:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .selectTileActive {
          background: rgba(255, 255, 255, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.16);
        }
        .tileTitle {
          font-weight: 800;
          font-size: 13px;
        }
        .tileDesc {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(233, 238, 249, 0.62);
          line-height: 1.35;
        }

        .muted {
          font-size: 12px;
          color: rgba(233, 238, 249, 0.55);
          line-height: 1.4;
        }

        .sceneLayout {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 14px;
        }

        .sceneList {
          padding: 10px;
          display: grid;
          gap: 8px;
        }
        .sceneItem {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.03);
          padding: 12px;
          cursor: pointer;
          transition: 120ms ease;
        }
        .sceneItem:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .sceneItemActive {
          background: rgba(255, 255, 255, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.16);
        }
        .sceneTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .sceneName {
          font-weight: 850;
          font-size: 13px;
        }
        .badges {
          display: inline-flex;
          gap: 8px;
          font-size: 11px;
          color: rgba(233, 238, 249, 0.60);
        }
        .badgeOk {
          color: rgba(120, 255, 175, 0.9);
        }
        .badgeNo {
          color: rgba(233, 238, 249, 0.35);
        }
        .sceneSnippet {
          margin-top: 8px;
          font-size: 12px;
          color: rgba(233, 238, 249, 0.60);
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .detailTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .previewWrap {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(15, 21, 34, 0.86);
          overflow: hidden;
          display: grid;
        }
        .previewInner {
          width: 100%;
          aspect-ratio: 16/10;
          display: grid;
          place-items: center;
          color: rgba(233, 238, 249, 0.55);
          font-size: 13px;
        }
        .previewImg {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .segRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .seg {
          height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(233, 238, 249, 0.85);
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          transition: 120ms ease;
        }
        .seg:hover {
          background: rgba(255, 255, 255, 0.08);
        }
        .segActive {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.16);
        }

        .footer {
          padding: 20px 18px;
          text-align: center;
          color: rgba(233, 238, 249, 0.35);
          font-size: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 18px;
        }

        @media (max-width: 1000px) {
          .shell {
            grid-template-columns: 1fr;
          }
          .sidebar {
            min-height: auto;
          }
          .sceneLayout {
            grid-template-columns: 1fr;
          }
          .previewInner {
            aspect-ratio: 16/11;
          }
        }
      `}</style>

      {/* Topbar */}
      <div className="topbar">
        <div className="topbarInner">
          <div className="brand">
            <div className="logo">
              <Sparkles size={18} />
            </div>
            <div className="brandText">
              <div className="brandName">Wonderwal Builder</div>
              <div className="brandSub">Dark • clean dashboard • no Tailwind</div>
            </div>
          </div>

          <div className="actions">
            {busy && (
              <div className="chip">
                <Loader2 size={14} className="spin" />
                {busyLabel || "Working…"}
              </div>
            )}
            <Link className="btn" href="/settings">
              <Settings size={16} />
              Settings API Key
            </Link>
          </div>
        </div>
      </div>

      <div className="shell">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sideHeader">
            <p className="sideTitle">Menu</p>
            <div className="sideHint">Workflow cepat: Setup → Scenes → Export</div>
          </div>

          <div className="nav">
            <button
              className={`navBtn ${step === "setup" ? "navBtnActive" : ""}`}
              onClick={() => setStep("setup")}
            >
              <div className="navLeft">
                <CheckCircle2 size={16} />
                Setup
              </div>
              <div className="navRight">1</div>
            </button>

            <button
              className={`navBtn ${step === "scenes" ? "navBtnActive" : ""}`}
              onClick={() => setStep("scenes")}
              disabled={!readyScenes}
              style={!readyScenes ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
            >
              <div className="navLeft">
                <ImageIcon size={16} />
                Scenes
              </div>
              <div className="navRight">2</div>
            </button>

            <button
              className={`navBtn ${step === "export" ? "navBtnActive" : ""}`}
              onClick={() => setStep("export")}
              disabled={!readyScenes}
              style={!readyScenes ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
            >
              <div className="navLeft">
                <Film size={16} />
                Export
              </div>
              <div className="navRight">3</div>
            </button>
          </div>

          <div style={{ padding: 12 }}>
            <div className="card" style={{ background: "rgba(15,21,34,0.55)" }}>
              <div className="cardHeader">
                <div className="cardTitle">Ringkasan</div>
              </div>
              <div className="cardBody">
                <div className="muted">Topik</div>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>{project.topic || "-"}</div>

                <div className="muted">Format</div>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>
                  {project.format} ({aspectRatio})
                </div>

                <div className="muted">Scenes</div>
                <div style={{ fontWeight: 800 }}>{project.scenes.length}</div>

                <div style={{ height: 10 }} />

                <div className="muted">
                  Catatan: Kalau error quota “limit 0”, itu berarti API key kamu memang tidak punya kuota.
                  Rotasi 5 key hanya membantu kalau key-key tersebut berasal dari project yang kuotanya aktif.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="main">
          {error && (
            <div className="banner">
              <AlertTriangle size={18} />
              <div>
                <div className="bannerTitle">Terjadi kendala</div>
                <div className="bannerMsg">{error}</div>
                <div className="bannerTip">
                  Tips: isi 2–5 API key di <b>/settings</b> untuk rotasi. Kalau masih “limit 0”, ganti key dari project yang kuotanya aktif.
                </div>
              </div>
            </div>
          )}

          {/* SETUP */}
          {step === "setup" && (
            <div className="card">
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Project Setup</div>
                  <div className="muted">Isi topik, pilih style & format, lalu generate 9 scenes.</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" onClick={pickTrendingTopic} disabled={busy || isSearching}>
                    <RefreshCw size={16} />
                    Trending
                  </button>
                  <button className="btn btnPrimary" onClick={generateScript} disabled={busy}>
                    <Sparkles size={16} />
                    Generate 9 Scenes
                  </button>
                </div>
              </div>

              <div className="cardBody">
                <div className="row">
                  <div>
                    <div className="label">Topik</div>
                    <div className="inputRow">
                      <input
                        className="input"
                        value={project.topic}
                        onChange={(e) => setProject((p) => ({ ...p, topic: e.target.value }))}
                        placeholder="Contoh: Pertempuran Surabaya 1945 / VOC di Batavia / Legenda Roro Jonggrang"
                      />
                    </div>
                    <div style={{ marginTop: 8 }} className="muted">
                      Kalau trending gagal: itu biasanya karena quota API key (buka Settings).
                    </div>
                  </div>

                  <div className="grid2">
                    <div>
                      <div className="label">Style</div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {STYLE_OPTIONS.map((opt) => (
                          <div
                            key={opt.value}
                            className={`selectTile ${project.style === opt.value ? "selectTileActive" : ""}`}
                            onClick={() => setProject((p) => ({ ...p, style: opt.value }))}
                            role="button"
                          >
                            <div className="tileTitle">{opt.label}</div>
                            <div className="tileDesc">{opt.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="label">Format</div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {FORMAT_OPTIONS.map((opt) => (
                          <div
                            key={opt.value}
                            className={`selectTile ${project.format === opt.value ? "selectTileActive" : ""}`}
                            onClick={() => setProject((p) => ({ ...p, format: opt.value }))}
                            role="button"
                          >
                            <div className="tileTitle">{opt.label}</div>
                            <div className="tileDesc">{opt.desc}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ height: 12 }} />

                      <div className="label">Reference Image (opsional)</div>
                      <div className="inputRow">
                        <button className="btn" onClick={() => fileInputRef.current?.click()}>
                          <Upload size={16} />
                          Upload
                        </button>
                        <div className="muted">
                          {project.referenceImage ? "Uploaded ✅" : "Tidak ada gambar referensi"}
                        </div>
                        {project.referenceImage && (
                          <button
                            className="btn"
                            onClick={() => setProject((p) => ({ ...p, referenceImage: undefined }))}
                          >
                            Remove
                          </button>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => onUploadRefImage(e.target.files?.[0] || null)}
                        />
                      </div>

                      <div style={{ height: 10 }} />
                      <div className="muted">
                        API key: isi di{" "}
                        <Link href="/settings" style={{ textDecoration: "underline" }}>
                          /settings
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCENES */}
          {step === "scenes" && (
            <div className="card">
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Scenes</div>
                  <div className="muted">Generate image A/B dan voiceover untuk tiap panel.</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" onClick={() => setStep("setup")}>
                    Kembali Setup
                  </button>
                  <button className="btn btnPrimary" onClick={() => setStep("export")} disabled={!readyScenes}>
                    Export
                  </button>
                </div>
              </div>

              <div className="cardBody">
                <div className="sceneLayout">
                  <div className="card" style={{ background: "rgba(15,21,34,0.55)" }}>
                    <div className="cardHeader">
                      <div className="cardTitle">Daftar Panel</div>
                      <div className="muted">{project.scenes.length} scenes</div>
                    </div>
                    <div className="sceneList">
                      {project.scenes.map((s, idx) => {
                        const doneImg = Boolean(s.imageDataA || s.imageDataB);
                        const doneAudio = Boolean(s.audioData);
                        return (
                          <div
                            key={s.id}
                            className={`sceneItem ${idx === selectedSceneIndex ? "sceneItemActive" : ""}`}
                            onClick={() => {
                              setSelectedSceneIndex(idx);
                              setSelectedSlot("A");
                            }}
                            role="button"
                          >
                            <div className="sceneTop">
                              <div className="sceneName">Panel {idx + 1}</div>
                              <div className="badges">
                                <span className={doneImg ? "badgeOk" : "badgeNo"}>IMG</span>
                                <span className={doneAudio ? "badgeOk" : "badgeNo"}>AUDIO</span>
                              </div>
                            </div>
                            <div className="sceneSnippet">{s.narrative}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    {!selectedScene ? (
                      <div className="muted">Pilih scene dari daftar.</div>
                    ) : (
                      <>
                        <div className="detailTop">
                          <div>
                            <div style={{ fontWeight: 900 }}>Panel {selectedSceneIndex + 1}</div>
                            <div className="muted">Slot A = setup, Slot B = klimaks</div>
                          </div>

                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {selectedScene.audioData && (
                              <button className="btn" onClick={() => togglePlay(selectedScene.id, selectedScene.audioData!)}>
                                {playingSceneId === selectedScene.id ? <Pause size={16} /> : <Play size={16} />}
                                {playingSceneId === selectedScene.id ? "Stop" : "Play"}
                              </button>
                            )}

                            <button className="btn" onClick={downloadAllAssets} disabled={busy}>
                              <Download size={16} />
                              ZIP
                            </button>

                            <button className="btn btnPrimary" onClick={() => setStep("export")} disabled={!readyScenes}>
                              <Film size={16} />
                              Export
                            </button>
                          </div>
                        </div>

                        <div className="grid2">
                          <div>
                            <div className="card" style={{ background: "rgba(15,21,34,0.55)" }}>
                              <div className="cardHeader">
                                <div className="cardTitle">Actions</div>
                                <div className="muted">Generate per panel</div>
                              </div>
                              <div className="cardBody">
                                <div style={{ display: "grid", gap: 10 }}>
                                  <button
                                    className="btn"
                                    onClick={() => generateAsset(selectedScene.id, "IMAGE_A")}
                                    disabled={busy || selectedScene.isGeneratingImageA}
                                  >
                                    {selectedScene.isGeneratingImageA ? <Loader2 size={16} className="spin" /> : <ImageIcon size={16} />}
                                    Image A
                                  </button>

                                  <button
                                    className="btn"
                                    onClick={() => generateAsset(selectedScene.id, "IMAGE_B")}
                                    disabled={busy || selectedScene.isGeneratingImageB}
                                  >
                                    {selectedScene.isGeneratingImageB ? <Loader2 size={16} className="spin" /> : <ImageIcon size={16} />}
                                    Image B
                                  </button>

                                  <button
                                    className="btn btnPrimary"
                                    onClick={() => generateAsset(selectedScene.id, "AUDIO")}
                                    disabled={busy || selectedScene.isGeneratingAudio}
                                  >
                                    {selectedScene.isGeneratingAudio ? <Loader2 size={16} className="spin" /> : <Mic size={16} />}
                                    Generate Voiceover
                                  </button>
                                </div>

                                <div style={{ height: 12 }} />

                                <div className="muted" style={{ fontWeight: 800, marginBottom: 6 }}>
                                  Narrative
                                </div>
                                <div className="muted">{selectedScene.narrative}</div>

                                <div style={{ height: 12 }} />

                                <div className="muted" style={{ fontWeight: 800, marginBottom: 6 }}>
                                  Prompts (ringkas)
                                </div>
                                <div className="muted">
                                  <b>A:</b> {selectedScene.imagePromptA}
                                </div>
                                <div style={{ height: 8 }} />
                                <div className="muted">
                                  <b>B:</b> {selectedScene.imagePromptB}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="segRow">
                              <button
                                className={`seg ${selectedSlot === "A" ? "segActive" : ""}`}
                                onClick={() => setSelectedSlot("A")}
                              >
                                Preview A
                              </button>
                              <button
                                className={`seg ${selectedSlot === "B" ? "segActive" : ""}`}
                                onClick={() => setSelectedSlot("B")}
                              >
                                Preview B
                              </button>
                            </div>

                            <div className="previewWrap">
                              <div className="previewInner">
                                {(() => {
                                  const img =
                                    selectedSlot === "A"
                                      ? selectedScene.imageDataA || selectedScene.imageDataB
                                      : selectedScene.imageDataB || selectedScene.imageDataA;

                                  if (!img) return <div>Belum ada gambar.</div>;
                                  return <img className="previewImg" src={`data:image/jpeg;base64,${img}`} alt="preview" />;
                                })()}
                              </div>
                            </div>

                            <div style={{ height: 10 }} />
                            <div className="muted">
                              Tip: generate minimal 1 gambar + 1 audio per panel untuk hasil video paling oke.
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EXPORT */}
          {step === "export" && (
            <div className="card">
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Export</div>
                  <div className="muted">Download assets atau render video.</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" onClick={() => setStep("scenes")} disabled={!readyScenes}>
                    Kembali
                  </button>
                </div>
              </div>

              <div className="cardBody">
                <div className="grid2">
                  <div className="card" style={{ background: "rgba(15,21,34,0.55)" }}>
                    <div className="cardHeader">
                      <div className="cardTitle">Assets</div>
                      <div className="muted">ZIP</div>
                    </div>
                    <div className="cardBody">
                      <button className="btn" onClick={downloadAllAssets} disabled={busy}>
                        <Download size={16} />
                        Download ZIP
                      </button>
                      <div style={{ height: 10 }} />
                      <div className="muted">
                        ZIP berisi image A/B per panel + voiceover wav (gabungan).
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ background: "rgba(15,21,34,0.55)" }}>
                    <div className="cardHeader">
                      <div className="cardTitle">Video</div>
                      <div className="muted">Render</div>
                    </div>
                    <div className="cardBody">
                      <button className="btn btnPrimary" onClick={renderVideo} disabled={busy}>
                        <Film size={16} />
                        Render Video
                      </button>
                      <div style={{ height: 10 }} />
                      <div className="muted">
                        Output bisa mp4/webm tergantung browser. Kalau gagal, coba Chrome.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ height: 12 }} />
                <div className="muted">
                  Lisensi/device lock tetap aman — halaman ini tidak menyentuh auth.
                </div>
              </div>
            </div>
          )}

          <div className="footer">
            Wonderwal • clean dashboard UI • tanpa Tailwind • lisensi tidak disentuh
          </div>
        </div>
      </div>

      <style jsx>{`
        .spin {
          animation: spin 900ms linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
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
    return "Kuota/rate limit Gemini habis pada API key yang aktif. Isi 2–5 API key di Settings agar rotasi, atau gunakan key dari project yang kuotanya aktif.";
  if (msg.includes("Failed to fetch")) return "Gagal koneksi. Cek internet atau coba lagi.";
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
    setIsSearching(true);
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
      setIsSearching(false);
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

  const readyScenes = project.scenes.length > 0;

  return (
    <div className="ww">
      <style jsx global>{`
        :root {
          color-scheme: dark;
        }
        body {
          margin: 0;
          background: #0b0f17;
          color: #e9eef9;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji",
            "Segoe UI Emoji";
        }
        a {
          color: inherit;
          text-decoration: none;
        }
        .ww * {
          box-sizing: border-box;
        }
      `}</style>

      <style jsx>{`
        .ww {
          min-height: 100vh;
          background: radial-gradient(1200px 600px at 20% -10%, rgba(120, 90, 255, 0.25), transparent 60%),
            radial-gradient(900px 500px at 85% 0%, rgba(0, 200, 255, 0.14), transparent 55%),
            linear-gradient(180deg, #0b0f17, #070a10);
        }

        .topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          backdrop-filter: blur(10px);
          background: rgba(11, 15, 23, 0.65);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .topbarInner {
          max-width: 1180px;
          margin: 0 auto;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 240px;
        }
        .logo {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.10);
          display: grid;
          place-items: center;
        }
        .brandText {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
        }
        .brandName {
          font-weight: 700;
          letter-spacing: 0.2px;
          font-size: 14px;
        }
        .brandSub {
          font-size: 12px;
          color: rgba(233, 238, 249, 0.65);
          margin-top: 2px;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn {
          height: 38px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(233, 238, 249, 0.92);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: 120ms ease;
          font-size: 13px;
          font-weight: 600;
        }
        .btn:hover {
          background: rgba(255, 255, 255, 0.10);
          transform: translateY(-1px);
        }
        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .btnPrimary {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.82));
          color: #0b0f17;
          border: 1px solid rgba(255, 255, 255, 0.18);
        }
        .btnPrimary:hover {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.86));
        }

        .chip {
          height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.05);
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: rgba(233, 238, 249, 0.80);
        }

        .shell {
          max-width: 1180px;
          margin: 0 auto;
          padding: 18px;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 14px;
        }

        .sidebar {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          min-height: calc(100vh - 92px);
        }

        .sideHeader {
          padding: 14px 14px 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .sideTitle {
          font-size: 13px;
          font-weight: 700;
          margin: 0;
        }
        .sideHint {
          font-size: 12px;
          color: rgba(233, 238, 249, 0.60);
          margin-top: 6px;
        }

        .nav {
          padding: 10px;
          display: grid;
          gap: 8px;
        }
        .navBtn {
          height: 40px;
          border-radius: 12px;
          padding: 0 12px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.03);
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: 120ms ease;
        }
        .navBtn:hover {
          background: rgba(255, 255, 255, 0.07);
        }
        .navBtnActive {
          background: rgba(255, 255, 255, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.16);
        }
        .navLeft {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: rgba(233, 238, 249, 0.92);
          font-size: 13px;
          font-weight: 650;
        }
        .navRight {
          font-size: 12px;
          color: rgba(233, 238, 249, 0.55);
        }

        .main {
          display: grid;
          gap: 14px;
        }

        .banner {
          border-radius: 16px;
          border: 1px solid rgba(255, 80, 80, 0.25);
          background: rgba(255, 80, 80, 0.10);
          padding: 12px 14px;
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }
        .bannerTitle {
          font-weight: 750;
          font-size: 13px;
        }
        .bannerMsg {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(255, 220, 220, 0.92);
          line-height: 1.35;
        }
        .bannerTip {
          margin-top: 8px;
          font-size: 11px;
          color: rgba(255, 220, 220, 0.75);
        }

        .card {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }

        .cardHeader {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .cardTitle {
          font-size: 13px;
          font-weight: 800;
          color: rgba(233, 238, 249, 0.92);
        }
        .cardBody {
          padding: 16px;
        }

        .row {
          display: grid;
          gap: 10px;
        }

        .label {
          font-size: 12px;
          color: rgba(233, 238, 249, 0.70);
          margin-bottom: 6px;
        }

        .inputRow {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .input {
          width: 100%;
          height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(15, 21, 34, 0.86);
          color: rgba(233, 238, 249, 0.92);
          padding: 0 12px;
          outline: none;
          font-size: 13px;
        }
        .input::placeholder {
          color: rgba(233, 238, 249, 0.35);
        }
        .input:focus {
          border-color: rgba(255, 255, 255, 0.18);
        }

        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .selectTile {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.03);
          padding: 12px;
          cursor: pointer;
          transition: 120ms ease;
        }
        .selectTile:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .selectTileActive {
          background: rgba(255, 255, 255, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.16);
        }
        .tileTitle {
          font-weight: 800;
          font-size: 13px;
        }
        .tileDesc {
          margin-top: 4px;
          font-size: 12px;
          color: rgba(233, 238, 249, 0.62);
          line-height: 1.35;
        }

        .muted {
          font-size: 12px;
          color: rgba(233, 238, 249, 0.55);
          line-height: 1.4;
        }

        .sceneLayout {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 14px;
        }

        .sceneList {
          padding: 10px;
          display: grid;
          gap: 8px;
        }
        .sceneItem {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.03);
          padding: 12px;
          cursor: pointer;
          transition: 120ms ease;
        }
        .sceneItem:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .sceneItemActive {
          background: rgba(255, 255, 255, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.16);
        }
        .sceneTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .sceneName {
          font-weight: 850;
          font-size: 13px;
        }
        .badges {
          display: inline-flex;
          gap: 8px;
          font-size: 11px;
          color: rgba(233, 238, 249, 0.60);
        }
        .badgeOk {
          color: rgba(120, 255, 175, 0.9);
        }
        .badgeNo {
          color: rgba(233, 238, 249, 0.35);
        }
        .sceneSnippet {
          margin-top: 8px;
          font-size: 12px;
          color: rgba(233, 238, 249, 0.60);
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .detailTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .previewWrap {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(15, 21, 34, 0.86);
          overflow: hidden;
          display: grid;
        }
        .previewInner {
          width: 100%;
          aspect-ratio: 16/10;
          display: grid;
          place-items: center;
          color: rgba(233, 238, 249, 0.55);
          font-size: 13px;
        }
        .previewImg {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .segRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .seg {
          height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.04);
          color: rgba(233, 238, 249, 0.85);
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          transition: 120ms ease;
        }
        .seg:hover {
          background: rgba(255, 255, 255, 0.08);
        }
        .segActive {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.16);
        }

        .footer {
          padding: 20px 18px;
          text-align: center;
          color: rgba(233, 238, 249, 0.35);
          font-size: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          margin-top: 18px;
        }

        @media (max-width: 1000px) {
          .shell {
            grid-template-columns: 1fr;
          }
          .sidebar {
            min-height: auto;
          }
          .sceneLayout {
            grid-template-columns: 1fr;
          }
          .previewInner {
            aspect-ratio: 16/11;
          }
        }
      `}</style>

      {/* Topbar */}
      <div className="topbar">
        <div className="topbarInner">
          <div className="brand">
            <div className="logo">
              <Sparkles size={18} />
            </div>
            <div className="brandText">
              <div className="brandName">Wonderwal Builder</div>
              <div className="brandSub">Dark • clean dashboard • no Tailwind</div>
            </div>
          </div>

          <div className="actions">
            {busy && (
              <div className="chip">
                <Loader2 size={14} className="spin" />
                {busyLabel || "Working…"}
              </div>
            )}
            <Link className="btn" href="/settings">
              <Settings size={16} />
              Settings API Key
            </Link>
          </div>
        </div>
      </div>

      <div className="shell">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sideHeader">
            <p className="sideTitle">Menu</p>
            <div className="sideHint">Workflow cepat: Setup → Scenes → Export</div>
          </div>

          <div className="nav">
            <button
              className={`navBtn ${step === "setup" ? "navBtnActive" : ""}`}
              onClick={() => setStep("setup")}
            >
              <div className="navLeft">
                <CheckCircle2 size={16} />
                Setup
              </div>
              <div className="navRight">1</div>
            </button>

            <button
              className={`navBtn ${step === "scenes" ? "navBtnActive" : ""}`}
              onClick={() => setStep("scenes")}
              disabled={!readyScenes}
              style={!readyScenes ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
            >
              <div className="navLeft">
                <ImageIcon size={16} />
                Scenes
              </div>
              <div className="navRight">2</div>
            </button>

            <button
              className={`navBtn ${step === "export" ? "navBtnActive" : ""}`}
              onClick={() => setStep("export")}
              disabled={!readyScenes}
              style={!readyScenes ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
            >
              <div className="navLeft">
                <Film size={16} />
                Export
              </div>
              <div className="navRight">3</div>
            </button>
          </div>

          <div style={{ padding: 12 }}>
            <div className="card" style={{ background: "rgba(15,21,34,0.55)" }}>
              <div className="cardHeader">
                <div className="cardTitle">Ringkasan</div>
              </div>
              <div className="cardBody">
                <div className="muted">Topik</div>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>{project.topic || "-"}</div>

                <div className="muted">Format</div>
                <div style={{ fontWeight: 800, marginBottom: 10 }}>
                  {project.format} ({aspectRatio})
                </div>

                <div className="muted">Scenes</div>
                <div style={{ fontWeight: 800 }}>{project.scenes.length}</div>

                <div style={{ height: 10 }} />

                <div className="muted">
                  Catatan: Kalau error quota “limit 0”, itu berarti API key kamu memang tidak punya kuota.
                  Rotasi 5 key hanya membantu kalau key-key tersebut berasal dari project yang kuotanya aktif.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="main">
          {error && (
            <div className="banner">
              <AlertTriangle size={18} />
              <div>
                <div className="bannerTitle">Terjadi kendala</div>
                <div className="bannerMsg">{error}</div>
                <div className="bannerTip">
                  Tips: isi 2–5 API key di <b>/settings</b> untuk rotasi. Kalau masih “limit 0”, ganti key dari project yang kuotanya aktif.
                </div>
              </div>
            </div>
          )}

          {/* SETUP */}
          {step === "setup" && (
            <div className="card">
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Project Setup</div>
                  <div className="muted">Isi topik, pilih style & format, lalu generate 9 scenes.</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" onClick={pickTrendingTopic} disabled={busy || isSearching}>
                    <RefreshCw size={16} />
                    Trending
                  </button>
                  <button className="btn btnPrimary" onClick={generateScript} disabled={busy}>
                    <Sparkles size={16} />
                    Generate 9 Scenes
                  </button>
                </div>
              </div>

              <div className="cardBody">
                <div className="row">
                  <div>
                    <div className="label">Topik</div>
                    <div className="inputRow">
                      <input
                        className="input"
                        value={project.topic}
                        onChange={(e) => setProject((p) => ({ ...p, topic: e.target.value }))}
                        placeholder="Contoh: Pertempuran Surabaya 1945 / VOC di Batavia / Legenda Roro Jonggrang"
                      />
                    </div>
                    <div style={{ marginTop: 8 }} className="muted">
                      Kalau trending gagal: itu biasanya karena quota API key (buka Settings).
                    </div>
                  </div>

                  <div className="grid2">
                    <div>
                      <div className="label">Style</div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {STYLE_OPTIONS.map((opt) => (
                          <div
                            key={opt.value}
                            className={`selectTile ${project.style === opt.value ? "selectTileActive" : ""}`}
                            onClick={() => setProject((p) => ({ ...p, style: opt.value }))}
                            role="button"
                          >
                            <div className="tileTitle">{opt.label}</div>
                            <div className="tileDesc">{opt.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="label">Format</div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {FORMAT_OPTIONS.map((opt) => (
                          <div
                            key={opt.value}
                            className={`selectTile ${project.format === opt.value ? "selectTileActive" : ""}`}
                            onClick={() => setProject((p) => ({ ...p, format: opt.value }))}
                            role="button"
                          >
                            <div className="tileTitle">{opt.label}</div>
                            <div className="tileDesc">{opt.desc}</div>
                          </div>
                        ))}
                      </div>

                      <div style={{ height: 12 }} />

                      <div className="label">Reference Image (opsional)</div>
                      <div className="inputRow">
                        <button className="btn" onClick={() => fileInputRef.current?.click()}>
                          <Upload size={16} />
                          Upload
                        </button>
                        <div className="muted">
                          {project.referenceImage ? "Uploaded ✅" : "Tidak ada gambar referensi"}
                        </div>
                        {project.referenceImage && (
                          <button
                            className="btn"
                            onClick={() => setProject((p) => ({ ...p, referenceImage: undefined }))}
                          >
                            Remove
                          </button>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => onUploadRefImage(e.target.files?.[0] || null)}
                        />
                      </div>

                      <div style={{ height: 10 }} />
                      <div className="muted">
                        API key: isi di{" "}
                        <Link href="/settings" style={{ textDecoration: "underline" }}>
                          /settings
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCENES */}
          {step === "scenes" && (
            <div className="card">
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Scenes</div>
                  <div className="muted">Generate image A/B dan voiceover untuk tiap panel.</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" onClick={() => setStep("setup")}>
                    Kembali Setup
                  </button>
                  <button className="btn btnPrimary" onClick={() => setStep("export")} disabled={!readyScenes}>
                    Export
                  </button>
                </div>
              </div>

              <div className="cardBody">
                <div className="sceneLayout">
                  <div className="card" style={{ background: "rgba(15,21,34,0.55)" }}>
                    <div className="cardHeader">
                      <div className="cardTitle">Daftar Panel</div>
                      <div className="muted">{project.scenes.length} scenes</div>
                    </div>
                    <div className="sceneList">
                      {project.scenes.map((s, idx) => {
                        const doneImg = Boolean(s.imageDataA || s.imageDataB);
                        const doneAudio = Boolean(s.audioData);
                        return (
                          <div
                            key={s.id}
                            className={`sceneItem ${idx === selectedSceneIndex ? "sceneItemActive" : ""}`}
                            onClick={() => {
                              setSelectedSceneIndex(idx);
                              setSelectedSlot("A");
                            }}
                            role="button"
                          >
                            <div className="sceneTop">
                              <div className="sceneName">Panel {idx + 1}</div>
                              <div className="badges">
                                <span className={doneImg ? "badgeOk" : "badgeNo"}>IMG</span>
                                <span className={doneAudio ? "badgeOk" : "badgeNo"}>AUDIO</span>
                              </div>
                            </div>
                            <div className="sceneSnippet">{s.narrative}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    {!selectedScene ? (
                      <div className="muted">Pilih scene dari daftar.</div>
                    ) : (
                      <>
                        <div className="detailTop">
                          <div>
                            <div style={{ fontWeight: 900 }}>Panel {selectedSceneIndex + 1}</div>
                            <div className="muted">Slot A = setup, Slot B = klimaks</div>
                          </div>

                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {selectedScene.audioData && (
                              <button className="btn" onClick={() => togglePlay(selectedScene.id, selectedScene.audioData!)}>
                                {playingSceneId === selectedScene.id ? <Pause size={16} /> : <Play size={16} />}
                                {playingSceneId === selectedScene.id ? "Stop" : "Play"}
                              </button>
                            )}

                            <button className="btn" onClick={downloadAllAssets} disabled={busy}>
                              <Download size={16} />
                              ZIP
                            </button>

                            <button className="btn btnPrimary" onClick={() => setStep("export")} disabled={!readyScenes}>
                              <Film size={16} />
                              Export
                            </button>
                          </div>
                        </div>

                        <div className="grid2">
                          <div>
                            <div className="card" style={{ background: "rgba(15,21,34,0.55)" }}>
                              <div className="cardHeader">
                                <div className="cardTitle">Actions</div>
                                <div className="muted">Generate per panel</div>
                              </div>
                              <div className="cardBody">
                                <div style={{ display: "grid", gap: 10 }}>
                                  <button
                                    className="btn"
                                    onClick={() => generateAsset(selectedScene.id, "IMAGE_A")}
                                    disabled={busy || selectedScene.isGeneratingImageA}
                                  >
                                    {selectedScene.isGeneratingImageA ? <Loader2 size={16} className="spin" /> : <ImageIcon size={16} />}
                                    Image A
                                  </button>

                                  <button
                                    className="btn"
                                    onClick={() => generateAsset(selectedScene.id, "IMAGE_B")}
                                    disabled={busy || selectedScene.isGeneratingImageB}
                                  >
                                    {selectedScene.isGeneratingImageB ? <Loader2 size={16} className="spin" /> : <ImageIcon size={16} />}
                                    Image B
                                  </button>

                                  <button
                                    className="btn btnPrimary"
                                    onClick={() => generateAsset(selectedScene.id, "AUDIO")}
                                    disabled={busy || selectedScene.isGeneratingAudio}
                                  >
                                    {selectedScene.isGeneratingAudio ? <Loader2 size={16} className="spin" /> : <Mic size={16} />}
                                    Generate Voiceover
                                  </button>
                                </div>

                                <div style={{ height: 12 }} />

                                <div className="muted" style={{ fontWeight: 800, marginBottom: 6 }}>
                                  Narrative
                                </div>
                                <div className="muted">{selectedScene.narrative}</div>

                                <div style={{ height: 12 }} />

                                <div className="muted" style={{ fontWeight: 800, marginBottom: 6 }}>
                                  Prompts (ringkas)
                                </div>
                                <div className="muted">
                                  <b>A:</b> {selectedScene.imagePromptA}
                                </div>
                                <div style={{ height: 8 }} />
                                <div className="muted">
                                  <b>B:</b> {selectedScene.imagePromptB}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="segRow">
                              <button
                                className={`seg ${selectedSlot === "A" ? "segActive" : ""}`}
                                onClick={() => setSelectedSlot("A")}
                              >
                                Preview A
                              </button>
                              <button
                                className={`seg ${selectedSlot === "B" ? "segActive" : ""}`}
                                onClick={() => setSelectedSlot("B")}
                              >
                                Preview B
                              </button>
                            </div>

                            <div className="previewWrap">
                              <div className="previewInner">
                                {(() => {
                                  const img =
                                    selectedSlot === "A"
                                      ? selectedScene.imageDataA || selectedScene.imageDataB
                                      : selectedScene.imageDataB || selectedScene.imageDataA;

                                  if (!img) return <div>Belum ada gambar.</div>;
                                  return <img className="previewImg" src={`data:image/jpeg;base64,${img}`} alt="preview" />;
                                })()}
                              </div>
                            </div>

                            <div style={{ height: 10 }} />
                            <div className="muted">
                              Tip: generate minimal 1 gambar + 1 audio per panel untuk hasil video paling oke.
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EXPORT */}
          {step === "export" && (
            <div className="card">
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Export</div>
                  <div className="muted">Download assets atau render video.</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn" onClick={() => setStep("scenes")} disabled={!readyScenes}>
                    Kembali
                  </button>
                </div>
              </div>

              <div className="cardBody">
                <div className="grid2">
                  <div className="card" style={{ background: "rgba(15,21,34,0.55)" }}>
                    <div className="cardHeader">
                      <div className="cardTitle">Assets</div>
                      <div className="muted">ZIP</div>
                    </div>
                    <div className="cardBody">
                      <button className="btn" onClick={downloadAllAssets} disabled={busy}>
                        <Download size={16} />
                        Download ZIP
                      </button>
                      <div style={{ height: 10 }} />
                      <div className="muted">
                        ZIP berisi image A/B per panel + voiceover wav (gabungan).
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ background: "rgba(15,21,34,0.55)" }}>
                    <div className="cardHeader">
                      <div className="cardTitle">Video</div>
                      <div className="muted">Render</div>
                    </div>
                    <div className="cardBody">
                      <button className="btn btnPrimary" onClick={renderVideo} disabled={busy}>
                        <Film size={16} />
                        Render Video
                      </button>
                      <div style={{ height: 10 }} />
                      <div className="muted">
                        Output bisa mp4/webm tergantung browser. Kalau gagal, coba Chrome.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ height: 12 }} />
                <div className="muted">
                  Lisensi/device lock tetap aman — halaman ini tidak menyentuh auth.
                </div>
              </div>
            </div>
          )}

          <div className="footer">
            Wonderwal • clean dashboard UI • tanpa Tailwind • lisensi tidak disentuh
          </div>
        </div>
      </div>

      <style jsx>{`
        .spin {
          animation: spin 900ms linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
