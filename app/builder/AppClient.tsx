"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles, ChevronLeft, Play, Pause, Video, Mic,
  Download, Loader2, Copy, Landmark, Image as ImageIcon, Archive, ClipboardCheck,
  Upload, Zap, ShieldAlert, Flag, Map, Ghost, ScrollText, Star, Bomb, Volume2, Info, Heart,
  Compass, History, BookOpen, Castle, AlertCircle, RefreshCw
} from 'lucide-react';

import { Scene, VideoProject, VideoStyle, VideoFormat } from './types';
import * as GeminiService from './services/geminiService';
import { decode, decodeAudioData, getAudioContext, mergeAudioBuffers, audioBufferToWav } from './utils/audioUtils';
import { renderFullProjectToVideo } from './utils/videoUtils';
import JSZip from 'jszip';

const LOADING_MESSAGES = [
  "Menganalisa metafora visual...",
  "Menyiapkan pondasi miniatur...",
  "Memahat detail diorama...",
  "Mencari sudut lensa makro...",
  "Menyesuaikan pencahayaan fajar...",
  "Merekam suara sejarah...",
  "Menghaluskan tekstur batu...",
  "Diorama Nusantara siap dipotret...",
  "Hampir selesai..."
];

const STYLE_OPTIONS: { value: VideoStyle; label: string; icon: any }[] = [
  { value: "ERA_KOLONIAL", label: "Era Kolonial", icon: Landmark },
  { value: "SEJARAH_PERJUANGAN", label: "Perjuangan", icon: Flag },
  { value: "LEGENDA_RAKYAT", label: "Legenda", icon: Ghost },
  { value: "BUDAYA_NUSANTARA", label: "Budaya", icon: Compass },
];

const AppClient: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [project, setProject] = useState<VideoProject>({
    topic: '',
    style: 'SEJARAH_PERJUANGAN',
    format: 'SHORT',
    audience: 'LOCAL',
    genre: 'DRAMA',
    template: 'VIRAL_DRAMA',
    scenes: []
  });

  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [currentVisualSlot, setCurrentVisualSlot] = useState<'A' | 'B'>('A');
  const [showCtaPreview, setShowCtaPreview] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingIntervalRef = useRef<number | null>(null);

  const currentScene = project.scenes[currentSceneIndex];

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

  const togglePlaySceneAudio = (sceneId: string, buffer: AudioBuffer) => {
    audioSourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
    audioSourcesRef.current = [];

    if (playingAudioId === sceneId) {
      setPlayingAudioId(null);
      return;
    }

    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => setPlayingAudioId(null);
    source.start();

    audioSourcesRef.current.push(source);
    setPlayingAudioId(sceneId);
  };

  const handlePickRandomTopic = async () => {
    setIsSearching(true);
    setErrorMessage(null);
    try {
      const trending = await GeminiService.findTrendingTopic(project.style);
      setProject(p => ({ ...p, topic: trending }));
    } catch {
      setErrorMessage("Gagal mencari topik. Pastikan API key sudah diisi di /settings.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!project.topic) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await GeminiService.generateVideoScript(project);
      setProject(p => ({ ...p, scenes: res.scenes }));
      setCurrentStep(1);
    } catch (e: any) {
      setErrorMessage(e.message || "Gagal generate script.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateAsset = async (sceneId: string, type: 'IMAGE_A' | 'IMAGE_B' | 'AUDIO') => {
    const scene = project.scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setProject(p => ({
      ...p,
      scenes: p.scenes.map(s => s.id === sceneId ? {
        ...s,
        isGeneratingImageA: type === 'IMAGE_A' ? true : s.isGeneratingImageA,
        isGeneratingImageB: type === 'IMAGE_B' ? true : s.isGeneratingImageB,
        isGeneratingAudio: type === 'AUDIO' ? true : s.isGeneratingAudio,
      } : s)
    }));

    try {
      if (type === 'IMAGE_A' || type === 'IMAGE_B') {
        const slot = type === 'IMAGE_A' ? 'A' : 'B';
        const prompt = slot === 'A' ? scene.imagePromptA : scene.imagePromptB;

        const img = await GeminiService.generateSceneImage(
          prompt,
          project.style,
          project.format === 'SHORT' ? '9:16' : '16:9',
          project.referenceImage
        );

        setProject(p => ({
          ...p,
          scenes: p.scenes.map(s => s.id === sceneId ? {
            ...s,
            [slot === 'A' ? 'imageDataA' : 'imageDataB']: img,
            [slot === 'A' ? 'isGeneratingImageA' : 'isGeneratingImageB']: false
          } : s)
        }));
      }

      if (type === 'AUDIO') {
        const audioRaw = await GeminiService.generateVoiceover(scene.narrative);
        if (audioRaw) {
          const buf = await decodeAudioData(decode(audioRaw), getAudioContext());
          setProject(p => ({
            ...p,
            scenes: p.scenes.map(s => s.id === sceneId ? {
              ...s,
              audioData: buf,
              audioRaw,
              isGeneratingAudio: false
            } : s)
          }));
        }
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Gagal generate asset.");
    }
  };

  const downloadAllAssets = async () => {
    setIsLoading(true);
    try {
      const zip = new JSZip();
      const name = (project.topic || "Diorama").replace(/[^a-z0-9]/gi, "_");
      const folder = zip.folder(name);

      project.scenes.forEach((s, i) => {
        if (s.imageDataA) folder?.file(`Panel_${i+1}_A.jpg`, s.imageDataA, { base64: true });
        if (s.imageDataB) folder?.file(`Panel_${i+1}_B.jpg`, s.imageDataB, { base64: true });
      });

      const audios = project.scenes.map(s => s.audioData).filter(Boolean) as AudioBuffer[];
      if (audios.length) {
        const merged = mergeAudioBuffers(audios, getAudioContext());
        if (merged) folder?.file("Full_Audio.wav", audioBufferToWav(merged));
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${name}.zip`;
      link.click();
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const blob = await renderFullProjectToVideo(project.scenes, project.format);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "Diorama.mp4";
      link.click();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-4">Wonderwal Builder</h1>

      {errorMessage && (
        <div className="bg-red-800 p-3 mb-4 rounded">{errorMessage}</div>
      )}

      {currentStep === 0 && (
        <div className="space-y-4">
          <input
            className="w-full p-3 bg-zinc-800 rounded"
            placeholder="Masukkan topik cerita..."
            value={project.topic}
            onChange={e => setProject(p => ({ ...p, topic: e.target.value }))}
          />

          <div className="flex gap-2">
            {STYLE_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={() => setProject(p => ({ ...p, style: s.value }))}
                className={`px-3 py-2 rounded ${project.style === s.value ? "bg-yellow-500 text-black" : "bg-zinc-700"}`}
              >
                <s.icon size={16} /> {s.label}
              </button>
            ))}
          </div>

          <button
            onClick={handlePickRandomTopic}
            className="bg-blue-600 px-4 py-2 rounded"
          >
            Cari Topik Trending
          </button>

          <button
            onClick={handleGenerateScript}
            className="bg-green-600 px-4 py-2 rounded"
          >
            Bangun Diorama
          </button>
        </div>
      )}

      {currentStep === 1 && (
        <div className="space-y-6">
          {project.scenes.map((s, i) => (
            <div key={s.id} className="bg-zinc-900 p-4 rounded space-y-2">
              <h3 className="font-bold">Panel {i+1}</h3>
              <p>{s.narrative}</p>

              <div className="flex gap-2">
                <button onClick={() => handleGenerateAsset(s.id, "IMAGE_A")} className="bg-zinc-700 px-2 py-1 rounded">Img A</button>
                <button onClick={() => handleGenerateAsset(s.id, "IMAGE_B")} className="bg-zinc-700 px-2 py-1 rounded">Img B</button>
                <button onClick={() => handleGenerateAsset(s.id, "AUDIO")} className="bg-zinc-700 px-2 py-1 rounded">Audio</button>
              </div>

              {s.audioData && (
                <button onClick={() => togglePlaySceneAudio(s.id, s.audioData)} className="text-sm underline">
                  {playingAudioId === s.id ? "Stop Audio" : "Play Audio"}
                </button>
              )}
            </div>
          ))}

          <div className="flex gap-3">
            <button onClick={downloadAllAssets} className="bg-yellow-600 px-4 py-2 rounded">Download ZIP</button>
            <button onClick={handleExport} className="bg-purple-600 px-4 py-2 rounded">Render Video</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppClient;
