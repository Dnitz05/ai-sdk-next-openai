'use client'
import { useState } from 'react'

export default function Page() {
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<string[]>([])

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError('')
    setImages([])
    setResults([])

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error desconegut')
      }

      const data = await res.json()
      setImages(data.pages)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyzeImages = async () => {
    setLoading(true)
    setResults([])

    try {
      const responses: string[] = []
      for (let idx = 0; idx < images.length; idx++) {
        const image = images[idx]
        const res = await fetch('/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image }),
        })

        const data = await res.json()
        responses.push(`Pàgina ${idx + 1}:\n${data.result}`)
      }
      setResults(responses)
    } catch (err: any) {
      setError('Error durant l’anàlisi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-center">Anàlisi Visual de PDF</h1>
      <div className="flex flex-col gap-2">
        <label className="font-medium">Puja un document PDF</label>
        <input type="file" accept="application/pdf" onChange={handleUploadPdf} className="border p-2 rounded" />
      </div>

      {loading && <p className="text-blue-600">⏳ Carregant...</p>}
      {error && <p className="text-red-600">⚠️ {error}</p>}

      {images.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((src, idx) => (
              <div key={idx} className="border rounded overflow-hidden">
                <img src={src} alt={`Pàgina ${idx + 1}`} className="w-full" />
                <p className="text-center text-sm p-2">Pàgina {idx + 1}</p>
              </div>
            ))}
          </div>
          <button
            onClick={handleAnalyzeImages}
            className="mt-6 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Analitzar totes les pàgines amb IA
          </button>
        </>
      )}

      {results.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-semibold text-green-700">Resultats:</h2>
          {results.map((res, idx) => (
            <div key={idx} className="bg-gray-100 p-4 rounded border">
              <pre className="whitespace-pre-wrap text-sm text-gray-800">{res}</pre>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}



