// app/page.tsx
'use client';

import React, { useState, ChangeEvent, useEffect } from 'react'; // Assegura't que useEffect hi és

export default function Home() {
  // Estats
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mammothMessages, setMammothMessages] = useState<any[]>([]);
  const [isMounted, setIsMounted] = useState(false); // Estat per renderitzat client

  // useEffect per canviar l'estat només al client
  useEffect(() => {
    setIsMounted(true);
  }, []); // <-- Només un tancament correcte aquí

  // Funció triggerUpload
  const triggerUpload = async (file: File) => {
    setIsLoading(true); setError(null); setConvertedHtml(null); setMammothMessages([]);
    const formData = new FormData(); formData.append('file', file);
    try {
      const response = await fetch('/api/process-document', { method: 'POST', body: formData });
      const contentType = response.headers.get("content-type");
      if (!response.ok) {
        let errorPayload: any = { error: `Error del servidor: ${response.status} ${response.statusText}` };
        if (contentType && contentType.includes("application/json")) { try { errorPayload = await response.json(); } catch (e) { console.error("Error llegint error JSON", e); }} else { try { const rawErrorText = await response.text(); console.error("Resposta d'error no JSON:", rawErrorText); errorPayload.details = "Error inesperat."; } catch (e) { console.error("Error llegint error Text", e); }}
        throw new Error(errorPayload.error || JSON.stringify(errorPayload));
      }
      if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          // Pots descomentar això si tornes a necessitar depurar l'HTML al navegador
          // console.log("==== Snippet HTML Rebut del Backend ===="); console.log(data.htmlSnippet || "No snippet."); console.log("=======================================");
          setConvertedHtml(data.html); setMammothMessages(data.messages || []);
      } else { const rawText = await response.text(); console.warn("Resposta OK però no és JSON:", rawText); throw new Error("Format de resposta inesperat."); }
    } catch (err) { console.error("Error processant:", err); setError(err instanceof Error ? err.message : 'Error desconegut'); setConvertedHtml(null);
    } finally { setIsLoading(false); }
  };

  // Funció handleFileChange
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]; setSelectedFileName(file.name);
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { setError(null); triggerUpload(file); } else { setError('Si us plau, selecciona un fitxer .docx'); setConvertedHtml(null); setMammothMessages([]); setSelectedFileName('Cap fitxer seleccionat'); }
    } else { setSelectedFileName(null); }
    event.target.value = '';
  };

  // JSX
  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100"> {/* Fons gris */}
      {/* Capçalera WEB */}
      <div className="web-header w-full max-w-xl mx-auto flex items-center justify-between mb-4 sm:mb-6 px-1"> {/* Amplada ajustada */}
        <h2 className="text-base sm:text-lg font-semibold text-gray-600">
          Nova Plantilla des de DOCX
        </h2>
        <div>
          <label htmlFor="fileInput" className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white ${isLoading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition ease-in-out duration-150 ${isLoading ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            {isLoading ? 'Processant...' : (selectedFileName ? 'Canvia Fitxer' : 'Selecciona Fitxer')}
          </label>
          <input type="file" id="fileInput" onChange={handleFileChange} accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" disabled={isLoading} />
        </div>
      </div>
      {/* Capçalera/Peu Impressió */}
      <div id="print-header" className="hidden print:block w-full max-w-xl mx-auto mb-4 text-center text-xs text-gray-500">Informe Generat - {new Date().toLocaleDateString()}</div>
      <div id="print-footer" className="hidden print:block w-full max-w-xl mx-auto mt-8 text-center text-xs text-gray-500">Document Intern</div>
      {/* Error */}
       {error && <p className="web-error w-full max-w-xl mx-auto text-sm text-red-600 text-center mb-4 -mt-2">{error}</p>}
      {/* "Foli" Blanc */}
      <div className="print-content w-full max-w-xl bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-4"> {/* Amplada ajustada */}
        {/* Indicador de càrrega */}
        {isLoading && ( <div className="text-center my-6"><p className="text-blue-600 animate-pulse">Processant: {selectedFileName}...</p></div> )}
        {/* Àrea de Resultats */}
        <div className="mt-1">
          {/* Renderitzat condicional només al client */}
          {isMounted && convertedHtml ? (
            <div
              className="prose prose-sm max-w-none" // Revisa classes prose
              dangerouslySetInnerHTML={{ __html: convertedHtml }}
            />
          ) : (
            !isLoading && !error && <p className="text-gray-400 italic text-center py-10">Selecciona un fitxer .docx per començar.</p>
          )}
        </div>
        {/* Àrea de Missatges de Mammoth */}
        {mammothMessages && mammothMessages.length > 0 && ( <div className="mt-6 border-t border-gray-200 pt-6"><h3 className="text-lg font-semibold text-orange-600 mb-2">Missatges de la Conversió:</h3><ul className="list-disc list-inside text-sm text-orange-700 bg-orange-50 p-4 rounded-md">{mammothMessages.map((msg, index) => (<li key={index}><strong>{msg.type}:</strong> {msg.message}</li>))}</ul></div> )}
      </div> {/* Fi del "Foli" Blanc */}
    </main>
  );
} // <-- Assegura't que aquesta és l'última clau del component Home