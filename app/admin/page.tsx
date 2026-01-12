"use client";

import { useEffect, useState } from "react";

export default function Page() {
  const [lic, setLic] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wonderwal_license") || "";
      setLic(saved);
    } catch {}
  }, []);

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h2>Admin Panel ✅</h2>
      <p>Login sukses. License tersimpan:</p>
      <div
        style={{
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
          display: "inline-block",
          marginBottom: 20,
        }}
      >
        <code>{lic || "-"}</code>
      </div>

      <div style={{ marginTop: 20 }}>
        <a href="/logout">Logout</a>
      </div>
    </div>
  );
}
