// app/page.tsx
'use client';

import React, { useState, ChangeEvent } from 'react'; // <<-- Eliminat useEffect

export default function Home() {
  // Estats
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mammothMessages, setMammothMessages] = useState<any[]>([]);

  // <<< Eliminat estat isMounted >>>
  // <<< Eliminat useEffect >>>

  // Funció triggerUpload (Sense el console.log de snippet)
  const triggerUpload = async (file: File) => {
    setIsLoading(true); setError(null); setConvertedHtml(null); setMammothMessages([]);
    const formData = new FormData(); formData.append('file', file);
    try {
      const response = await fetch('/api/process-document', { method: 'POST', body: formData });
      const contentType = response.headers.get("content-type");
      if (!response.ok) { /* ... gestió d'errors ... */ throw new Error(/* ... */); }
      if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          // console.log(data.htmlSnippet ... ) // <-- Eliminat (ja no s'envia snippet)
          setConvertedHtml(data.html); // Rep l'HTML ja netejat
          setMammothMessages(data.messages || []);
      } else { /* ... gestió error no json ... */ throw new Error(/* ... */); }
    } catch (err) { /* ... gestió error catch ... */ }
     finally { setIsLoading(false); }
  };

  // Funció handleFileChange (sense canvis)
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => { /* ... */ };

  // JSX
  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">
      {/* Capçalera WEB */}
      <div className="web-header w-full max-w-2xl mx-auto flex items-center justify-between mb-4 sm:mb-6 px-1">
         {/* ... títol i botó/label ... */}
          <h2 className="text-base sm:text-lg font-semibold text-gray-600">Nova Plantilla des de DOCX</h2>
          <div><label htmlFor="fileInput" className={`inline-flex items-center...`}>{isLoading ? 'Processant...' : (selectedFileName ? 'Canvia Fitxer' : 'Selecciona Fitxer')}</label><input type="file" id="fileInput" onChange={handleFileChange} accept=".docx..." className="hidden" disabled={isLoading} /></div>
      </div>
      {/* Capçalera/Peu Impressió */}
      <div id="print-header" className="hidden print:block ...">Informe Generat - {new Date().toLocaleDateString()}</div>
      <div id="print-footer" className="hidden print:block ...">Document Intern</div>
      {/* Error */}
      {error && <p className="web-error w-full max-w-2xl mx-auto text-sm text-red-600 text-center mb-4 -mt-2">{error}</p>}
      {/* "Foli" Blanc */}
      <div className="print-content w-full max-w-2xl bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-4">
        {/* Indicador de càrrega */}
        {isLoading && ( <div className="text-center my-6"><p className="text-blue-600 animate-pulse">Processant: {selectedFileName}...</p></div> )}
        {/* Àrea de Resultats */}
        <div className="mt-1">
          {/* <<< Eliminat condicional isMounted >>> */}
          {convertedHtml ? ( // <<-- Ara només comprovem si hi ha HTML
            <div
              className="prose prose-sm max-w-none" // Revisa classes prose
              dangerouslySetInnerHTML={{ __html: convertedHtml }}
            />
          ) : (
            !isLoading && !error && <p className="text-gray-400 italic text-center py-10">Selecciona un fitxer .docx per començar.</p>
          )}
        </div>
        {/* Àrea de Missatges de Mammoth */}
        {mammothMessages && mammothMessages.length > 0 && ( <div className="mt-6 border-t ..."> {/* ... */} </div> )}
      </div>
    </main>
  );
}