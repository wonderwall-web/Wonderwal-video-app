import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
})

export async function sendLicenseEmail(to: string, license: string) {
  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to,
    subject: "Your Wonderwall AI License",
    html: `
      <h2>Wonderwall AI</h2>
      <p>Terima kasih sudah membeli.</p>
      <p><b>LICENSE ANDA:</b></p>
      <h3>${license}</h3>
      <p>Login: https://wonderwal-video-app-a2el.vercel.app</p>
    `
  })
}
