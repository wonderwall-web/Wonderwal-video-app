"use client"
import { useState } from "react"

export default function Home() {
  const [email, setEmail] = useState("")
  const [license, setLicense] = useState("")
  const [msg, setMsg] = useState("")

  const login = async () => {
    setMsg("Loading...")
    const device = navigator.userAgent

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, license, device })
    })

    if (res.ok) {
      setMsg("AKSES DIBERIKAN ✅")
    } else {
      setMsg("LOGIN GAGAL ❌")
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">AI VIDEO APP</h1>

      <input
        className="border p-2 w-64"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      <input
        className="border p-2 w-64"
        placeholder="License"
        value={license}
        onChange={e => setLicense(e.target.value)}
      />

      <button
        onClick={login}
        className="bg-black text-white px-4 py-2"
      >
        Login
      </button>

      <p>{msg}</p>
    </main>
  )
}
