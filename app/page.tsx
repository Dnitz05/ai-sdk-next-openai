'use client';

import { useState } from 'react';
import React from 'react';

// --- Component per Renderitzar la Resposta de Google Document AI (Versió Inicial) ---
function GoogleDocumentRenderer({ document }: { document: any }) {
  // Si no hi ha document, mostrem un missatge d'espera o error si n'hi hagués
  if (!document) return <p className="text-center text-gray-600 py-10">Esperant resultats de l'anàlisi...</p>;

  // Funció auxiliar per extreure text basat en els 'textAnchors' de Google
  // Aquesta funció és clau perquè Google retorna índexs dins del text complet.
  const getText = (textAnchor: any, fullText: string): string => {
      if (!textAnchor?.textSegments || !fullText) return '';
      let extractedText = '';
      for (const segment of textAnchor.textSegments) {
        // Convertim els índexs a número, assegurant-nos que són vàlids
        const startIndex = parseInt(segment.startIndex || '0', 10);
        const endIndex = parseInt(segment.endIndex || '0', 10);
        if (!isNaN(startIndex) && !isNaN(endIndex) && startIndex >= 0 && endIndex >= startIndex && endIndex <= fullText.length) {
             // Afegim el tros de text corresponent
             extractedText += fullText.substring(startIndex, endIndex);
        } else {
            // Advertim si un segment té índexs invàlids
            console.warn("Segment d'índex invàlid:", segment, `Longitud del text: ${fullText.length}`);
        }
      }
      // Retornem el text extret (sense trim inicialment per respectar espais originals)
      return extractedText;
  };

  // Renderització del document analitzat
  return (
    <div className="space-y-8">
      {/* Secció 1: Text Complet Extret */}
      <div>
        <h3 className="text-xl font-semibold mb-3 pb-2 border-b border-gray-300 text-gray-800">Text Complet Extret</h3>
        <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto font-mono shadow-inner max-h-96">
          {document.text ?? <span className="text-gray-500 italic">No s'ha trobat text.</span>}
        </pre>
      </div>

      {/* Secció 2: Taules Detectades (Renderització Bàsica) */}
      {/* Iterem per cada pàgina buscant taules */}
      {document.pages?.map((page: any, pageIndex: number) => (
        // Només mostrem la secció si hi ha taules en aquesta pàgina
        page.tables && page.tables.length > 0 && (
          <div key={`page-${pageIndex}-tables`}>
            <h3 className="text-xl font-semibold mb-4 mt-6 pb-2 border-b border-gray-300 text-gray-800">Taules Detectades - Pàgina {pageIndex + 1}</h3>
            {/* Iterem per cada taula dins de la pàgina */}
            {page.tables.map((table: any, tableIndex: number) => (
              <div key={`page-${pageIndex}-table-${tableIndex}`} className="overflow-x-auto mb-6 shadow-lg border border-gray-300 rounded bg-white">
                <table className="min-w-full text-xs border-collapse">
                  {/* Capçalera de la taula (si n'hi ha) */}
                  {table.headerRows?.map((hRow: any, hrIndex: number) => (
                    <thead key={`thead-${hrIndex}`} className="bg-gray-100 border-b-2 border-gray-400">
                      <tr className="divide-x divide-gray-300">
                        {/* Iterem per cel·les de capçalera */}
                        {hRow.cells?.map((cell: any, cIndex: number) => (
                          <th
                            key={`th-${hrIndex}-${cIndex}`}
                            className="px-3 py-2 border border-gray-300 text-left font-semibold text-gray-700"
                            // Respectem si una cel·la ocupa més d'una columna/fila
                            colSpan={cell.layout?.colspan || 1}
                            rowSpan={cell.layout?.rowspan || 1}
                          >
                             {/* Extraiem el text de la cel·la usant la funció getText */}
                             {getText(cell.layout?.textAnchor, document.text)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  ))}
                   {/* Cos de la taula */}
                   <tbody className="divide-y divide-gray-200">
                     {/* Iterem per files del cos */}
                     {table.bodyRows?.map((bRow: any, brIndex: number) => (
                       <tr key={`brow-${brIndex}`} className="divide-x divide-gray-200 hover:bg-blue-50 transition-colors duration-150">
                         {/* Iterem per cel·les del cos */}
                         {bRow.cells?.map((cell: any, cIndex: number) => (
                           <td
                             key={`bcell-${brIndex}-${cIndex}`}
                             className="px-3 py-2 border border-gray-200 align-top"
                             // Respectem colSpan/rowSpan
                             colSpan={cell.layout?.colspan || 1}
                             rowSpan={cell.layout?.rowspan || 1}
                           >
                              {/* Extraiem el text de la cel·la */}
                             {getText(cell.layout?.textAnchor, document.text)}
                           </td>
                         ))}
                       </tr>
                     ))}
                   </tbody>
                </table>
              </div>
            ))}
          </div>
        )
      ))}

      {/* Secció 3: JSON Complet (per a Depuració) */}
      {/* Podem comentar o eliminar aquesta secció quan ja no sigui necessària */}
      <div>
         <h3 className="text-xl font-semibold mb-3 mt-6 pb-2 border-b border-gray-300 text-gray-800">Resposta JSON Completa (Debug)</h3>
         <details className="bg-black rounded shadow-inner border border-gray-700">
             <summary className="text-sm text-gray-400 p-3 cursor-pointer hover:bg-gray-800 rounded-t">Mostra/Amaga JSON</summary>
             <pre className="whitespace-pre-wrap text-xs text-green-400 p-4 overflow-x-auto font-mono max-h-96">
                 {JSON.stringify(document, null, 2)}
             </pre>
         </details>
      </div>
    </div>
  );
}


// --- Component Principal de la Pàgina (`Page`) ---
export default function Page() {
  // Estats per gestionar el flux
  const [images, setImages] = useState<string[]>([]); // URLs de miniatures (opcional)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null); // URL del PDF original guardat (essencial)
  const [isLoadingUpload, setIsLoadingUpload] = useState(false); // Indicador de càrrega durant la pujada
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false); // Indicador durant l'anàlisi amb Google AI
  const [error, setError] = useState<string | null>(null); // Per mostrar missatges d'error
  const [analysisResult, setAnalysisResult] = useState<any | null>(null); // Aquí guardarem la resposta de Google Doc AI

  // Funció que s'executa quan l'usuari selecciona un fitxer PDF
  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return; // Si no hi ha fitxer, no fem res

    // Reiniciem estats abans de començar una nova pujada
    setIsLoadingUpload(true);
    setError(null);
    setImages([]);
    setPdfUrl(null);
    setAnalysisResult(null); // Netejar resultats previs

    // Creem FormData per enviar el fitxer
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Cridem a l'API per pujar el PDF (i opcionalment generar miniatures)
      const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData });

      // Gestionem si la resposta de l'API no és correcta (status != 2xx)
      if (!res.ok) {
        let errorData = { error: `Error ${res.status} processant PDF inicialment` };
        try { errorData = await res.json(); } catch (jsonError) { console.error("Error no JSON a /upload-pdf:", await res.text()); }
        throw new Error(errorData.error || `Error ${res.status}`);
      }

      // Si la resposta és correcta, extraiem les dades JSON
      const data = await res.json();

      // Validació clau: assegurar-nos que tenim la URL del PDF guardat
      if (!data.pdfUrl) {
         throw new Error("La resposta de l'API d'upload no ha retornat la pdfUrl necessària.");
      }

      // Actualitzem els estats amb les dades rebudes
      setImages(data.pages ?? []); // Guardem URLs de miniatures (pot ser array buit)
      setPdfUrl(data.pdfUrl); // Guardem URL del PDF original (essencial)

    } catch (err: any) {
       // Si hi ha qualsevol error durant la pujada, el capturem i mostrem
       console.error("Error durant handleUploadPdf:", err);
       setError(err.message || 'Error desconegut durant la pujada.');
       setPdfUrl(null); // Assegurem que no quedi una URL antiga si falla
    } finally {
       // Quan acaba (tant si va bé com si falla), traiem l'indicador de càrrega
       setIsLoadingUpload(false);
    }
  };

  // Funció que s'executa quan l'usuari clica el botó "Analitzar"
  const handleAnalyzeDocument = async () => {
    // Comprovació de seguretat: només procedim si tenim la URL del PDF
    if (!pdfUrl) {
        setError("Error intern: No hi ha URL de PDF per analitzar.");
        console.error("handleAnalyzeDocument cridat sense pdfUrl. Això no hauria de passar.");
        return;
    }

    // Iniciem l'estat de càrrega per a l'anàlisi
    setIsLoadingAnalysis(true);
    setError(null); // Netegem errors anteriors
    setAnalysisResult(null); // Netegem resultats anteriors

    try {
      // Cridem al NOU endpoint d'anàlisi, passant la URL del PDF al cos JSON
      const res = await fetch('/api/analyze-document-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfUrl }), // Enviem la URL del PDF original
      });

      // Gestionem si la resposta de l'API d'anàlisi no és correcta
      if (!res.ok) {
          let errorData = { error: `Error ${res.status} analitzant amb Document AI` };
           try { errorData = await res.json(); } catch(jsonError) { console.error("Error no JSON a /analyze-document-ai:", await res.text()); }
          throw new Error(errorData.error || `Error ${res.status}`);
      }

      // Si la resposta és correcta, extraiem les dades JSON
      const data = await res.json();

       // Validació important: comprovem que la resposta té l'estructura esperada
       if (!data || !data.result || typeof data.result !== 'object') {
          console.error("Resposta invàlida de /api/analyze-document-ai:", data);
          throw new Error("La resposta de l'API d'anàlisi no té l'estructura esperada ('result' object).");
       }

      // Actualitzem l'estat amb els resultats rebuts de Google Document AI
      setAnalysisResult(data.result); // Guardem tot l'objecte 'document'

    } catch (err: any) {
        // Si hi ha qualsevol error durant l'anàlisi, el capturem i mostrem
        console.error("Error durant handleAnalyzeDocument:", err);
        setError('Error durant l’anàlisi amb Google AI: ' + err.message);
    } finally {
        // Quan acaba l'anàlisi (bé o malament), traiem l'indicador de càrrega
        setIsLoadingAnalysis(false);
    }
  };

  // ---- Renderització del component Page ----
  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 bg-gradient-to-b from-gray-50 to-blue-50 min-h-screen">
      {/* Capçalera */}
      <header className="text-center pt-8 pb-4">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight">
              Analitzador Intel·ligent de PDF
          </h1>
          <p className="text-md md:text-lg text-gray-600 mt-3">Puja un document per extreure text i taules usant <span className="font-semibold text-blue-600">Google Document AI</span></p>
      </header>

      {/* Secció 1: Pujar Document */}
      <section aria-labelledby="upload-section-title" className="p-6 border rounded-xl shadow-xl bg-white">
         <h2 id="upload-section-title" className="text-xl font-semibold text-gray-700 mb-5 flex items-center">
             <span className="bg-blue-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">1</span> Pujar Document
         </h2>
         {/* Input per seleccionar fitxer */}
         <input
            id="pdf-upload" type="file" accept="application/pdf" onChange={handleUploadPdf}
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-800 hover:file:bg-blue-200 active:file:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out"
            disabled={isLoadingUpload || isLoadingAnalysis} // Deshabilitat mentre es carrega o analitza
          />
         {/* Zona per a missatges d'estat/error de la pujada */}
         <div className="mt-4 text-center h-6">
             {isLoadingUpload && <p className="text-sm text-blue-600 font-medium animate-pulse">⏳ Carregant i processant PDF...</p>}
             {error && !isLoadingUpload && <p className="text-sm text-red-600 font-semibold">⚠️ Error Pujada: {error}</p>}
             {pdfUrl && !isLoadingUpload && !error && !analysisResult && <p className="text-sm text-green-700 font-medium">✅ PDF pujat correctament. Preparat per analitzar.</p>}
         </div>
      </section>

       {/* Secció 2: Accions (Previsualització i Botó Analitzar) */}
       {/* Aquesta secció només apareix si tenim una URL de PDF vàlida i no hi ha error */}
       {pdfUrl && !isLoadingUpload && !error && (
         <section aria-labelledby="action-section-title" className="mt-6 p-6 border rounded-xl shadow-xl bg-white">
            {/* Títol de la secció */}
            <h2 id="action-section-title" className="text-xl font-semibold text-gray-700 mb-5 flex items-center">
                <span className="bg-blue-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">2</span> Accions
            </h2>

            {/* Miniatures (només si n'hi ha) */}
            {images && images.length > 0 && (
              <div className="mb-6">
                <h3 className="text-md font-medium text-gray-600 mb-3">Previsualització (primeres pàgines via CloudConvert):</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 bg-gray-100 p-4 rounded-lg border">
                  {images.map((src, idx) => (
                     <a href={src} target="_blank" rel="noopener noreferrer" key={`thumb-${idx}`} className="block border rounded-md overflow-hidden shadow hover:shadow-lg transition-shadow duration-200 bg-white group">
                       <img src={src} alt={`Miniatura pàgina ${idx + 1}`} loading="lazy" className="w-full h-auto object-contain p-1 group-hover:opacity-80 transition-opacity" />
                       <p className="text-center text-xs font-medium py-1 px-2 bg-gray-50 border-t">P. {idx + 1}</p>
                     </a>
                   ))}
                </div>
              </div>
            )}

            {/* Botó per iniciar l'anàlisi */}
            <div className={`text-center ${images && images.length > 0 ? 'pt-6 border-t' : 'pt-2'}`}>
                 <button
                    onClick={handleAnalyzeDocument}
                    className={`px-8 py-3 text-base font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 ease-in-out transform hover:scale-105 disabled:scale-100 ${isLoadingAnalysis || !!analysisResult ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800 focus:ring-indigo-500'}`}
                    disabled={isLoadingAnalysis || isLoadingUpload || !!analysisResult} // Deshabilitat en carregar, analitzar o si ja hi ha resultats
                  >
                    {isLoadingAnalysis ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Analitzant...
                        </span>
                    ) : (analysisResult ? 'Anàlisi Completada' : 'Analitzar Document amb Google AI')}
                 </button>
                 {/* Indicador d'anàlisi en curs (es mostra sota el botó) */}
                 {isLoadingAnalysis && (
                    <p className="text-sm text-blue-600 font-medium mt-4 flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>Processant amb Google AI... pot trigar una mica...</span>
                    </p>
                )}
            </div>
         </section>
       )}


       {/* Secció 3: Resultats de l'Anàlisi */}
       {/* Només es mostra si tenim resultats i no hi ha càrregues en curs */}
       {analysisResult && !isLoadingUpload && !isLoadingAnalysis && (
         <section aria-labelledby="results-section-title" className="mt-10 mb-10">
           <h2 id="results-section-title" className="text-2xl font-semibold text-gray-800 border-b pb-4 mb-6 flex items-center">
                <span className="bg-blue-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">3</span> Resultats de l'Anàlisi
           </h2>
           {/* Missatge d'error específic de l'anàlisi (si n'hi ha hagut) */}
           {error && <p className="text-center text-red-600 font-semibold mb-6">⚠️ Error Anàlisi: {error}</p>}
           {/* El component que renderitza els resultats */}
           <article aria-label="Document Analitzat" className="bg-white p-6 md:p-8 rounded-xl border border-gray-200 shadow-xl">
              <GoogleDocumentRenderer document={analysisResult} />
           </article>
         </section>
       )}
    </main>
  );
}
 
