"use client"

import { useState } from "react"

export default function AdminPage() {
  const [pass, setPass] = useState("")
  const [error, setError] = useState("")
  const [ok, setOk] = useState(false)

  const login = async () => {
    setError("")
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pass })
    })

    const data = await res.json()
    if (data.ok) setOk(true)
    else setError("PASSWORD SALAH")
  }

  if (!ok) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-bold">ADMIN LOGIN</h1>
          <input
            type="password"
            className="border p-2"
            placeholder="Admin Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          <button className="bg-black text-white p-2" onClick={login}>
            LOGIN
          </button>
          {error && <p className="text-red-500">{error}</p>}
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-10">
      <h1 className="text-2xl font-bold">ADMIN PANEL</h1>
      <p>ADMIN LOCK AKTIF ✅</p>
      <p>AUTO-JUAL AKTIF ✅</p>
    </main>
  )
}
