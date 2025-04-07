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
        let errData
        try {
          errData = await res.json()
        } catch {
          throw new Error('El servidor no ha retornat una resposta vàlida.')
        }
        throw new Error(errData.error || 'Error desconegut')
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
        model: 'gpt-4o',
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

  const handleDownloadPdf = () => {
    const blob = new Blob([response], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'resposta.pdf'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-center">Anàlisi de Documents Jurídics</h1>
      <div className="flex flex-col gap-2">
        <label className="font-medium">Puja un document Word (.docx)</label>
        <input type="file" accept=".docx" onChange={handleUpload} className="border p-2 rounded" />
      </div>

      {loading && <p className="text-blue-600">⏳ Carregant...</p>}
      {error && <p className="text-red-600">⚠️ {error}</p>}

      {text && (
        <div>
          <h2 className="font-semibold mt-4 mb-2">Text extret del document</h2>
          <textarea
            className="w-full border rounded p-2"
            rows={12}
            readOnly
            value={text}
          />
          <button
            onClick={handleSendToChat}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Enviar al xat
          </button>
        </div>
      )}

      {response && (
        <div className="bg-gray-50 p-4 rounded border mt-6">
          <h2 className="font-semibold mb-2 text-green-700">Resposta de l'assistent</h2>
          <pre className="whitespace-pre-wrap text-sm text-gray-800">{response}</pre>
          <button
            onClick={handleDownloadPdf}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Descarregar com a PDF
          </button>
        </div>
      )}
    </main>
  )
}
