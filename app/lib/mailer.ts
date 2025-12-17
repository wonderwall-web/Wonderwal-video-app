import nodemailer from "nodemailer"

export async function sendLicenseEmail(
  to: string,
  license: string
) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  })

  await transporter.sendMail({
    from: `"Wonderwal AI" <${process.env.SMTP_USER}>`,
    to,
    subject: "License AI Video App",
    html: `
      <h2>Terima kasih sudah membeli</h2>
      <p>License kamu:</p>
      <h1>${license}</h1>
      <p>Simpan baik-baik.</p>
    `
  })
}
