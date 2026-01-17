export async function generateWithRotation(payload: {
  license: string;
  device: string;
  prompt: string;
  apiKey: string;
}) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const out = await res.json().catch(() => null);
  if (!res.ok || !out?.ok) throw new Error(out?.error || "GENERATE_FAILED");
  return out.output as string;
}
