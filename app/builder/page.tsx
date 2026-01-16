export const dynamic = "force-dynamic";

export default function BuilderPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        background: "#05070f",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Builder (Minimal)</h1>
      <p style={{ marginTop: 10, opacity: 0.85 }}>
        Kalau kamu bisa baca ini, berarti flicker/loop sudah selesai.
      </p>
    </main>
  );
}
