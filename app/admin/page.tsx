"use client"

import { useState } from "react"

export default function AdminPage() {
  const [license, setLicense] = useState("")
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setLoading(true)
    const res = await fetch("/api/license/create", {
      method: "POST"
    })
    const data = await res.json()
    setLicense(data.license)
    setLoading(false)
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>ADMIN – GENERATE LICENSE</h1>

      <button
        onClick={generate}
        disabled={loading}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          cursor: "pointer"
        }}
      >
        {loading ? "Generating..." : "Generate License"}
      </button>

      {license && (
        <div style={{ marginTop: 20 }}>
          <strong>LICENSE:</strong>
          <pre
            style={{
              marginTop: 10,
              padding: 10,
              background: "#eee"
            }}
          >
            {license}
          </pre>
        </div>
      )}
    </main>
  )
}
