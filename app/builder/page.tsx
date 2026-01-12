"use client";

import { useMemo, useRef, useState } from "react";

type Category = "ERA_KOLONIAL" | "PERJUANGAN" | "LEGENDA" | "BUDAYA";
type Format = "SHORT" | "LONG";

export default function Page() {
  const [category, setCategory] = useState<Category>("PERJUANGAN");
  const [format, setFormat] = useState<Format>("SHORT");
  const [story, setStory] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [refImageName, setRefImageName] = useState<string>("");

  const prompt = useMemo(() => {
    const rules = [
      `Kamu adalah "Nusantara Diorama AI" - pembuat konsep diorama sejarah bergaya miniature/tilt-shift.`,
      `Buat output dalam format JSON saja (tanpa markdown).`,
      `Kategori: ${category}. Format: ${format}.`,
      `Berikan 1 konsep diorama lengkap: judul, era/waktu, lokasi, tokoh/objek utama, suasana, palet warna, daftar properti miniatur, komposisi kamera (angle, framing), teks narasi voice-over (sesuai format), dan prompt gambar untuk diorama.`,
      `Gunakan bahasa Indonesia yang jelas dan enak dibaca.`,
    ].join("\n");

    const user = `KISAH/IDE:\n${story || "-"}`;
    return `${rules}\n\n${user}`;
  }, [category, format, story]);

  const onPickRef = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setRefImageName(f.name);
  };

  const run = async () => {
    setLoading(true);
    setOutput("");

    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, prompt }),
      });

      const data = await r.json();
      if (data?.ok) setOutput(data.output || "");
      else setOutput("ERROR: " + (data?.error || "unknown"));
    } catch {
      setOutput("ERROR");
    }

    setLoading(false);
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.logoBox}>🧠</div>
        <div style={styles.brand}>NUSANTARA DIORAMA AI</div>
      </div>

      <div style={styles.card}>
        <div style={styles.title}>
          <div style={styles.titleMain}>BUAT <span style={{ color: "#7c4dff" }}>DIORAMA</span> SEJARAH</div>
          <div style={styles.subtitle}>PHYSICAL MACRO MINIATURE STORYTELLER</div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionLabel}>1. PILIH KATEGORI</div>
          <div style={styles.grid2}>
            <Btn active={category === "ERA_KOLONIAL"} onClick={() => setCategory("ERA_KOLONIAL")} label="ERA KOLONIAL" />
            <Btn active={category === "PERJUANGAN"} onClick={() => setCategory("PERJUANGAN")} label="PERJUANGAN" />
            <Btn active={category === "LEGENDA"} onClick={() => setCategory("LEGENDA")} label="LEGENDA" />
            <Btn active={category === "BUDAYA"} onClick={() => setCategory("BUDAYA")} label="BUDAYA" />
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionLabel}>2. FORMAT</div>
          <div style={styles.row}>
            <Btn active={format === "SHORT"} onClick={() => setFormat("SHORT")} label="SHORT" />
            <Btn active={format === "LONG"} onClick={() => setFormat("LONG")} label="LONG" />
            <div style={{ flex: 1 }} />
            <button style={styles.refBox} onClick={onPickRef} type="button">
              {refImageName ? `REF: ${refImageName}` : "REF IMAGE"}
            </button>
            <input ref={fileRef} onChange={onFileChange} type="file" accept="image/*" style={{ display: "none" }} />
          </div>
          <div style={styles.hint}>Catatan: ref image belum dipakai otomatis (tahap 2). Sekarang kita fokus teks → output.</div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionLabel}>3. TENTUKAN KISAH</div>
          <textarea
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder="Tulis kejadian sejarah, tokoh, atau legenda..."
            style={styles.textarea}
          />
        </div>

        <div style={styles.section}>
          <div style={styles.sectionLabel}>API KEY (milik user)</div>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste Google AI Studio API Key (tidak disimpan)"
            type="password"
            style={styles.input}
          />
        </div>

        <button style={styles.cta} onClick={run} disabled={loading || !apiKey || !story}>
          {loading ? "MEMBANGUN..." : "BANGUN DIORAMA!"}
        </button>

        <div style={styles.outBox}>
          <div style={styles.outTitle}>OUTPUT</div>
          <pre style={styles.pre}>{output}</pre>
        </div>
      </div>
    </div>
  );
}

function Btn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.btn,
        background: active ? "#ffd54f" : "#fff",
      }}
    >
      {label}
    </button>
  );
}

const styles: Record<string, any> = {
  page: {
    minHeight: "100vh",
    background: "#111",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    fontFamily: "Arial",
  },
  header: {
    width: "min(880px, 100%)",
    background: "#f7d443",
    borderRadius: 14,
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  logoBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: "#ff5aa5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { fontWeight: 900, letterSpacing: 1 },
  card: {
    width: "min(880px, 100%)",
    background: "#f7f7f7",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
  },
  title: { textAlign: "center", marginBottom: 12 },
  titleMain: { fontSize: 44, fontWeight: 900, lineHeight: 1.05 },
  subtitle: { marginTop: 8, opacity: 0.65, fontWeight: 700, letterSpacing: 1 },
  section: { marginTop: 14 },
  sectionLabel: {
    display: "inline-block",
    background: "#7ce6ff",
    padding: "6px 10px",
    fontWeight: 900,
    borderRadius: 6,
    border: "2px solid #111",
    marginBottom: 10,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  btn: {
    border: "3px solid #111",
    borderRadius: 10,
    padding: "12px 12px",
    fontWeight: 900,
    cursor: "pointer",
    width: 210,
  },
  refBox: {
    border: "3px dashed #111",
    borderRadius: 12,
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
    background: "#e9eef7",
  },
  hint: { marginTop: 8, fontSize: 12, opacity: 0.7 },
  textarea: {
    width: "100%",
    minHeight: 110,
    padding: 14,
    borderRadius: 14,
    border: "3px solid #111",
    fontSize: 16,
    outline: "none",
  },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "3px solid #111",
    fontSize: 16,
    outline: "none",
  },
  cta: {
    width: "100%",
    marginTop: 16,
    padding: "16px 18px",
    borderRadius: 18,
    border: "4px solid #111",
    background: "#ffe082",
    fontWeight: 900,
    fontSize: 20,
    cursor: "pointer",
  },
  outBox: {
    marginTop: 16,
    background: "#fff",
    borderRadius: 14,
    border: "2px solid #ddd",
    padding: 12,
  },
  outTitle: { fontWeight: 900, marginBottom: 8 },
  pre: { whiteSpace: "pre-wrap", margin: 0, fontSize: 13 },
};
