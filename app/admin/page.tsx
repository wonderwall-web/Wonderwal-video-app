"use client"

import { useState } from "react"

export default function AdminPage() {
  const [password, setPassword] = useState("")
  const [ok, setOk] = useState(false)
  const [license, setLicense] = useState("")
  const [loading, setLoading] = useState(false)

  const login = () => {
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setOk(true)
    } else {
      alert("PASSWORD SALAH")
    }
  }

  const generate = async () => {
    setLoading(true)
    const res = await fetch("/api/license/create", { method: "POST" })
    const data = await res.json()
    setLicense(data.license)
    setLoading(false)
  }

  if (!ok) {
    return (
      <main style={{ padding: 40 }}>
        <h1>ADMIN LOGIN</h1>
        <input
          type="password"
          placeholder="Admin Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <br /><br />
        <button onClick={login}>LOGIN</button>
      </main>
    )
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>ADMIN – GENERATE LICENSE</h1>

      <button onClick={generate} disabled={loading}>
        {loading ? "Generating..." : "Generate License"}
      </button>

      {license && (
        <pre style={{ marginTop: 20, background: "#eee", padding: 10 }}>
          {license}
        </pre>
      )}
    </main>
  )
}
