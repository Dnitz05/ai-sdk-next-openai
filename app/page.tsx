// app/page.tsx
'use client';

import React, { useState, ChangeEvent, useEffect } from 'react'; // <<-- AFEGIR useEffect

export default function Home() {
  // Estats
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mammothMessages, setMammothMessages] = useState<any[]>([]);

  // <<< NOU ESTAT per controlar si el component està muntat al client >>>
  const [isMounted, setIsMounted] = useState(false);

  // <<< useEffect per canviar l'estat només al client >>>
  useEffect(() => {
    setIsMounted(true); // Aquesta línia només s'executa al navegador, no al servidor
  }, []); // L'array buit fa que s'executi només un cop després del muntatge inicial, si

  // Funció triggerUpload (sense canvis interns, però traiem el log de snippet si ja no cal)
  const triggerUpload = async (file: File) => {
    setIsLoading(true); setError(null); setConvertedHtml(null); setMammothMessages([]);
    const formData = new FormData(); formData.append('file', file);
    try {
      const response = await fetch('/api/process-document', { method: 'POST', body: formData });
      const contentType = response.headers.get("content-type");
      if (!response.ok) { /* ... gestió d'errors ... */ throw new Error(/* ... */); }
      if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          // Ja no necessitem el snippet, podem treure el console.log
          // console.log("==== Snippet HTML Rebut del Backend ===="); console.log(data.htmlSnippet || "No snippet."); console.log("=======================================");
          setConvertedHtml(data.html); setMammothMessages(data.messages || []);
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
      <div className="web-header w-full max-w-2xl mx-auto flex items-center justify-between mb-4 sm:mb-6 px-1"> {/* Amplada ajustada */}
        {/* ... títol i botó/label ... */}
      </div>
      {/* Capçalera/Peu Impressió */}
      <div id="print-header" className="hidden print:block ...">...</div>
      <div id="print-footer" className="hidden print:block ...">...</div>
      {/* Error */}
      {error && <p className="web-error ...">{error}</p>}

      {/* "Foli" Blanc */}
      <div className="print-content w-full max-w-2xl bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-4"> {/* Amplada ajustada */}
        {/* Indicador de càrrega */}
        {isLoading && ( /* ... */ )}

        {/* Àrea de Resultats */}
        <div className="mt-1">
          {/* <<< CONDICIONAL AMB isMounted >>> */}
          {isMounted && convertedHtml ? (
            <div
              className="prose prose-sm max-w-none" // Ajusta classes prose segons necessitis
              dangerouslySetInnerHTML={{ __html: convertedHtml }}
            />
          ) : (
            // Mostra text inicial o indicador de càrrega si no està muntat o no hi ha HTML
            !isLoading && !error && <p className="text-gray-400 italic text-center py-10">Selecciona un fitxer .docx per començar.</p>
          )}
          {/* <<< FI CONDICIONAL >>> */}
        </div>

        {/* Àrea de Missatges de Mammoth */}
        {mammothMessages && mammothMessages.length > 0 && ( /* ... */ )}
      </div>
    </main>
  );
}
