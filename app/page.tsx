'use client';

import { useState } from 'react';

export default function Page() {
  // Estat per guardar les URLs de les imatges generades per CloudConvert
  const [images, setImages] = useState<string[]>([]);
  // Estat per indicar si alguna operació està en curs (pujada o anàlisi)
  const [loading, setLoading] = useState(false);
  // Estat per guardar missatges d'error
  const [error, setError] = useState('');
  // Estat per guardar els resultats de l'anàlisi (ara guardarem objectes)
  const [results, setResults] = useState<any[]>([]); // <-- Canviat a any[] per guardar objectes

  // Funció per gestionar la pujada del fitxer PDF
  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return; // Si no hi ha fitxer, no fem res

    setLoading(true); // Iniciem estat de càrrega
    setError(''); // Resetejem errors anteriors
    setImages([]); // Resetejem imatges anteriors
    setResults([]); // Resetejem resultats anteriors

    const formData = new FormData(); // Creem un formulari per enviar el fitxer
    formData.append('file', file);

    try {
      // Cridem a l'endpoint que genera les imatges via CloudConvert
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });

      // Controlem si la resposta del backend no és correcta
      if (!res.ok) {
        let errorData = { error: 'Error desconegut del servidor generant imatges' };
        try {
            // Intentem llegir el missatge d'error JSON del backend
            errorData = await res.json();
        } catch (e) {
            console.error("La resposta d'error de /api/upload-pdf no era JSON:", await res.text());
        }
        throw new Error(errorData.error || 'Error desconegut');
      }

      // Si la resposta és correcta, llegim el JSON amb les URLs de les imatges
      const data = await res.json();
      setImages(data.pages); // Guardem les URLs a l'estat

    } catch (err: any) {
      setError(err.message); // Mostrem l'error si alguna cosa falla
    } finally {
      setLoading(false); // Finalitzem estat de càrrega
    }
  };

  // Funció per analitzar totes les imatges generades amb la IA
  const handleAnalyzeImages = async () => {
    if (images.length === 0) return; // No analitzem si no hi ha imatges

    setLoading(true); // Iniciem estat de càrrega
    setError(''); // Resetejem errors
    setResults([]); // Resetejem resultats anteriors

    try {
      // Creem una promesa per a cada crida a l'API d'anàlisi
      const analysisPromises = images.map((image, idx) =>
        fetch('/api/analyze-image', { // Cridem a l'endpoint d'anàlisi
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image }), // Enviem la URL de la imatge
        }).then(async (res) => {
          // Controlem si la resposta de l'anàlisi no és correcta
          if (!res.ok) {
            let errorData = { error: `Error analitzant pàgina ${idx + 1}` };
             try {
                errorData = await res.json();
             } catch(e) {
                console.error(`La resposta d'error de analyze-image ${idx+1} no era JSON:`, await res.text());
             }
            // Llencem un error per aturar Promise.all si una de les pàgines falla
            throw new Error(errorData.error || `Error desconegut analitzant pàgina ${idx + 1}`);
          }
          // Llegim el resultat JSON de l'anàlisi
          const data = await res.json();
          // Retornem un objecte amb el número de pàgina i l'anàlisi JSON
          return { page: idx + 1, analysis: data.result };
        })
      );

      // Esperem que totes les promeses d'anàlisi acabin
      const allResults = await Promise.all(analysisPromises);

      // Ordenem els resultats per número de pàgina (per si arriben desordenats)
      allResults.sort((a, b) => a.page - b.page);

      // Guardem tots els resultats (objectes) a l'estat
      setResults(allResults);

    } catch (err: any) {
      // Si alguna de les anàlisis falla, mostrem l'error
      setError('Error durant l’anàlisi: ' + err.message);
      // Podríem decidir si mantenir resultats parcials o no: setResults([]);
    } finally {
      setLoading(false); // Finalitzem estat de càrrega
    }
  };

  // Renderització del component
  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-center mb-8">Anàlisi Visual de PDF</h1>

      {/* Secció de Càrrega de Fitxer */}
      <div className="flex flex-col gap-2 p-4 border rounded shadow-sm bg-white">
        <label htmlFor="pdf-upload" className="font-medium text-gray-700">Puja un document PDF</label>
        <input
          id="pdf-upload"
          type="file"
          accept="application/pdf"
          onChange={handleUploadPdf}
          className="border p-2 rounded text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          disabled={loading} // Deshabilitem mentre carrega
        />
      </div>

      {/* Indicador de Càrrega o Missatge d'Error */}
      {loading && <p className="text-center text-blue-600 font-medium">⏳ Processant... Si us plau, espera.</p>}
      {error && <p className="text-center text-red-600 font-semibold p-3 bg-red-50 border border-red-200 rounded">⚠️ {error}</p>}

      {/* Secció per mostrar miniatures (només si hi ha imatges i no estem carregant ni hi ha error) */}
      {images.length > 0 && !loading && !error && (
        <div className="mt-6 p-4 border rounded shadow-sm bg-white">
           <h2 className="text-xl font-semibold text-gray-800 mb-4">Pàgines Detectades:</h2>
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
             {images.map((src, idx) => (
               <div key={idx} className="border rounded overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                 <img src={src} alt={`Pàgina ${idx + 1}`} className="w-full h-auto object-contain bg-gray-100" />
                 <p className="text-center text-xs font-medium p-2 bg-gray-100 border-t">Pàgina {idx + 1}</p>
               </div>
             ))}
           </div>
           {/* Botó per iniciar l'anàlisi */}
           <div className="text-center mt-6">
             <button
               onClick={handleAnalyzeImages}
               className="px-6 py-3 bg-green-600 text-white rounded font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
               disabled={loading || results.length > 0} // Deshabilitem si ja s'està analitzant o si ja hi ha resultats
             >
               Analitzar totes les pàgines amb IA
             </button>
           </div>
        </div>
      )}

      {/* Secció per mostrar resultats (el JSON formatejat) */}
      {results.length > 0 && !loading && (
        <div className="mt-8 space-y-4">
          <h2 className="text-2xl font-semibold text-green-800 border-b pb-2 mb-4">Resultats de l'Anàlisi:</h2>
          {results.map((res, idx) => (
            <div key={idx} className="bg-gray-50 p-4 rounded border shadow-sm">
              {/* Mostrem el número de pàgina */}
              <h3 className="font-semibold mb-2 text-lg text-gray-700">Pàgina {res.page}</h3>
              {/* Modificat: Mostrem l'objecte 'analysis' com a JSON formatejat */}
              <pre className="whitespace-pre-wrap text-sm text-gray-800 bg-white p-3 rounded border border-gray-200 overflow-x-auto">
                {JSON.stringify(res.analysis, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
