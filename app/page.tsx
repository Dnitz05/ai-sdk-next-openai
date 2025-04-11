'use client';

import { useState } from 'react';
import React from 'react'; // Importem React per a JSX

// --- Component Final per Renderitzar Resultats (Mostra HTML d'OpenAI per Taules) ---
function GoogleDocumentRenderer({ document, reformattedTables }: { document: any, reformattedTables: any[] }) {
    if (!document || !document.pages || !document.text) {
        return <p className="text-center text-gray-500 italic py-10">No hi ha dades del document per mostrar o l'estructura rebuda és invàlida.</p>;
    }
    const fullText = document.text;

    // Funció Helper per extreure text (necessària per paràgrafs, llistes...)
    const getText = (textAnchor: any): string => {
        if (!textAnchor?.textSegments || !fullText) { return ''; }
        let extractedText = '';
        for (const segment of textAnchor.textSegments) {
            const startIndex = parseInt(segment?.startIndex || '0', 10);
            const endIndex = parseInt(segment?.endIndex || '0', 10);
            if (!isNaN(startIndex) && !isNaN(endIndex) && startIndex >= 0 && endIndex >= startIndex && endIndex <= fullText.length) {
                extractedText += fullText.substring(startIndex, endIndex);
            } else {
                console.warn("Segment d'índex invàlid:", segment, `Text Length: ${fullText.length}`);
            }
        }
        return extractedText;
    };

    // Funció per trobar l'HTML reformatat per a una taula específica
    const findReformattedTableHtml = (pageIdx: number, tableIdx: number): string | null => {
        const found = reformattedTables.find(
            (t) => t.pageIndex === pageIdx && t.tableIndexOnPage === tableIdx
        );
        // Retorna l'HTML si existeix i no és un missatge d'error incrustat
        return (found && !found.html.includes("Error processant taula")) ? found.html : null;
    };


    // Renderització principal pàgina a pàgina
    return (
        <div className="space-y-10 font-serif text-gray-900 text-sm md:text-base leading-relaxed">
            {document.pages.map((page: any, pageIndex: number) => (
                <div key={`page-${pageIndex}`} className="page-content mb-8">
                    {/* Indicador de Pàgina */}
                    {document.pages.length > 1 && (
                        <p className="text-center text-xs font-semibold text-gray-500 my-6 pb-2 border-b border-dashed border-gray-300">--- PÀGINA {pageIndex + 1} ---</p>
                    )}

                    {/* Renderitzem elements: Paràgrafs, Llistes, TAULES (amb HTML d'OpenAI) */}
                    {/* (Simplificació: mostrem en ordre Paràgrafs > Llistes > Taules) */}

                    {page.paragraphs?.map((paragraph: any, pIndex: number) => (
                        <p key={`p-${pageIndex}-${pIndex}`} className="mb-4 text-justify">
                            {getText(paragraph.layout?.textAnchor)}
                        </p>
                    ))}

                    {page.lists?.map((list: any, lIndex: number) => {
                        const ListTag = 'ul';
                        const listStyle = 'list-disc';
                        return (
                            <ListTag key={`list-${pageIndex}-${lIndex}`} className={`${listStyle} list-outside ml-6 md:ml-8 mb-4 space-y-1.5`}>
                                {list.listItems?.map((item: any, iIndex: number) => (
                                    <li key={`item-${pageIndex}-${lIndex}-${iIndex}`}>
                                        {getText(item.layout?.textAnchor)}
                                    </li>
                                ))}
                            </ListTag>
                        );
                    })}

                    {/* ---- RENDERITZACIÓ DE TAULES USANT HTML D'OPENAI ---- */}
                    {page.tables?.map((table: any, tIndex: number) => {
                        // Busquem l'HTML pre-generat per OpenAI per a aquesta taula
                        const tableHtml = findReformattedTableHtml(pageIndex, tIndex);

                        if (tableHtml) {
                            // Si tenim l'HTML, el mostrem directament
                            return (
                                <div
                                    key={`table-html-${pageIndex}-${tIndex}`}
                                    className="my-6 rendered-html-table overflow-x-auto"
                                    // Injectem l'HTML rebut d'OpenAI. Confiem que és segur.
                                    dangerouslySetInnerHTML={{ __html: tableHtml }}
                                />
                            );
                        } else {
                            // Fallback si OpenAI va fallar per a aquesta taula
                            console.warn(`No s'ha trobat HTML reformatat per a taula ${tIndex} a pàgina ${pageIndex}`);
                            // Podríem mostrar un missatge o intentar renderitzar-la bàsicament amb Google data
                            return <div key={`table-fallback-${pageIndex}-${tIndex}`} className="my-6 p-4 border border-red-300 bg-red-50 text-red-700 text-sm rounded"> [ No s'ha pogut renderitzar la taula {tIndex + 1} (Pàg. {pageIndex + 1}) amb el format simplificat. ] </div>;
                        }
                    })}
                     {/* ---- FI RENDERITZACIÓ TAULES ---- */}

                </div> // --- Fi page-content ---
            ))}

            {/* --- JSON de Debug (sense canvis) --- */}
            <div className="mt-12 pt-6 border-t border-gray-300">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-700">Resposta JSON Completa de Google (Debug)</h3>
                    <button onClick={() => { if (!document) return; const jsonString = JSON.stringify(document, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'google-doc-ai-full-response.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md transition-colors duration-150 disabled:opacity-50" disabled={!document} > Descarregar JSON </button>
                </div>
                <details className="bg-gray-800 text-white rounded-lg shadow-inner border border-gray-600">
                    <summary className="text-sm text-gray-400 p-3 cursor-pointer hover:bg-gray-700 rounded-t-lg">Mostra/Amaga JSON</summary>
                    <pre className="whitespace-pre-wrap text-xs text-green-400 p-4 overflow-x-auto font-mono max-h-[600px]">
                        {JSON.stringify(document, null, 2)}
                    </pre>
                </details>
            </div>
        </div>
    );
}


// --- Component Principal de la Pàgina (`Page`) ---
export default function Page() {
  // Estats actualitzats
  const [images, setImages] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null); // Objecte google_document
  const [reformattedTables, setReformattedTables] = useState<any[]>([]); // Array { pageIndex, tableIndexOnPage, html }

  // Funció millorada per gestionar respostes API (sense canvis)
  async function handleApiResponse(res: Response, context: string): Promise<any> { if (res.ok) { try { return await res.json(); } catch (jsonError: any) { throw new Error(`Resposta invàlida (${context}, no JSON).`); } } else { let errorMessage = `Error ${res.status} (${context})`; try { const errorText = await res.text(); try { const errorJson = JSON.parse(errorText); errorMessage = errorJson.error || errorText || errorMessage; } catch (parseError) { errorMessage = errorText || errorMessage; console.warn(`Resp err no JSON (${context}):`, errorText); } } catch (readError: any) { errorMessage = `Error ${res.status} (${context}, resp no llegible)`; } throw new Error(errorMessage); } }

  // Gestor de pujada PDF (sense canvis)
  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setIsLoadingUpload(true); setError(null); setImages([]); setPdfUrl(null); setAnalysisResult(null); setReformattedTables([]); const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData }); const data = await handleApiResponse(res, "/api/upload-pdf"); if (!data.pdfUrl) { throw new Error("L'API d'upload no va retornar la pdfUrl."); } setImages(data.pages ?? []); setPdfUrl(data.pdfUrl); } catch (err: any) { setError(err.message || 'Error durant la pujada.'); setPdfUrl(null); } finally { setIsLoadingUpload(false); } };

  // Gestor d'anàlisi (ara guarda google_document i reformatted_tables)
  const handleAnalyzeDocument = async () => {
    if (!pdfUrl) { setError("Error intern: No hi ha URL de PDF."); return; }
    setIsLoadingAnalysis(true); setError(null);
    setAnalysisResult(null); setReformattedTables([]); // Netejar estats

    try {
      const res = await fetch('/api/analyze-document-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pdfUrl }), });
      const data = await handleApiResponse(res, "/api/analyze-document-ai");

      // Validació de l'estructura rebuda del backend híbrid
      if (!data || !data.google_document || typeof data.google_document !== 'object' || !Array.isArray(data.reformatted_tables)) {
          console.error("Frontend: Resposta invàlida de /api/analyze-document-ai (híbrid):", data);
          throw new Error("La resposta de l'API d'anàlisi no té l'estructura esperada ('google_document' i 'reformatted_tables').");
       }

      setAnalysisResult(data.google_document); // Guardem l'objecte 'document' de Google
      setReformattedTables(data.reformatted_tables); // Guardem l'array de taules HTML

    } catch (err: any) {
        setError('Error durant l’anàlisi: ' + err.message);
    } finally {
        setIsLoadingAnalysis(false);
    }
  };

  // Renderització JSX
  return (
     <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 bg-gradient-to-b from-gray-100 to-blue-100 min-h-screen">
       <header className="text-center pt-8 pb-4"> <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight"> Analitzador Intel·ligent de PDF </h1> <p className="text-md md:text-lg text-gray-600 mt-3">Puja un document per extreure text i taules usant <span className="font-semibold text-blue-600">Google Document AI</span> i <span className="font-semibold text-violet-600">OpenAI</span></p> </header>
       {/* ... Secció Càrrega (igual) ... */}
        <section aria-labelledby="upload-section-title" className="p-6 border rounded-xl shadow-lg bg-white"> <h2 id="upload-section-title" className="text-xl font-semibold text-gray-700 mb-4 flex items-center"> <span className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">1</span> Pujar Document </h2> <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleUploadPdf} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 active:file:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out" disabled={isLoadingUpload || isLoadingAnalysis} /> <div className="mt-4 text-center h-6"> {isLoadingUpload && <p className="text-sm text-blue-600 font-medium animate-pulse">⏳ Carregant...</p>} {error && !isLoadingUpload && !isLoadingAnalysis && <p className="text-sm text-red-600 font-semibold">⚠️ Error: {error}</p>} {pdfUrl && !isLoadingUpload && !error && !analysisResult && <p className="text-sm text-green-700 font-medium">✅ PDF pujat.</p>} </div> </section>

       {/* ... Secció Accions (igual) ... */}
        {(pdfUrl || (images && images.length > 0)) && !isLoadingUpload && !error && ( <section aria-labelledby="action-section-title" className="mt-6 p-6 border rounded-xl shadow-lg bg-white"> <h2 id="action-section-title" className="text-xl font-semibold text-gray-700 mb-5 flex items-center"> <span className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">2</span> Accions </h2> {images && images.length > 0 && ( <div className="mb-6"> <h3 className="text-md font-medium text-gray-600 mb-3">Previsualització:</h3> <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 bg-gray-100 p-4 rounded-lg border"> {images.map((src, idx) => ( <a href={src} target="_blank" rel="noopener noreferrer" key={`thumb-${idx}`} className="block border rounded-md overflow-hidden shadow hover:shadow-lg transition-shadow duration-200 bg-white group"> <img src={src} alt={`Miniatura ${idx + 1}`} loading="lazy" className="w-full h-auto object-contain p-1 group-hover:opacity-80 transition-opacity" /> <p className="text-center text-xs font-medium py-1 px-2 bg-gray-50 border-t">P. {idx + 1}</p> </a> ))} </div> </div> )} {pdfUrl && ( <div className={`text-center ${images && images.length > 0 ? 'pt-6 border-t' : 'pt-2'}`}> <button onClick={handleAnalyzeDocument} className={`px-8 py-3 text-base font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 ease-in-out transform hover:scale-105 disabled:scale-100 ${isLoadingAnalysis || !!analysisResult ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800 focus:ring-indigo-500'}`} disabled={isLoadingAnalysis || isLoadingUpload || !!analysisResult} > {isLoadingAnalysis ? ( <span className="flex items-center justify-center"> <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Analitzant... </span> ) : (analysisResult ? 'Anàlisi Completada ✓' : 'Analitzar Document (Google + OpenAI)')} </button> {isLoadingAnalysis && ( <p className="text-sm text-blue-600 font-medium mt-4 flex items-center justify-center space-x-2"> <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>Processant amb Google AI i OpenAI...</span> </p> )} </div> )} </section> )}

       {/* ===== SECCIÓ RESULTATS (ARA MOSTRARÀ TAULES HTML D'OPENAI) ===== */}
       {analysisResult && !isLoadingUpload && !isLoadingAnalysis && (
         <section aria-labelledby="results-section-title" className="mt-10 mb-10">
           <h2 id="results-section-title" className="text-2xl font-semibold text-gray-800 border-b border-gray-300 pb-4 mb-6 flex items-center">
               <span className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">3</span> Resultats de l'Anàlisi
           </h2>
           {error && <p className="text-center text-red-600 font-semibold mb-6">⚠️ Error Anàlisi: {error}</p>}
           {/* Passem el document de Google i les taules HTML al renderer */}
           <article aria-label="Document Analitzat" className="bg-white p-6 md:p-10 rounded-xl border border-gray-200 shadow-2xl">
              <GoogleDocumentRenderer
                  document={analysisResult}
                  reformattedTables={reformattedTables}
              />
           </article>
         </section>
       )}
       {/* ===== FI SECCIÓ RESULTATS ===== */}
    </main>
  );
}
