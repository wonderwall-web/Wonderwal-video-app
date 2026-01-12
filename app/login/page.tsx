"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const [license, setLicense] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("wonderwal_license");
    if (saved) validate(saved, true);
  }, []);

  const validate = async (lic: string, silent = false) => {
    if (!silent) {
      setLoading(true);
      setStatus("Checking...");
    }

    try {
      const res = await fetch(
        "https://script.google.com/macros/s/AKfycbx9LdpzUm-OHDkcoG2MD5udcllTywWwN9764WdPNqr2tQpQwntxcVf6xICKrCJe9UmKeg/exec?mode=validate&license=" +
          encodeURIComponent(lic)
      );

      const data = await res.json();

      if (data.valid) {
        localStorage.setItem("wonderwal_license", lic);
        router.push("/admin");
      } else {
        localStorage.removeItem("wonderwal_license");
        setStatus("❌ License invalid");
      }
    } catch {
      setStatus("❌ Server error");
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>
      <h2>Login License</h2>

      <input
        value={license}
        onChange={(e) => setLicense(e.target.value)}
        placeholder="Masukkan license"
        style={{ padding: 10, width: 300, marginBottom: 10 }}
      />

      <button
        onClick={() => validate(license)}
        disabled={loading}
        style={{ padding: "10px 20px" }}
      >
        {loading ? "Checking..." : "Login"}
      </button>

      <p>{status}</p>
    </div>
  );
}
