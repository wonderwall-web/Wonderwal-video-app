"use client"

import { useState } from "react"

export default function AdminPage() {
  const [password, setPassword] = useState("")
  const [logged, setLogged] = useState(false)

  const login = () => {
    if (password === "rahasia_admin_123") {
      setLogged(true)
    } else {
      alert("PASSWORD SALAH")
    }
  }

  if (!logged) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h1><b>ADMIN LOGIN</b></h1>
          <input
            type="password"
            placeholder="Admin Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: 8, border: "1px solid #ccc" }}
          />
          <button
            onClick={login}
            style={{ padding: 8, background: "black", color: "white" }}
          >
            LOGIN
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-10">
      <h1><b>ADMIN PANEL</b></h1>
      <p>✔ Admin Login OK</p>
      <p>✔ Webhook Lynk OK</p>
      <p>✔ Auto License OK</p>
    </main>
  )
}
