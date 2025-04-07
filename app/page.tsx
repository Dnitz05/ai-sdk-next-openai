'use client'
import { useState } from 'react'

export default function Page() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [response, setResponse] = useState('')

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError('')
    setText('')
    setResponse('')

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

  const handleSendToChat = async () => {
    if (!text) return
    setLoading(true)
    setResponse('')

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Ets un expert jurídic en normativa urbanística catalana. Respon en català.' },
          { role: 'user', content: `Analitza aquest document:\n\n${text}` },
        ]
      }),
    })

    const data = await res.json()
    setResponse(data.choices?.[0]?.message?.content || 'Cap resposta')
    setLoading(false)
  }

  return (
    <main className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Puja un document Word (.docx)</h1>
      <input type="file" accept=".docx" onChange={handleUpload} className="mb-4" />
      {loading && <p className="text-blue-600">⏳ Carregant...</p>}
      {error && <p className="text-red-600">⚠️ {error}</p>}

      <textarea
        className="w-full border rounded p-2 mt-4"
        rows={12}
        readOnly
        value={text}
        placeholder="Aquí apareixerà el text extret..."
      />

      {text && (
        <button
          onClick={handleSendToChat}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Enviar al xat
        </button>
      )}

      {response && (
        <div className="mt-6 p-4 border rounded bg-gray-50 whitespace-pre-wrap">
          <strong className="block mb-2 text-lg text-green-700">Resposta de l'assistent:</strong>
          {response}
        </div>
      )}
    </main>
  )
}

