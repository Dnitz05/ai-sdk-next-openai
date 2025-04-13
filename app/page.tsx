// app/page.tsx
'use client';

import React, { useState, ChangeEvent } from 'react';

export default function Home() {
  // Estats
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null); // Només per mostrar el nom
  const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mammothMessages, setMammothMessages] = useState<any[]>([]);

  // Funció separada per gestionar la càrrega i conversió asíncrona
  const triggerUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setConvertedHtml(null);
    setMammothMessages([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/process-document', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get("content-type");

      if (!response.ok) {
        let errorPayload: any = { error: `Error del servidor: ${response.status} ${response.statusText}` };
        if (contentType && contentType.includes("application/json")) {
          try { errorPayload = await response.json(); } catch (e) { console.error("Error llegint error JSON", e); }
        } else {
          try {
             const rawErrorText = await response.text();
             console.error("Resposta d'error no JSON rebuda del backend:", rawErrorText);
             errorPayload.details = "Resposta d'error inesperada rebuda del servidor.";
          } catch (e) { console.error("Error llegint error Text", e); }
        }
        throw new Error(errorPayload.error || JSON.stringify(errorPayload));
      }

      if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          // Log per depurar l'HTML rebut al navegador
          console.log("==== Snippet HTML Rebut del Backend ====");
          console.log(data.htmlSnippet || "No s'ha rebut cap snippet.");
          console.log("=======================================");
          setConvertedHtml(data.html);
          setMammothMessages(data.messages || []);
      } else {
          const rawText = await response.text();
          console.warn("Resposta OK però no és JSON:", rawText);
          throw new Error("Format de resposta inesperat rebut del servidor (no era JSON).");
      }

    } catch (err) {
      console.error("Error durant el processament:", err);
      setError(err instanceof Error ? err.message : 'Error desconegut durant la càrrega');
      setConvertedHtml(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Gestor de canvi de l'input de fitxer
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFileName(file.name);

      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        setError(null);
        triggerUpload(file);
      } else {
        setError('Si us plau, selecciona un fitxer .docx');
        setConvertedHtml(null);
        setMammothMessages([]);
        setSelectedFileName('Cap fitxer seleccionat');
      }
    } else {
      setSelectedFileName(null);
    }
    event.target.value = '';
  };

  // JSX
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-12 lg:p-16 bg-gray-200"> {/* Fons gris */}
      {/* Contenidor blanc central, més estret per simular marges A4 */}
      <div className="w-full max-w-2xl bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-8"> {/* Canviat a max-w-2xl */}

        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
           Visor de Documents (.docx)
        </h1>

        {/* Àrea de càrrega */}
        <div className="mb-8 p-6 border border-gray-200 rounded-md bg-gray-50">
          <div className="mb-4">
            <label htmlFor="fileInput" className="block text-sm font-medium text-gray-700 mb-1 cursor-pointer hover:text-blue-600 transition-colors duration-200">
              {selectedFileName ? `Fitxer carregat: ${selectedFileName}` : 'Clica aquí per seleccionar un fitxer .docx'}
            </label>
            <input
              type="file"
              id="fileInput"
              onChange={handleFileChange}
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
            />
          </div>
          {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
        </div>

        {/* Indicador de càrrega */}
        {isLoading && (
          <div className="text-center my-6">
            <p className="text-blue-600 animate-pulse">Processant: {selectedFileName}...</p>
          </div>
        )}

        {/* Àrea de resultats */}
        <div className="mt-6">
          {convertedHtml ? (
            <div
              className="prose prose-sm max-w-none" // Mantenim prose-sm i max-w-none per ara, ajusta si cal
              dangerouslySetInnerHTML={{ __html: convertedHtml }}
            />
          ) : (
            !isLoading && <p className="text-gray-500 italic text-center">Selecciona un fitxer .docx per visualitzar-ne el contingut.</p>
          )}
        </div>

        {/* Àrea de missatges de Mammoth */}
        {mammothMessages && mammothMessages.length > 0 && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-orange-600 mb-2">Missatges de la Conversió:</h3>
            <ul className="list-disc list-inside text-sm text-orange-700 bg-orange-50 p-4 rounded-md">
              {mammothMessages.map((msg, index) => (
                <li key={index}><strong>{msg.type}:</strong> {msg.message}</li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </main>
  );
}