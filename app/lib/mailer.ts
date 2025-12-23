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

export async function sendLicenseEmail(email: string, license: string) {
  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: email,
    subject: "Your Wonderwall AI License",
    html: `
      <h2>Welcome to Wonderwall AI</h2>
      <p>Your license is ready:</p>
      <p><b>${license}</b></p>
      <p>Login here:</p>
      <a href="https://wonderwal-video-app-a2el.vercel.app">
        https://wonderwal-video-app-a2el.vercel.app
      </a>
      <p>⚠️ License is locked to 1 device.</p>
    `
  })
}
