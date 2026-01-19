export type SendMailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

function env(name: string) {
  return String(process.env[name] || "").trim();
}

// Wrapper aman: kalau env SMTP belum di-set di Vercel, jangan bikin build fail.
// Webhook tetap bisa jalan tanpa email (atau kamu bisa handle di caller).
export async function sendMail(input: SendMailInput): Promise<{ ok: boolean; error?: string }> {
  const SMTP_HOST = env("SMTP_HOST");
  const SMTP_PORT = env("SMTP_PORT");
  const SMTP_USER = env("SMTP_USER");
  const SMTP_PASS = env("SMTP_PASS");
  const FROM_EMAIL = env("FROM_EMAIL");

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !FROM_EMAIL) {
    return { ok: false, error: "SMTP_ENV_MISSING" };
  }

  // Import nodemailer hanya saat runtime (biar typings / bundling aman)
  const nodemailer = await import("nodemailer");

  const transporter = nodemailer.default.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    text: input.text || undefined,
    html: input.html || undefined,
  });

  return { ok: true };
}
