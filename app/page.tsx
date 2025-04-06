'use client'
import { useState } from 'react'

export default function Page() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError('')
    setText('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error desconegut')
      }

      const data = await res.json()
      setText(data.text)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Puja un document Word (.docx)</h1>
      <input type="file" accept=".docx" onChange={handleUpload} className="mb-4" />
      {loading && <p className="text-blue-600">Carregant...</p>}
      {error && <p className="text-red-600">⚠️ {error}</p>}
      <textarea
        className="w-full border rounded p-2 mt-4"
        rows={20}
        readOnly
        value={text}
        placeholder="Aquí apareixerà el text extret..."
      />
    </main>
  )
}

