'use client';

import { useState } from 'react';
import React from 'react';

// --- Component per Renderitzar la Resposta de Google Document AI (Versió Inicial) ---
// (Aquest component i la funció getText queden igual que a l'última versió)
function GoogleDocumentRenderer({ document }: { document: any }) {
  if (!document) return <p className="text-center text-gray-600 py-10">Esperant resultats de l'anàlisi...</p>;
  const getText = (textAnchor: any, fullText: string): string => { /* ... (codi igual que abans) ... */
      if (!textAnchor?.textSegments || !fullText) return ''; let extractedText = '';
      for (const segment of textAnchor.textSegments) {
        const startIndex = parseInt(segment.startIndex || '0', 10); const endIndex = parseInt(segment.endIndex || '0', 10);
        if (!isNaN(startIndex) && !isNaN(endIndex) && startIndex >= 0 && endIndex >= startIndex && endIndex <= fullText.length) { extractedText += fullText.substring(startIndex, endIndex);
        } else { console.warn("Segment d'índex invàlid:", segment, `Longitud del text: ${fullText.length}`); }
      } return extractedText; };
  return ( <div className="space-y-8"> <div> <h3 className="text-xl font-semibold mb-3 pb-2 border-b border-gray-300 text-gray-800">Text Complet Extret</h3> <pre className="whitespace-pre-wrap text-sm bg-gray-100 p-4 rounded border border-gray-200 overflow-x-auto font-mono shadow-inner max-h-96"> {document.text ?? <span className="text-gray-500 italic">No s'ha trobat text.</span>} </pre> </div> {document.pages?.map((page: any, pageIndex: number) => ( page.tables && page.tables.length > 0 && ( <div key={`page-${pageIndex}-tables`}> <h3 className="text-xl font-semibold mb-4 mt-6 pb-2 border-b border-gray-300 text-gray-800">Taules Detectades - Pàgina {pageIndex + 1}</h3> {page.tables.map((table: any, tableIndex: number) => ( <div key={`page-${pageIndex}-table-${tableIndex}`} className="overflow-x-auto mb-5 shadow-lg border border-gray-300 rounded bg-white"> <table className="min-w-full text-xs border-collapse"> {table.headerRows?.map((hRow: any, hrIndex: number) => ( <thead key={`thead-${hrIndex}`} className="bg-gray-200 border-b-2 border-gray-400"> <tr className="divide-x divide-gray-300"> {hRow.cells?.map((cell: any, cIndex: number) => ( <th key={`th-${hrIndex}-${cIndex}`} className="px-3 py-2 border border-gray-300 text-left font-semibold text-gray-700" colSpan={cell.layout?.colspan || 1} rowSpan={cell.layout?.rowspan || 1} > {getText(cell.layout?.textAnchor, document.text)} </th> ))} </tr> </thead> ))} <tbody className="divide-y divide-gray-200"> {table.bodyRows?.map((bRow: any, brIndex: number) => ( <tr key={`brow-${brIndex}`} className="divide-x divide-gray-200 hover:bg-blue-50 transition-colors duration-150"> {bRow.cells?.map((cell: any, cIndex: number) => ( <td key={`bcell-${brIndex}-${cIndex}`} className="px-3 py-2 border border-gray-200 align-top" colSpan={cell.layout?.colspan || 1} rowSpan={cell.layout?.rowspan || 1} > {getText(cell.layout?.textAnchor, document.text)} </td> ))} </tr> ))} </tbody> </table> </div> ))} </div> ) ))} <div> <h3 className="text-xl font-semibold mb-3 mt-6 pb-2 border-b border-gray-300 text-gray-800">Resposta JSON Completa (Debug)</h3> <details className="bg-black rounded shadow-inner border border-gray-700"> <summary className="text-sm text-gray-400 p-3 cursor-pointer hover:bg-gray-800 rounded-t">Mostra/Amaga JSON</summary> <pre className="whitespace-pre-wrap text-xs text-green-400 p-4 overflow-x-auto font-mono max-h-96"> {JSON.stringify(document, null, 2)} </pre> </details> </div> </div> );
}


// --- Component Principal de la Pàgina (`Page`) ---
export default function Page() {
  const [images, setImages] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);

  // === INICI GESTIÓ D'ERRORS DE FETCH MILLORADA ===
  async function handleApiResponse(res: Response, context: string): Promise<any> {
      if (res.ok) {
          // Si la resposta és OK (2xx), intentem parsejar JSON
          try {
              return await res.json(); // Llegim el body com a JSON (primera i única lectura)
          } catch (jsonError: any) {
              console.error(`Error parsejant JSON (${context}):`, jsonError);
              // Si falla el parseig de JSON tot i ser status OK, llencem error
              throw new Error(`La resposta del servidor (${context}) era invàlida (no JSON).`);
          }
      } else {
          // Si la resposta NO és OK (error 4xx o 5xx)
          let errorMessage = `Error ${res.status} (${context})`;
          try {
              // Intentem llegir el body com a TEXT (primera i única lectura)
              const errorText = await res.text();
              try {
                  // Intentem parsejar aquest text com a JSON (per si el backend envia error JSON)
                  const errorJson = JSON.parse(errorText);
                  errorMessage = errorJson.error || errorText || errorMessage; // Prioritzem missatge d'error del JSON
              } catch (parseError) {
                  // Si no és JSON, usem el text cru (si n'hi ha)
                  errorMessage = errorText || errorMessage;
                  console.warn(`Resposta d'error no JSON (${context}):`, errorText);
              }
          } catch (readError: any) {
              console.error(`No s'ha pogut llegir resposta d'error (${context}):`, readError);
              errorMessage = `Error ${res.status} (${context}, resposta no llegible)`;
          }
          // Llencem l'error amb el missatge més detallat possible
          throw new Error(errorMessage);
      }
  }
  // === FI GESTIÓ D'ERRORS DE FETCH MILLORADA ===


  // Gestor de pujada de PDF (Utilitza handleApiResponse)
  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsLoadingUpload(true); setError(null); setImages([]); setPdfUrl(null); setAnalysisResult(null);
    const formData = new FormData(); formData.append('file', file);

    try {
      console.log("Frontend: Iniciant POST a /api/upload-pdf");
      const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
      console.log(`Frontend: Resposta de /api/upload-pdf: ${res.status}`);
      // Usem la nova funció per gestionar la resposta
      const data = await handleApiResponse(res, "/api/upload-pdf");
      console.log("Frontend: Dades rebudes de /api/upload-pdf:", data);

      if (!data.pdfUrl) { throw new Error("L'API d'upload no ha retornat la pdfUrl."); }
      setImages(data.pages ?? []);
      setPdfUrl(data.pdfUrl);

    } catch (err: any) {
       console.error("Frontend: Error durant handleUploadPdf:", err);
       setError(err.message || 'Error desconegut durant la pujada.');
       setPdfUrl(null);
    } finally {
       setIsLoadingUpload(false);
    }
  };

  // Gestor per analitzar el Document amb Google Document AI (Utilitza handleApiResponse)
  const handleAnalyzeDocument = async () => {
    if (!pdfUrl) { setError("Error intern: No hi ha URL de PDF."); console.error("handleAnalyzeDocument sense pdfUrl."); return; }
    setIsLoadingAnalysis(true); setError(null); setAnalysisResult(null);

    try {
      console.log(`Frontend: Iniciant POST a /api/analyze-document-ai amb pdfUrl: ${pdfUrl}`);
      const res = await fetch('/api/analyze-document-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pdfUrl }), });
      console.log(`Frontend: Resposta de /api/analyze-document-ai: ${res.status}`);
       // Usem la nova funció per gestionar la resposta
      const data = await handleApiResponse(res, "/api/analyze-document-ai");
      console.log("Frontend: Dades rebudes de /api/analyze-document-ai:", data);

       if (!data || !data.result || typeof data.result !== 'object') { throw new Error("L'API d'anàlisi no ha retornat l'estructura esperada."); }
      setAnalysisResult(data.result);

    } catch (err: any) {
        console.error("Frontend: Error durant handleAnalyzeDocument:", err);
        setError('Error durant l’anàlisi: ' + err.message);
    } finally {
        setIsLoadingAnalysis(false);
    }
  };

  // Renderització JSX (Sense canvis respecte l'última versió completa)
  return (
     <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 bg-gradient-to-b from-gray-50 to-blue-50 min-h-screen">
       <header className="text-center pt-8 pb-4"> <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight"> Analitzador Intel·ligent de PDF </h1> <p className="text-md md:text-lg text-gray-600 mt-3">Puja un document per extreure text i taules usant <span className="font-semibold text-blue-600">Google Document AI</span></p> </header>
       <section aria-labelledby="upload-section-title" className="p-6 border rounded-xl shadow-lg bg-white"> <h2 id="upload-section-title" className="text-xl font-semibold text-gray-700 mb-4 flex items-center"> <span className="bg-blue-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">1</span> Pujar Document </h2> <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleUploadPdf} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-800 hover:file:bg-blue-200 active:file:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out" disabled={isLoadingUpload || isLoadingAnalysis} /> <div className="mt-4 text-center h-6"> {isLoadingUpload && <p className="text-sm text-blue-600 font-medium animate-pulse">⏳ Carregant i processant PDF...</p>} {error && !isLoadingUpload && !isLoadingAnalysis && <p className="text-sm text-red-600 font-semibold">⚠️ Error: {error}</p>} {pdfUrl && !isLoadingUpload && !error && !analysisResult && <p className="text-sm text-green-700 font-medium">✅ PDF pujat. Preparat per analitzar.</p>} </div> </section>
       {(pdfUrl || (images && images.length > 0)) && !isLoadingUpload && !error && ( <section aria-labelledby="action-section-title" className="mt-6 p-6 border rounded-xl shadow-lg bg-white"> <h2 id="action-section-title" className="text-xl font-semibold text-gray-700 mb-5 flex items-center"> <span className="bg-blue-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">2</span> Accions </h2> {images && images.length > 0 && ( <div className="mb-6"> <h3 className="text-md font-medium text-gray-600 mb-3">Previsualització (primeres pàgines via CloudConvert):</h3> <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 bg-gray-100 p-4 rounded-lg border"> {images.map((src, idx) => ( <a href={src} target="_blank" rel="noopener noreferrer" key={`thumb-${idx}`} className="block border rounded-md overflow-hidden shadow hover:shadow-lg transition-shadow duration-200 bg-white group"> <img src={src} alt={`Miniatura pàgina ${idx + 1}`} loading="lazy" className="w-full h-auto object-contain p-1 group-hover:opacity-80 transition-opacity" /> <p className="text-center text-xs font-medium py-1 px-2 bg-gray-50 border-t">P. {idx + 1}</p> </a> ))} </div> </div> )} {pdfUrl && ( <div className={`text-center ${images && images.length > 0 ? 'pt-6 border-t' : 'pt-2'}`}> <button onClick={handleAnalyzeDocument} className={`px-8 py-3 text-base font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 ease-in-out transform hover:scale-105 disabled:scale-100 ${isLoadingAnalysis || !!analysisResult ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800 focus:ring-indigo-500'}`} disabled={isLoadingAnalysis || isLoadingUpload || !!analysisResult} > {isLoadingAnalysis ? ( <span className="flex items-center justify-center"> <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Analitzant... </span> ) : (analysisResult ? 'Anàlisi Completada' : 'Analitzar Document amb Google AI')} </button> {isLoadingAnalysis && ( <p className="text-sm text-blue-600 font-medium mt-4 flex items-center justify-center space-x-2"> <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>Processant amb Google AI... pot trigar uns segons o minuts...</span> </p> )} </div> )} </section> )}
       {analysisResult && !isLoadingUpload && !isLoadingAnalysis && ( <section aria-labelledby="results-section-title" className="mt-10 mb-10"> <h2 id="results-section-title" className="text-2xl font-semibold text-gray-800 border-b pb-4 mb-6 flex items-center"> <span className="bg-blue-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">3</span> Resultats de l'Anàlisi </h2> {error && <p className="text-center text-red-600 font-semibold mb-6">⚠️ Error Anàlisi: {error}</p>} <article aria-label="Document Analitzat" className="bg-white p-6 md:p-10 rounded-xl border border-gray-200 shadow-xl"> <GoogleDocumentRenderer document={analysisResult} /> </article> </section> )}
    </main>
  );
}
