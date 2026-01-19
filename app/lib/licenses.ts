export type LicenseStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "DEVICE_MISMATCH"
  | "NOT_FOUND"
  | "ERROR";

export type LicenseCheckResult = {
  ok: boolean;
  status: LicenseStatus;
  license?: string;
  device_id?: string;
  message?: string;
  raw?: any;
};

// Minimal wrapper: panggil endpoint validate kamu yang sudah ada (baseline jangan diubah).
// Tujuan file ini cuma supaya import "@/app/lib/licenses" valid di Vercel.
export async function validateLicenseViaApi(opts: {
  license: string;
  device_id: string;
  baseUrl?: string; // optional for server side
}): Promise<LicenseCheckResult> {
  const license = String(opts.license || "").trim();
  const device_id = String(opts.device_id || "").trim();
  if (!license || !device_id) {
    return { ok: false, status: "ERROR", message: "LICENSE_OR_DEVICE_ID_MISSING" };
  }

  // Server route internal:
  // - Kalau baseUrl tidak ada, pakai relative (works in Next route runtime)
  const url = `${opts.baseUrl ? opts.baseUrl.replace(/\/+$/, "") : ""}/api/validate`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ license, device_id }),
      cache: "no-store",
    });

    const j = await res.json().catch(() => ({}));

    if (!res.ok || !j?.ok) {
      return {
        ok: false,
        status: (j?.status as LicenseStatus) || "ERROR",
        license,
        device_id,
        message: j?.error || "VALIDATE_FAILED",
        raw: j,
      };
    }

    return {
      ok: true,
      status: (j?.status as LicenseStatus) || "ACTIVE",
      license,
      device_id,
      message: j?.message || "OK",
      raw: j,
    };
  } catch (e: any) {
    return {
      ok: false,
      status: "ERROR",
      license,
      device_id,
      message: String(e?.message || e),
    };
  }
}
