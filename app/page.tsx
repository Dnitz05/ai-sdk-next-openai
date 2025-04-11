'use client';

import { useState } from 'react';
import React from 'react'; // Importem React per a JSX

// --- Component per Renderitzar la Resposta de Google Document AI ---
function GoogleDocumentRenderer({ document }: { document: any }) {
  if (!document || !document.pages || !document.text) {
    return <p className="text-center text-gray-500 italic py-10">No hi ha dades del document per mostrar o l'estructura rebuda és invàlida.</p>;
  }
  const fullText = document.text;

  // Funció Helper per extreure text (sense canvis)
  const getText = (textAnchor: any): string => {
    if (!textAnchor?.textSegments || !fullText) { return ''; }
    let extractedText = '';
    for (const segment of textAnchor.textSegments) {
      const startIndex = parseInt(segment?.startIndex || '0', 10);
      const endIndex = parseInt(segment?.endIndex || '0', 10);
      if (!isNaN(startIndex) && !isNaN(endIndex) && startIndex >= 0 && endIndex >= startIndex && endIndex <= fullText.length) {
           extractedText += fullText.substring(startIndex, endIndex);
      } else { console.warn("Segment d'índex invàlid:", segment, `Text Length: ${fullText.length}`); }
    }
    return extractedText;
  };

  // Funció per renderitzar taules (sense canvis respecte l'última versió)
  const renderTable = (table: any, pageIndex: number, tableIndex: number) => {
    return (
        <div key={`page-${pageIndex}-table-${tableIndex}`} className="overflow-x-auto my-6 shadow-lg border border-gray-300 rounded-lg bg-white">
          <table className="min-w-full text-sm border-collapse border border-slate-400">
            {table.headerRows?.map((hRow: any, hrIndex: number) => ( <thead key={`thead-${hrIndex}`} className="bg-slate-100"> <tr className="border-b-2 border-slate-300"> {hRow.cells?.map((cell: any, cIndex: number) => ( <th key={`th-${hrIndex}-${cIndex}`} className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-700 whitespace-nowrap" colSpan={cell.layout?.colSpan && cell.layout.colSpan > 1 ? cell.layout.colSpan : undefined} rowSpan={cell.layout?.rowSpan && cell.layout.rowSpan > 1 ? cell.layout.rowSpan : undefined} > {getText(cell.layout?.textAnchor)} </th> ))} </tr> </thead> ))}
            <tbody className="divide-y divide-slate-200"> {table.bodyRows?.map((bRow: any, brIndex: number) => ( <tr key={`brow-${brIndex}`} className="hover:bg-slate-50"> {bRow.cells?.map((cell: any, cIndex: number) => ( <td key={`bcell-${brIndex}-${cIndex}`} className="border border-slate-300 px-4 py-2 align-top" colSpan={cell.layout?.colSpan && cell.layout.colSpan > 1 ? cell.layout.colSpan : undefined} rowSpan={cell.layout?.rowSpan && cell.layout.rowSpan > 1 ? cell.layout.rowSpan : undefined} > <span className="whitespace-pre-wrap">{getText(cell.layout?.textAnchor)}</span> </td> ))} </tr> ))} </tbody>
          </table>
        </div>
     );
  };

  // Renderització principal del component
  return (
    <div className="space-y-10 font-serif text-gray-900 text-sm md:text-base leading-relaxed">
      {document.pages.map((page: any, pageIndex: number) => (
        <div key={`page-${pageIndex}`} className="page-content mb-8">
          {document.pages.length > 1 && ( <p className="text-center text-xs font-semibold text-gray-500 my-6 pb-2 border-b border-dashed border-gray-300">--- PÀGINA {pageIndex + 1} ---</p> )}
          {page.paragraphs?.map((paragraph: any, pIndex: number) => ( <p key={`p-${pageIndex}-${pIndex}`} className="mb-4 leading-relaxed text-justify"> {getText(paragraph.layout?.textAnchor)} </p> ))}
          {page.lists?.map((list: any, lIndex: number) => { const ListTag = 'ul'; const listStyle = 'list-disc'; return ( <ListTag key={`list-${pageIndex}-${lIndex}`} className={`${listStyle} list-outside ml-6 md:ml-8 mb-4 space-y-1.5`}> {list.listItems?.map((item: any, iIndex: number) => ( <li key={`item-${pageIndex}-${lIndex}-${iIndex}`}> {getText(item.layout?.textAnchor)} </li> ))} </ListTag> ); })}
          {page.tables?.map((table: any, tIndex: number) => renderTable(table, pageIndex, tIndex) )}
        </div>
      ))}
      {/* --- SECCIÓ JSON DEBUG AMB BOTÓ DESCARREGAR CORREGIT --- */}
      <div className="mt-12 pt-6 border-t border-gray-300">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-700">Resposta JSON Completa de Google (Debug)</h3>
            {/* BOTÓ DESCARREGAR AMB ONCLICK CORREGIT */}
            <button
               onClick={() => {
                 // 'document' aquí és la prop amb les dades de Google AI
                 if (!document) return;
                 try {
                     const jsonString = JSON.stringify(document, null, 2);
                     const blob = new Blob([jsonString], { type: 'application/json' });
                     const url = URL.createObjectURL(blob);
                     // === CORRECCIÓ: Utilitzem window.document ===
                     const a = window.document.createElement('a'); // Correcte
                     a.href = url;
                     a.download = 'google-doc-ai-full-response.json'; // Nom del fitxer descarregat
                     window.document.body.appendChild(a); // Correcte
                     a.click(); // Inicia descàrrega
                     // Netegem després d'un petit temps
                     setTimeout(() => {
                        window.document.body.removeChild(a); // Correcte
                        URL.revokeObjectURL(url);
                        console.log("Recurs de descàrrega JSON netejat.");
                     }, 100);
                     console.log("Descàrrega JSON iniciada.");
                     // Podríem mostrar un feedback temporal a l'usuari aquí si volguéssim
                     // alert("Descàrrega del fitxer JSON iniciada.");
                  } catch (error) {
                     console.error("Error creant la descàrrega JSON:", error);
                     alert("Error: No s'ha pogut iniciar la descàrrega del JSON.");
                  }
               }}
               className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md transition-colors duration-150 disabled:opacity-50"
               disabled={!document} // Deshabilita si no hi ha document (analysisResult)
             >
               Descarregar JSON
             </button>
             {/* FI BOTÓ DESCARREGAR */}
          </div>
          <details className="bg-gray-800 text-white rounded-lg shadow-inner border border-gray-600">
              <summary className="text-sm text-gray-400 p-3 cursor-pointer hover:bg-gray-700 rounded-t-lg">Mostra/Amaga JSON</summary>
              <pre className="whitespace-pre-wrap text-xs text-green-400 p-4 overflow-x-auto font-mono max-h-[600px]">
                  {JSON.stringify(document, null, 2)}
              </pre>
          </details>
      </div>
      {/* --- FI JSON DEBUG --- */}
    </div>
  );
}


// --- Component Principal de la Pàgina (`Page`) ---
export default function Page() {
  // Estats (sense canvis)
  const [images, setImages] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [reformattedTables, setReformattedTables] = useState<any[]>([]); // Aquest estat encara no s'usa al renderer

  // Funció handleApiResponse (sense canvis)
  async function handleApiResponse(res: Response, context: string): Promise<any> { /* ... (igual que abans) ... */ if (res.ok) { try { return await res.json(); } catch (jsonError: any) { throw new Error(`Resposta invàlida (${context}, no JSON).`); } } else { let errorMessage = `Error ${res.status} (${context})`; try { const errorText = await res.text(); try { const errorJson = JSON.parse(errorText); errorMessage = errorJson.error || errorText || errorMessage; } catch (parseError) { errorMessage = errorText || errorMessage; console.warn(`Resp err no JSON (${context}):`, errorText); } } catch (readError: any) { errorMessage = `Error ${res.status} (${context}, resp no llegible)`; } throw new Error(errorMessage); } }
  // Gestor de pujada PDF (sense canvis)
  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => { /* ... (igual que abans) ... */ const file = e.target.files?.[0]; if (!file) return; setIsLoadingUpload(true); setError(null); setImages([]); setPdfUrl(null); setAnalysisResult(null); setReformattedTables([]); const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData }); const data = await handleApiResponse(res, "/api/upload-pdf"); if (!data.pdfUrl) { throw new Error("L'API d'upload no va retornar la pdfUrl."); } setImages(data.pages ?? []); setPdfUrl(data.pdfUrl); } catch (err: any) { setError(err.message || 'Error durant la pujada.'); setPdfUrl(null); } finally { setIsLoadingUpload(false); } };
  // Gestor d'anàlisi (sense canvis)
  const handleAnalyzeDocument = async () => { /* ... (igual que abans) ... */ if (!pdfUrl) { setError("Error intern: No hi ha URL de PDF."); return; } setIsLoadingAnalysis(true); setError(null); setAnalysisResult(null); setReformattedTables([]); try { const res = await fetch('/api/analyze-document-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pdfUrl }), }); const data = await handleApiResponse(res, "/api/analyze-document-ai"); if (!data || !data.google_document || typeof data.google_document !== 'object' || !Array.isArray(data.reformatted_tables)) { throw new Error("La resposta de l'API d'anàlisi no té l'estructura esperada ('google_document' i 'reformatted_tables')."); } setAnalysisResult(data.google_document); setReformattedTables(data.reformatted_tables); } catch (err: any) { setError('Error durant l’anàlisi: ' + err.message); } finally { setIsLoadingAnalysis(false); } };

  // Renderització JSX (sense canvis a l'estructura general)
  return (
     <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 bg-gradient-to-b from-gray-100 to-blue-100 min-h-screen">
       {/* ... Header ... */}
       <header className="text-center pt-8 pb-4"> <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight"> Analitzador Intel·ligent de PDF </h1> <p className="text-md md:text-lg text-gray-600 mt-3">Puja un document per extreure text i taules usant <span className="font-semibold text-blue-600">Google Document AI</span> i <span className="font-semibold text-violet-600">OpenAI</span></p> </header>
       {/* ... Secció Càrrega ... */}
       <section aria-labelledby="upload-section-title" className="p-6 border rounded-xl shadow-lg bg-white"> <h2 id="upload-section-title" className="text-xl font-semibold text-gray-700 mb-4 flex items-center"> <span className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">1</span> Pujar Document </h2> <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleUploadPdf} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 active:file:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out" disabled={isLoadingUpload || isLoadingAnalysis} /> <div className="mt-4 text-center h-6"> {isLoadingUpload && <p className="text-sm text-blue-600 font-medium animate-pulse">⏳ Carregant...</p>} {error && !isLoadingUpload && !isLoadingAnalysis && <p className="text-sm text-red-600 font-semibold">⚠️ Error: {error}</p>} {pdfUrl && !isLoadingUpload && !error && !analysisResult && <p className="text-sm text-green-700 font-medium">✅ PDF pujat.</p>} </div> </section>
       {/* ... Secció Accions ... */}
       {(pdfUrl || (images && images.length > 0)) && !isLoadingUpload && !error && ( <section aria-labelledby="action-section-title" className="mt-6 p-6 border rounded-xl shadow-lg bg-white"> <h2 id="action-section-title" className="text-xl font-semibold text-gray-700 mb-5 flex items-center"> <span className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">2</span> Accions </h2> {images && images.length > 0 && ( <div className="mb-6"> <h3 className="text-md font-medium text-gray-600 mb-3">Previsualització:</h3> <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 bg-gray-100 p-4 rounded-lg border"> {images.map((src, idx) => ( <a href={src} target="_blank" rel="noopener noreferrer" key={`thumb-${idx}`} className="block border rounded-md overflow-hidden shadow hover:shadow-lg transition-shadow duration-200 bg-white group"> <img src={src} alt={`Miniatura ${idx + 1}`} loading="lazy" className="w-full h-auto object-contain p-1 group-hover:opacity-80 transition-opacity" /> <p className="text-center text-xs font-medium py-1 px-2 bg-gray-50 border-t">P. {idx + 1}</p> </a> ))} </div> </div> )} {pdfUrl && ( <div className={`text-center ${images && images.length > 0 ? 'pt-6 border-t' : 'pt-2'}`}> <button onClick={handleAnalyzeDocument} className={`px-8 py-3 text-base font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 ease-in-out transform hover:scale-105 disabled:scale-100 ${isLoadingAnalysis || !!analysisResult ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800 focus:ring-indigo-500'}`} disabled={isLoadingAnalysis || isLoadingUpload || !!analysisResult} > {isLoadingAnalysis ? ( <span className="flex items-center justify-center"> <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Analitzant... </span> ) : (analysisResult ? 'Anàlisi Completada ✓' : 'Analitzar Document (Google + OpenAI)')} </button> {isLoadingAnalysis && ( <p className="text-sm text-blue-600 font-medium mt-4 flex items-center justify-center space-x-2"> <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>Processant amb Google AI i OpenAI...</span> </p> )} </div> )} </section> )}
       {/* ===== SECCIÓ RESULTATS ===== */}
       {analysisResult && !isLoadingUpload && !isLoadingAnalysis && ( <section aria-labelledby="results-section-title" className="mt-10 mb-10"> <h2 id="results-section-title" className="text-2xl font-semibold text-gray-800 border-b border-gray-300 pb-4 mb-6 flex items-center"> <span className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">3</span> Resultats de l'Anàlisi </h2> {error && <p className="text-center text-red-600 font-semibold mb-6">⚠️ Error Anàlisi: {error}</p>} <article aria-label="Document Analitzat" className="bg-white p-6 md:p-10 rounded-xl border border-gray-200 shadow-2xl"> <GoogleDocumentRenderer document={analysisResult} reformattedTables={reformattedTables} /> </article> </section> )}
    </main>
  );
}
