"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const [license, setLicense] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const VALIDATE_BASE =
    "https://script.google.com/macros/s/AKfycbyhvIp_KNCqgxe3aOEmWhAIgrasmHKqjfsgc7m5I7cVGn0HoThZ0rm570kqugMoM_0xzg/exec?mode=validate&license=";

  useEffect(() => {
    const saved = localStorage.getItem("wonderwal_license");
    if (saved) validate(saved, true);
  }, []);

  const setCookie = (lic: string) => {
    document.cookie = `wonderwal_license=${encodeURIComponent(
      lic
    )}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };

  const clearCookie = () => {
    document.cookie = "wonderwal_license=; Path=/; Max-Age=0; SameSite=Lax";
  };

  const validate = async (lic: string, silent = false) => {
    lic = String(lic || "").trim();
    if (!lic) return;

    if (!silent) {
      setLoading(true);
      setStatus("Checking...");
    }

    try {
      const res = await fetch(VALIDATE_BASE + encodeURIComponent(lic), {
        cache: "no-store",
      });
      const data = await res.json();

      if (data.valid) {
        localStorage.setItem("wonderwal_license", lic);
        setCookie(lic);
        router.push("/admin");
      } else {
        localStorage.removeItem("wonderwal_license");
        clearCookie();
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
        style={{ padding: 10, width: 320, marginBottom: 10 }}
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
