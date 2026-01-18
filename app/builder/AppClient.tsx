"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Scene = {
  id: string;
  narrative: string;
  imagePromptA: string;
  imagePromptB: string;
  videoPrompt: string;

  imageA?: string; // dataUrl
  imageB?: string; // dataUrl
  audioUrl?: string;

  loadingA?: boolean;
  loadingB?: boolean;
};

type GenerateMeta = {
  topic: string;
  style: string;
  format: string;
  audience: string;
  genre: string;
  template: string;
};

const STYLE_OPTIONS = [
  { value: "ERA_KOLONIAL", label: "ERA KOLONIAL" },
  { value: "SEJARAH_PERJUANGAN", label: "PERJUANGAN" },
  { value: "LEGENDA_RAKYAT", label: "LEGENDA" },
  { value: "BUDAYA_NUSANTARA", label: "BUDAYA" },
];

const FORMAT_OPTIONS = [
  { value: "SHORT", label: "SHORT" },
  { value: "LONG", label: "LONG" },
];

const AUDIENCE_OPTIONS = [
  { value: "LOCAL", label: "LOCAL" },
  { value: "GLOBAL", label: "GLOBAL" },
];

const GENRE_OPTIONS = [
  { value: "HISTORY", label: "HISTORY" },
  { value: "DRAMA", label: "DRAMA" },
  { value: "MYSTERY", label: "MYSTERY" },
];

const TEMPLATE_OPTIONS = [
  { value: "STANDARD", label: "STANDARD" },
  { value: "VIRAL_DRAMA", label: "VIRAL DRAMA" },
];

function getAllApiKeysFromStorage(): string[] {
  try {
    const raw = localStorage.getItem("YOSO_API_KEY_SLOTS");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s) => (s?.apiKey || "").trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function ChipGroup(props: {
  title: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const { title, value, options, onChange } = props;
  return (
    <div className="chipGroup">
      <div className="chipTitle">{title}</div>
      <div className="chips">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              className={`chip ${active ? "active" : ""}`}
              onClick={() => onChange(o.value)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YosoFoxLogo() {
  return (
    <div className="yosoLogoWrap" aria-label="YosoApps logo">
      <div className="yosoMark">
        <svg viewBox="0 0 120 120" width="74" height="74" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="yosoG" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#ff7a18" />
              <stop offset="1" stopColor="#ff2fb3" />
            </linearGradient>
          </defs>
          <path
            d="M60 10
               C43 10 30 22 28 36
               C22 30 12 32 10 42
               C8 54 18 64 30 63
               C32 88 44 108 60 110
               C76 108 88 88 90 63
               C102 64 112 54 110 42
               C108 32 98 30 92 36
               C90 22 77 10 60 10Z"
            fill="url(#yosoG)"
            stroke="#000"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <path
            d="M40 50 C38 42 44 36 52 36
               C56 36 58 38 60 40
               C62 38 64 36 68 36
               C76 36 82 42 80 50
               C78 60 70 66 60 66
               C50 66 42 60 40 50Z"
            fill="#fff"
            stroke="#000"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="50" r="4.5" fill="#000" />
          <circle cx="70" cy="50" r="4.5" fill="#000" />
          <path
            d="M60 56
               C56 56 54 58 54 60
               C54 64 57 66 60 66
               C63 66 66 64 66 60
               C66 58 64 56 60 56Z"
            fill="#000"
          />
          <path d="M46 74 C52 80 68 80 74 74" fill="none" stroke="#000" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="yosoText">
        <div className="yosoName">YOSOAPPS</div>
        <div className="yosoTag">the Viral Creator</div>
      </div>
    </div>
  );
}

export default function AppClient() {
  const [topic, setTopic] = useState("Jembatan Katulampa");
  const [style, setStyle] = useState("ERA_KOLONIAL");
  const [format, setFormat] = useState("SHORT");
  const [audience, setAudience] = useState("LOCAL");
  const [genre, setGenre] = useState("HISTORY");
  const [template, setTemplate] = useState("STANDARD");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [lastUrl, setLastUrl] = useState("");
  const [lastRes, setLastRes] = useState<any>(null);

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [apiCount, setApiCount] = useState(0);

  const inflightRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    setApiCount(getAllApiKeysFromStorage().length);
  }, []);

  const meta: GenerateMeta = useMemo(
    () => ({ topic, style, format, audience, genre, template }),
    [topic, style, format, audience, genre, template]
  );

  async function onGenerate9() {
    setBusy(true);
    setMsg("Membangun diorama...");
    setLastRes(null);
    setLastUrl("/api/yoso/diorama/script");

    try {
      const apiKeys = getAllApiKeysFromStorage();
      if (!apiKeys.length) {
        setMsg("API_KEY_MISSING → isi dulu di Settings");
        return;
      }

      const r = await fetch("/api/yoso/diorama/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKeys, topic, style, format, audience, genre, template }),
      });

      const j = await r.json();
      setLastRes(j);

      if (!j?.ok) {
        setMsg(JSON.stringify(j, null, 2));
        return;
      }

      const arr: Scene[] = Array.isArray(j?.scenes) ? j.scenes : [];
      // reset assets
      setScenes(arr.map((s) => ({ ...s, imageA: "", imageB: "", audioUrl: "", loadingA: false, loadingB: false })));
      setMsg(`OK: ${arr.length} panels generated`);
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function generateImage(sceneIndex: number, which: "A" | "B") {
    const apiKeys = getAllApiKeysFromStorage();
    setApiCount(apiKeys.length);

    if (!apiKeys.length) {
      setMsg("API_KEY_MISSING → isi dulu di Settings");
      return;
    }

    const scene = scenes[sceneIndex];
    if (!scene) return;

    const key = `${sceneIndex}_${which}`;
    if (inflightRef.current[key]) return;
    inflightRef.current[key] = true;

    setLastUrl("/api/yoso/imagen");
    setLastRes(null);
    setMsg(`Generating image ${which} for panel #${sceneIndex + 1}...`);

    setScenes((prev) =>
      prev.map((s, i) =>
        i === sceneIndex ? { ...s, [which === "A" ? "loadingA" : "loadingB"]: true } : s
      )
    );

    try {
      const prompt = which === "A" ? scene.imagePromptA : scene.imagePromptB;

      const r = await fetch("/api/yoso/imagen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKeys,
          prompt,
          aspectRatio: "9:16",
          imageSize: "1K",
          model: "imagen-4.0-generate-001",
          sampleCount: 1,
        }),
      });

      const j = await r.json().catch(() => ({}));
      setLastRes(j);

      if (!r.ok || !j?.ok || !j?.image?.dataUrl) {
        setMsg(JSON.stringify({ ok: false, http: r.status, error: "IMAGE_GEN_FAIL", raw: j }, null, 2));
        return;
      }

      const dataUrl = String(j.image.dataUrl);
      setScenes((prev) =>
        prev.map((s, i) =>
          i === sceneIndex
            ? {
                ...s,
                ...(which === "A" ? { imageA: dataUrl } : { imageB: dataUrl }),
              }
            : s
        )
      );

      setMsg(`OK: Image ${which} ready ✅`);
    } catch (e: any) {
      setMsg(String(e?.message || e));
    } finally {
      setScenes((prev) =>
        prev.map((s, i) =>
          i === sceneIndex ? { ...s, loadingA: false, loadingB: false } : s
        )
      );
      inflightRef.current[key] = false;
    }
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <div className="title">YosoApp Builder</div>
          <div className="tag">YOSOApps the Viral Creator</div>
        </div>

        <div className="topActions">
          <Link className="linkBtn" href="/settings">
            Settings
          </Link>
          <div className={`pill ${apiCount ? "ok" : "bad"}`}>
            {apiCount ? `${apiCount} API Keys Loaded` : "API Keys Missing"}
          </div>
        </div>
      </div>

      <div className="grid">
        <aside className="card controlsCard">
          <div className="controlsTitle">Controls</div>

          <div className="topicBox">
            <div className="topicLabel">Tentukan Kisah</div>
            <input
              className="topicInput"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Tulis kejadian sejarah, tokoh, atau legenda..."
            />
          </div>

          <ChipGroup title="Pilih Kategori" value={style} options={STYLE_OPTIONS} onChange={setStyle} />
          <ChipGroup title="Format" value={format} options={FORMAT_OPTIONS} onChange={setFormat} />
          <ChipGroup title="Audience" value={audience} options={AUDIENCE_OPTIONS} onChange={setAudience} />
          <ChipGroup title="Genre" value={genre} options={GENRE_OPTIONS} onChange={setGenre} />
          <ChipGroup title="Template" value={template} options={TEMPLATE_OPTIONS} onChange={setTemplate} />

          <button className="bigAction" disabled={busy} onClick={onGenerate9}>
            {busy ? "MEMBANGUN..." : "BANGUN DIORAMA!"}
          </button>

          <div className="logoArea">
            <YosoFoxLogo />
          </div>

          <div className="miniNote">
            <div className="miniNoteTitle">Catatan</div>
            <div className="miniNoteText">Tombol Generate Gambar pakai prompt A/B dari panel (sinkron seperti ZIP).</div>
          </div>
        </aside>

        <main className="card panelsCard">
          <div className="panelsTitle">Panels</div>

          <div className="panels">
            {scenes.map((s, i) => (
              <div key={i} className="comicPanel">
                <div className="panelTop">
                  <span className="panelIndex">#{i + 1}</span>
                  <button className="btnAudio" type="button">
                    🎤 GENERATE SUARA
                  </button>
                </div>

                <div className="imageGrid">
                  <div className="imageBox">
                    <div className="imgBadge pink">A</div>

                    <div className="imgPh">
                      {s.loadingA ? <div className="spinner" /> : null}
                      {s.imageA ? <img className="imgReal" src={s.imageA} alt={`Panel ${i + 1} A`} /> : null}
                    </div>

                    <button className="genBtn" type="button" onClick={() => generateImage(i, "A")} disabled={!!s.loadingA}>
                      {s.loadingA ? "GENERATING..." : "GENERATE GAMBAR"}
                    </button>

                    <button
                      className={`dlBtn ${s.imageA ? "on" : "off"}`}
                      type="button"
                      title="Download"
                      onClick={() => s.imageA && downloadDataUrl(s.imageA, `yoso_panel${i + 1}_A.png`)}
                      disabled={!s.imageA}
                    >
                      ⬇
                    </button>
                  </div>

                  <div className="imageBox">
                    <div className="imgBadge cyan">B</div>

                    <div className="imgPh">
                      {s.loadingB ? <div className="spinner" /> : null}
                      {s.imageB ? <img className="imgReal" src={s.imageB} alt={`Panel ${i + 1} B`} /> : null}
                    </div>

                    <button className="genBtn" type="button" onClick={() => generateImage(i, "B")} disabled={!!s.loadingB}>
                      {s.loadingB ? "GENERATING..." : "GENERATE GAMBAR"}
                    </button>

                    <button
                      className={`dlBtn ${s.imageB ? "on" : "off"}`}
                      type="button"
                      title="Download"
                      onClick={() => s.imageB && downloadDataUrl(s.imageB, `yoso_panel${i + 1}_B.png`)}
                      disabled={!s.imageB}
                    >
                      ⬇
                    </button>
                  </div>
                </div>

                <div className="narrativeBox">“{s.narrative}”</div>

                <div className="videoBox">
                  <div className="videoTitle">VIDEO PROMPT</div>
                  <div className="videoText">{s.videoPrompt}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="debug">
            <div className="debugTitle">Debug</div>
            <div className="debugLine">
              <span className="dim">Last URL:</span> <span className="mono">{lastUrl || "-"}</span>
            </div>
            {msg ? <pre className="pre">{msg}</pre> : null}
            {lastRes ? <pre className="pre">{JSON.stringify(lastRes, null, 2)}</pre> : null}
          </div>
        </main>
      </div>

      <style jsx>{`
        :global(html),
        :global(body) {
          overflow-x: hidden;
        }
        .wrap {
          min-height: 100vh;
          background: radial-gradient(1200px 800px at 20% 0%, #0b1b3a 0%, #060a14 60%, #050712 100%);
          padding: 18px;
          color: #111;
          font-family: ui-rounded, "Comic Sans MS", "Trebuchet MS", system-ui, -apple-system, Segoe UI, Roboto, Arial,
            sans-serif;
        }

        .topbar {
          background: #ffd84a;
          border: 4px solid #000;
          border-radius: 18px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
        }
        .title {
          font-weight: 1000;
          font-size: 18px;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .tag {
          font-size: 12px;
          font-weight: 900;
          opacity: 0.9;
        }
        .topActions {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .linkBtn {
          text-decoration: none;
          color: #111;
          font-weight: 1000;
          font-size: 12px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 3px solid #000;
          background: #fff;
          box-shadow: 0 6px 0 #000;
        }
        .linkBtn:active {
          transform: translateY(2px);
          box-shadow: 0 4px 0 #000;
        }
        .pill {
          font-size: 12px;
          font-weight: 1000;
          padding: 10px 12px;
          border-radius: 999px;
          border: 3px solid #000;
          background: #fff;
          box-shadow: 0 6px 0 #000;
          white-space: nowrap;
        }
        .pill.ok {
          background: #dcfce7;
        }
        .pill.bad {
          background: #fee2e2;
        }

        .grid {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 16px;
          margin-top: 16px;
          align-items: start;
        }

        .card {
          background: #fff;
          border-radius: 22px;
          border: 4px solid #000;
          padding: 16px;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
          min-width: 0;
        }

        .controlsTitle,
        .panelsTitle {
          font-weight: 1000;
          text-transform: uppercase;
          font-size: 16px;
          margin-bottom: 10px;
        }

        .topicBox {
          border: 4px solid #000;
          border-radius: 18px;
          padding: 12px;
          background: #fff;
          box-shadow: 0 10px 0 rgba(0, 0, 0, 0.1);
        }
        .topicLabel {
          font-weight: 1000;
          text-transform: uppercase;
          font-size: 12px;
          margin-bottom: 8px;
        }
        .topicInput {
          width: 100%;
          border: 3px solid #000;
          border-radius: 16px;
          padding: 12px 12px;
          font-weight: 900;
          outline: none;
          font-size: 14px;
          background: #f8fafc;
        }

        .chipGroup {
          margin-top: 12px;
        }
        .chipTitle {
          font-weight: 1000;
          text-transform: uppercase;
          font-size: 12px;
          margin-bottom: 8px;
        }
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .chip {
          padding: 10px 12px;
          border: 3px solid #000;
          border-radius: 16px;
          background: #fff;
          font-weight: 1000;
          font-size: 12px;
          cursor: pointer;
          box-shadow: 0 6px 0 #000;
          text-transform: uppercase;
        }
        .chip:active {
          transform: translateY(2px);
          box-shadow: 0 4px 0 #000;
        }
        .chip.active {
          background: #4adee5;
        }

        .bigAction {
          margin-top: 14px;
          width: 100%;
          padding: 14px 14px;
          border: 4px solid #000;
          border-radius: 20px;
          background: #ffd84a;
          font-weight: 1000;
          font-size: 16px;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 10px 0 #000;
        }
        .bigAction:active {
          transform: translateY(3px);
          box-shadow: 0 7px 0 #000;
        }
        .bigAction:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .logoArea {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 3px dashed rgba(0, 0, 0, 0.25);
        }
        .yosoLogoWrap {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 10px;
          border: 4px solid #000;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 10px 0 rgba(0, 0, 0, 0.12);
        }
        .yosoText {
          min-width: 0;
        }
        .yosoName {
          font-weight: 1000;
          font-size: 18px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          line-height: 1;
        }
        .yosoTag {
          margin-top: 4px;
          font-weight: 900;
          font-size: 12px;
          opacity: 0.85;
          text-transform: lowercase;
        }

        .miniNote {
          margin-top: 12px;
          padding: 12px;
          border: 3px solid #000;
          border-radius: 16px;
          background: #f1f5f9;
        }
        .miniNoteTitle {
          font-weight: 1000;
          text-transform: uppercase;
          font-size: 12px;
          margin-bottom: 6px;
        }
        .miniNoteText {
          font-size: 12px;
          font-weight: 800;
          opacity: 0.9;
        }

        .panels {
          display: grid;
          gap: 18px;
        }

        .comicPanel {
          border: 4px solid #000;
          border-radius: 26px;
          padding: 14px;
          background: #fff;
          display: grid;
          gap: 12px;
          min-width: 0;
        }

        .panelTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .panelIndex {
          background: #ff66c4;
          border: 3px solid #000;
          border-radius: 14px;
          padding: 8px 12px;
          font-weight: 1000;
          box-shadow: 0 6px 0 #000;
        }
        .btnAudio {
          background: #4adee5;
          border: 3px solid #000;
          border-radius: 14px;
          padding: 10px 12px;
          font-weight: 1000;
          box-shadow: 0 6px 0 #000;
          cursor: pointer;
          white-space: nowrap;
        }
        .btnAudio:active {
          transform: translateY(2px);
          box-shadow: 0 4px 0 #000;
        }

        .imageGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          min-width: 0;
        }

        .imageBox {
          border: 4px solid #000;
          border-radius: 22px;
          background: #fff;
          padding: 10px;
          position: relative;
          min-width: 0;
        }

        .imgBadge {
          position: absolute;
          top: 10px;
          left: 10px;
          width: 34px;
          height: 34px;
          border-radius: 12px;
          border: 3px solid #000;
          font-weight: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 0 #000;
          z-index: 4;
        }
        .imgBadge.pink {
          background: #ff66c4;
        }
        .imgBadge.cyan {
          background: #4adee5;
        }

        .imgPh {
          width: 100%;
          aspect-ratio: 3/4;
          border-radius: 18px;
          border: 4px solid #000;
          background: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.12), transparent 40%),
            linear-gradient(180deg, #111827, #000);
          position: relative;
          overflow: hidden;
        }
        .imgReal {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .spinner {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background: rgba(0, 0, 0, 0.35);
          z-index: 3;
        }
        .spinner::after {
          content: "";
          width: 44px;
          height: 44px;
          border-radius: 999px;
          border: 6px solid rgba(255, 255, 255, 0.35);
          border-top-color: #fff;
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .genBtn {
          width: 100%;
          margin-top: 10px;
          padding: 10px 10px;
          border: 3px solid #000;
          border-radius: 16px;
          background: #ffd84a;
          font-weight: 1000;
          box-shadow: 0 6px 0 #000;
          cursor: pointer;
          text-transform: uppercase;
        }
        .genBtn:active {
          transform: translateY(2px);
          box-shadow: 0 4px 0 #000;
        }
        .genBtn:disabled {
          opacity: 0.75;
          cursor: not-allowed;
        }

        .dlBtn {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 38px;
          height: 38px;
          border-radius: 14px;
          border: 3px solid #000;
          background: #fff;
          font-weight: 1000;
          box-shadow: 0 6px 0 #000;
          cursor: pointer;
          z-index: 4;
        }
        .dlBtn.off {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .dlBtn:active {
          transform: translateY(2px);
          box-shadow: 0 4px 0 #000;
        }

        .narrativeBox {
          border: 4px solid #000;
          border-radius: 22px;
          padding: 12px 12px;
          background: #fff;
          font-weight: 900;
          font-style: italic;
          line-height: 1.45;
          color: #0b1220;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .videoBox {
          border: 3px dashed #000;
          border-radius: 18px;
          padding: 12px;
          background: #f1f5f9;
          min-width: 0;
        }
        .videoTitle {
          font-weight: 1000;
          text-transform: uppercase;
          font-size: 12px;
          margin-bottom: 6px;
        }
        .videoText {
          font-weight: 900;
          font-size: 12px;
          line-height: 1.45;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .debug {
          margin-top: 16px;
          padding-top: 14px;
          border-top: 3px dashed rgba(0, 0, 0, 0.25);
        }
        .debugTitle {
          font-weight: 1000;
          text-transform: uppercase;
          font-size: 13px;
          margin-bottom: 8px;
        }
        .debugLine {
          font-size: 12px;
          margin-bottom: 8px;
        }
        .dim {
          opacity: 0.7;
        }
        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
        }
        .pre {
          margin-top: 10px;
          padding: 12px;
          border-radius: 16px;
          border: 3px solid #000;
          background: #fff;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 11px;
          white-space: pre-wrap;
          word-break: break-word;
          overflow-wrap: anywhere;
          max-width: 100%;
          overflow: hidden;
        }

        @media (max-width: 980px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .imageGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
