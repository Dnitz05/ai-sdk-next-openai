// app/page.tsx
'use client';

import React, { useState, ChangeEvent } from 'react'; // Eliminat FormEvent

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [mammothMessages, setMammothMessages] = useState<any[]>([]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
     if (event.target.files && event.target.files[0]) {
       const file = event.target.files[0];
       if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          setSelectedFile(file);
          setError(null);
          setConvertedHtml(null);
          setMammothMessages([]);
       } else {
          setSelectedFile(null);
          setError('Si us plau, selecciona un fitxer .docx');
          setConvertedHtml(null);
          setMammothMessages([]);
       }
     } else {
       setSelectedFile(null);
     }
  };

  // Canviem el nom de la funció per claredat, ja no és un 'submit' de formulari
  const handleUpload = async () => {
    // event.preventDefault(); // Ja no és necessari perquè no hi ha formulari

    if (!selectedFile) {
      setError('Primer has de seleccionar un fitxer .docx');
      return;
    }

    setIsLoading(true);
    setError(null);
    setConvertedHtml(null);
    setMammothMessages([]);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/process-document', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get("content-type");

      if (!response.ok) {
          let errorPayload: any = { error: `Error del servidor: ${response.status} ${response.statusText}`};
          if (contentType && contentType.includes("application/json")) {
               errorPayload = await response.json();
          } else {
              const rawErrorText = await response.text();
              console.error("Resposta d'error no JSON rebuda del backend:", rawErrorText);
              errorPayload.details = "Resposta d'error inesperada rebuda del servidor. Revisa la consola del navegador i els logs del backend.";
          }
          throw new Error(errorPayload.error || JSON.stringify(errorPayload));
      }

      if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
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

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 lg:p-24 bg-gray-100">
      <div className="w-full max-w-4xl bg-white shadow-xl rounded-lg p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
          Visor de Documents (.docx)
        </h1>

        {/* Eliminem l'etiqueta <form> i utilitzem un div simple */}
        <div className="mb-8 p-6 border border-gray-200 rounded-md bg-gray-50">
          <div className="mb-4">
            <label htmlFor="fileInput" className="block text-sm font-medium text-gray-700 mb-2">
              Selecciona un fitxer .docx:
            </label>
            <input
              type="file"
              id="fileInput"
              onChange={handleFileChange}
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              // required ja no aplica directament sense formulari, la validació es fa a handleUpload
            />
          </div>

          {/* Canviem a un botó normal amb onClick */}
          <button
            type="button" // Important: canviar de 'submit' a 'button'
            onClick={handleUpload} // Cridem la funció directament amb onClick
            disabled={isLoading || !selectedFile}
            className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
          >
            {isLoading ? 'Processant...' : 'Converteix i Mostra'}
          </button>

          {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
        </div>
        {/* ... resta del component (indicador de càrrega, àrea de resultats, missatges de mammoth) ... */}
         {/* Indicador de càrrega */}
         {isLoading && <p className="text-center text-blue-600 my-4">Processant el document, si us plau espera...</p>}

         {/* Àrea per mostrar l'HTML convertit */}
         <div className="mt-6 border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Resultat de la Conversió:</h2>
            {convertedHtml ? (
                <div
                    className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none"
                    dangerouslySetInnerHTML={{ __html: convertedHtml }}
                />
            ) : (
                !isLoading && <p className="text-gray-500 italic">Aquí es mostrarà el contingut del document convertit.</p>
            )}
         </div>

         {/* Mostra missatges de Mammoth si n'hi ha */}
         {mammothMessages && mammothMessages.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-orange-600 mb-2">Missatges de la Conversió (Mammoth):</h3>
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