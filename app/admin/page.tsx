"use client"

import { useState } from "react"

export default function AdminPage() {
  const [pass, setPass] = useState("")
  const [ok, setOk] = useState(false)

  const login = () => {
    if (pass === "rahasia_admin_123") {
      setOk(true)
    } else {
      alert("SALAH")
    }
  }

  if (!ok) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-bold">ADMIN LOGIN</h1>
          <input
            className="border p-2"
            placeholder="Admin Password"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          <button
            onClick={login}
            className="bg-black text-white p-2"
          >
            LOGIN
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-10">
      <h1 className="text-2xl font-bold mb-4">ADMIN PANEL</h1>
      <p>Webhook Lynk AKTIF ✅</p>
      <p>Auto-generate license AKTIF ✅</p>
    </main>
  )
}
