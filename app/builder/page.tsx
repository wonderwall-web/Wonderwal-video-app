"use client";

import { useState } from "react";
import { Plus, Send, Copy } from "lucide-react";

type Session = {
  id: string;
  title: string;
  prompt: string;
  output: string;
};

export default function BuilderPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const activeSession = sessions.find(s => s.id === activeId);

  function newSession() {
    const id = Date.now().toString();
    const session: Session = {
      id,
      title: "New Session",
      prompt: "",
      output: "",
    };
    setSessions([session, ...sessions]);
    setActiveId(id);
    setPrompt("");
    setOutput("");
  }

  async function generate() {
    if (!prompt.trim()) return;

    setLoading(true);
    setOutput("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();

      const text = data?.output || "No output.";
      setOutput(text);

      if (activeId) {
        setSessions(prev =>
          prev.map(s =>
            s.id === activeId
              ? { ...s, prompt, output: text, title: prompt.slice(0, 30) }
              : s
          )
        );
      }
    } catch {
      setOutput("❌ Error contacting API");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex bg-[#0b1020] text-white">

      {/* SIDEBAR */}
      <aside className="w-64 border-r border-white/10 p-4 flex flex-col">
        <div className="font-bold text-lg mb-4">✨ Nusantara AI</div>

        <button
          onClick={newSession}
          className="flex items-center gap-2 bg-white text-black px-3 py-2 rounded mb-4"
        >
          <Plus size={16} /> New Session
        </button>

        <div className="flex-1 overflow-y-auto space-y-2 text-sm">
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => {
                setActiveId(s.id);
                setPrompt(s.prompt);
                setOutput(s.output);
              }}
              className={`p-2 rounded cursor-pointer ${
                activeId === s.id
                  ? "bg-white/10"
                  : "hover:bg-white/5"
              }`}
            >
              {s.title}
            </div>
          ))}
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col">

        {/* TOP BAR */}
        <header className="h-12 border-b border-white/10 px-6 flex items-center text-sm opacity-70">
          AI Studio Mode
        </header>

        {/* CONTENT */}
        <div className="flex flex-1 overflow-hidden">

          {/* PROMPT PANEL */}
          <div className="w-1/2 border-r border-white/10 p-6 flex flex-col gap-4">
            <div className="text-xs uppercase opacity-60">Prompt</div>

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Write prompt here..."
              className="flex-1 bg-black/40 border border-white/10 p-4 rounded resize-none outline-none"
            />

            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-white text-black px-4 py-2 rounded font-medium"
            >
              <Send size={16} />
              {loading ? "Generating..." : "Generate"}
            </button>
          </div>

          {/* OUTPUT PANEL */}
          <div className="w-1/2 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className="text-xs uppercase opacity-60">Output</div>
              {output && (
                <button
                  onClick={() => navigator.clipboard.writeText(output)}
                  className="text-xs flex items-center gap-1 opacity-60 hover:opacity-100"
                >
                  <Copy size={12} /> Copy
                </button>
              )}
            </div>

            <div className="flex-1 bg-black/40 border border-white/10 p-4 rounded overflow-y-auto whitespace-pre-wrap">
              {output || "Output will appear here..."}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
