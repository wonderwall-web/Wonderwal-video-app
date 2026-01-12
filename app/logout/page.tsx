"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    try {
      localStorage.removeItem("wonderwal_license");
    } catch {}

    document.cookie = "wonderwal_license=; Path=/; Max-Age=0; SameSite=Lax";
    router.replace("/login");
  }, [router]);

  return null;
}
