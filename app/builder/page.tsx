export const dynamic = "force-dynamic";

export default function BuilderPage() {
  return (
    <main style={{ minHeight: "100vh", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>Builder</h1>
      <p style={{ opacity: 0.8, marginTop: 8 }}>
        Jika halaman ini tidak kedip, berarti sebelumnya loop berasal dari redirect/guard di builder lama.
      </p>
    </main>
  );
}
