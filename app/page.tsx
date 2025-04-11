'use client';

import { useState } from 'react';
import React from 'react';

// --- DEFINICIONS DE TIPUS AMPLIADES ---
interface StyleInfo { fontWeight?: string; fontStyle?: string; textDecoration?: string; fontSize?: { size: number; unit: string }; fontFamily?: string; foregroundColor?: { color: { red?: number; green?: number; blue?: number } }; backgroundColor?: { color: { red?: number; green?: number; blue?: number } };}
interface TextAnchor { textSegments: { startIndex?: string; endIndex?: string }[]; content?: string; }
interface Layout { textAnchor?: TextAnchor; boundingPoly?: any; orientation?: string; colspan?: number; rowspan?: number; } // <--- 'rowspan' en minúscules aquí és correcte per al tipus
interface Token { layout?: Layout; detectedBreak?: { type: string }; styleInfo?: StyleInfo; }
interface Paragraph { layout?: Layout; detectedLanguages?: any[]; }
interface ListItem { layout?: Layout; detectedLanguages?: any[]; }
interface List { layout?: Layout; listItems?: ListItem[]; type?: string; }
interface TableCell { layout?: Layout; }
interface TableRow { cells?: TableCell[]; }
interface Table { layout?: Layout; headerRows?: TableRow[]; bodyRows?: TableRow[]; }
interface Page { pageNumber?: number; layout?: Layout; paragraphs?: Paragraph[]; lines?: any[]; tokens?: Token[]; lists?: List[]; tables?: Table[]; }
interface GoogleDocument { text?: string; pages: Page[]; }
// --- FI TIPUS ---


// --- COMPONENTS I FUNCIONS HELPER ---

// Funció Helper getText (sense canvis)
const getText = (textAnchor: TextAnchor | undefined, fullText: string): string => { if (!textAnchor?.textSegments || !fullText) { return ''; } let extractedText = ''; for (const segment of textAnchor.textSegments) { const startIndex = parseInt(segment?.startIndex || '0', 10); const endIndex = parseInt(segment?.endIndex || '0', 10); if (!isNaN(startIndex) && !isNaN(endIndex) && startIndex >= 0 && endIndex >= startIndex && endIndex <= fullText.length) { extractedText += fullText.substring(startIndex, endIndex); } else { console.warn("Segment índex invàlid:", segment); } } return extractedText; };

/**
 * Funció Avançada v4 per renderitzar text amb estils inline (negreta, cursiva, etc.)
 */
function renderRichText(textAnchor: TextAnchor | undefined, pageTokens: Token[] | undefined, fullText: string): React.ReactNode {
    if (!textAnchor?.textSegments || !pageTokens || !fullText) { return getText(textAnchor, fullText); }
    const contentNodes: React.ReactNode[] = []; let overallStartIndex = -1; let overallEndIndex = -1;
    if (textAnchor.textSegments.length > 0) { overallStartIndex = parseInt(textAnchor.textSegments[0].startIndex || '0', 10); overallEndIndex = parseInt(textAnchor.textSegments[textAnchor.textSegments.length - 1].endIndex || '0', 10); }
    if (isNaN(overallStartIndex) || isNaN(overallEndIndex) || overallStartIndex === -1 || overallEndIndex === -1) return getText(textAnchor, fullText);
    const relevantTokens = pageTokens.filter(token => { const tokenStart = parseInt(token.layout?.textAnchor?.textSegments?.[0]?.startIndex || '-1', 10); return !isNaN(tokenStart) && tokenStart >= overallStartIndex && tokenStart < overallEndIndex; }).sort((a,b) => parseInt(a.layout?.textAnchor?.textSegments?.[0]?.startIndex || '0', 10) - parseInt(b.layout?.textAnchor?.textSegments?.[0]?.startIndex || '0', 10));
    if (relevantTokens.length === 0) { return getText(textAnchor, fullText); }
    let lastIndex = overallStartIndex;
    relevantTokens.forEach((token, index) => { const tokenText = getText(token.layout?.textAnchor, fullText); const tokenStart = parseInt(token.layout?.textAnchor?.textSegments?.[0]?.startIndex || '-1', 10); if (!isNaN(tokenStart) && tokenStart > lastIndex) { contentNodes.push( <React.Fragment key={`gap-${index}`}>{fullText.substring(lastIndex, tokenStart)}</React.Fragment> ); } let styledToken: React.ReactNode = tokenText; const style = token.styleInfo; if (style) { if (style.textDecoration === 'underline') styledToken = <u>{styledToken}</u>; if (style.textDecoration === 'line-through') styledToken = <del>{styledToken}</del>; if (style.fontStyle === 'italic') styledToken = <em>{styledToken}</em>; if (style.fontWeight === 'bold') styledToken = <strong>{styledToken}</strong>; } contentNodes.push(<React.Fragment key={`token-${index}`}>{styledToken}</React.Fragment>); lastIndex = parseInt(token.layout?.textAnchor?.textSegments?.[0]?.endIndex || '-1', 10); if (isNaN(lastIndex)) lastIndex = tokenStart + tokenText.length; }); if (!isNaN(overallEndIndex) && overallEndIndex > lastIndex) { contentNodes.push( <React.Fragment key="final-gap">{fullText.substring(lastIndex, overallEndIndex)}</React.Fragment> ); }
    return <>{contentNodes}</>;
}

/**
 * Component Avançat v4 per Renderitzar Google Document AI
 * Intenta aplicar estils inline i detectar títols. Inclou correcció rowspan.
 */
function GoogleDocumentRenderer({ document }: { document: GoogleDocument }) {
  if (!document || !document.pages || !document.text) { return <p className="text-center text-gray-500 italic py-10">No hi ha dades del document.</p>; }
  const fullText = document.text;

  // Funció Millorada per Renderitzar Taules (CORREGIT: rowspan en minúscules)
  const renderTable = (table: Table, pageIndex: number, tableIndex: number, pageTokens: Token[]) => {
      return ( <div key={`page-${pageIndex}-table-${tableIndex}`} className="overflow-x-auto my-6 shadow-lg border border-gray-300 rounded-lg bg-white"> <table className="min-w-full text-sm border-collapse border border-slate-400"> {table.headerRows?.map((hRow: TableRow, hrIndex: number) => ( <thead key={`thead-${hrIndex}`} className="bg-slate-100"> <tr className="border-b-2 border-slate-300"> {hRow.cells?.map((cell: TableCell, cIndex: number) => ( <th key={`th-${hrIndex}-${cIndex}`} className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-700 whitespace-nowrap" colSpan={cell.layout?.colspan && cell.layout.colspan > 1 ? cell.layout.colspan : undefined} rowSpan={cell.layout?.rowspan && cell.layout.rowspan > 1 ? cell.layout.rowspan : undefined} > {/* Corregit aquí */} {renderRichText(cell.layout?.textAnchor, pageTokens, fullText)} </th> ))} </tr> </thead> ))} <tbody className="divide-y divide-slate-200"> {table.bodyRows?.map((bRow: TableRow, brIndex: number) => ( <tr key={`brow-${brIndex}`} className="hover:bg-slate-50"> {bRow.cells?.map((cell: TableCell, cIndex: number) => ( <td key={`bcell-${brIndex}-${cIndex}`} className="border border-slate-300 px-4 py-2 align-top" colSpan={cell.layout?.colspan && cell.layout.colspan > 1 ? cell.layout.colspan : undefined} rowSpan={cell.layout?.rowspan && cell.layout.rowspan > 1 ? cell.layout.rowspan : undefined} > {/* Corregit aquí */} {renderRichText(cell.layout?.textAnchor, pageTokens, fullText)} </td> ))} </tr> ))} </tbody> </table> </div> );
  }; // Fi de renderTable

  // --- Renderització Principal ---
  return (
    <div className="space-y-6 font-serif text-gray-900 text-sm md:text-base leading-relaxed">
      {document.pages.map((page: Page, pageIndex: number) => (
        <div key={`page-${pageIndex}`} className="page-content mb-8 border-t pt-6 border-gray-200 first:border-t-0 first:pt-0">
          {document.pages.length > 1 && ( <p className="text-center text-xs font-semibold text-gray-500 mb-6 pb-2 border-b border-dashed border-gray-300">--- PÀGINA {pageIndex + 1} ---</p> )}

          {/* Paràgrafs (amb detecció de títols i rich text) */}
          {page.paragraphs?.map((paragraph: Paragraph, pIndex: number) => {
             let isLikelyHeading = false; let headingLevel = 0; const paraTokens = page.tokens?.filter(token => { const tokenStart = parseInt(token.layout?.textAnchor?.textSegments?.[0]?.startIndex || '-1', 10); const paraStart = parseInt(paragraph.layout?.textAnchor?.textSegments?.[0]?.startIndex || '0', 10); const paraEnd = parseInt(paragraph.layout?.textAnchor?.textSegments?.[paragraph.layout.textAnchor.textSegments.length - 1]?.endIndex || '0', 10); return !isNaN(tokenStart) && !isNaN(paraStart) && !isNaN(paraEnd) && tokenStart >= paraStart && tokenStart < paraEnd; }) ?? [];
             if (paraTokens.length > 0) { const averageSize = paraTokens.reduce((sum, t) => sum + (t.styleInfo?.fontSize?.size || 12), 0) / paraTokens.length; const isConsistentlyBold = paraTokens.length > 0 && paraTokens.every(t => t.styleInfo?.fontWeight === 'bold'); if (isConsistentlyBold && averageSize > 14) { isLikelyHeading = true; headingLevel = averageSize > 18 ? 2 : 3; } else if (averageSize > 16) { isLikelyHeading = true; headingLevel = 4; } }
             const content = renderRichText(paragraph.layout?.textAnchor, page.tokens ?? [], fullText);
             if (isLikelyHeading) { const HeadingTag = `h${headingLevel}` as keyof JSX.IntrinsicElements; const headingMargin = `mt-${Math.max(2, 7 - headingLevel)} mb-${Math.max(2, 4 - headingLevel)}`; return <HeadingTag key={`h-${pageIndex}-${pIndex}`} className={`${headingMargin} font-sans font-semibold text-gray-800`}>{content}</HeadingTag>;
             } else { const paragraphStyle = 'mb-4 leading-relaxed text-justify'; return <p key={`p-${pageIndex}-${pIndex}`} className={paragraphStyle}>{content}</p>; }
          })}

           {/* Llistes (amb rich text per item) */}
           {page.lists?.map((list: List, lIndex: number) => { const ListTag = 'ul'; const listStyle = 'list-disc'; return ( <ListTag key={`list-${pageIndex}-${lIndex}`} className={`${listStyle} list-outside ml-6 md:ml-8 mb-4 space-y-1.5`}> {list.listItems?.map((item: ListItem, iIndex: number) => ( <li key={`item-${pageIndex}-${lIndex}-${iIndex}`}> {renderRichText(item.layout?.textAnchor, page.tokens ?? [], fullText)} </li> ))} </ListTag> ); })}

           {/* Taules (passant page.tokens) */}
           {page.tables?.map((table: Table, tIndex: number) => renderTable(table, pageIndex, tIndex, page.tokens ?? []) )}

        </div>
      ))}
       {/* JSON de Debug (Comentat per defecte) */}
       {/* <div className="mt-12 pt-6 border-t border-gray-300"> <div className="flex justify-between items-center mb-3"> <h3 className="text-lg font-semibold text-gray-700">Resposta JSON Completa (Debug)</h3> <button onClick={() => { ... }} disabled={!document}> Descarregar JSON </button> </div> <details> <summary>Mostra/Amaga JSON</summary> <pre>{JSON.stringify(document, null, 2)}</pre> </details> </div> */}
    </div>
  );
}


// --- Component Principal de la Pàgina (`Page`) ---
export default function Page() {
  // Estats (igual que abans, sense reformattedTables)
  const [images, setImages] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<GoogleDocument | null>(null);

  // Funció handleApiResponse (igual)
  async function handleApiResponse(res: Response, context: string): Promise<any> { /* ... */ }
  // Gestor de pujada PDF (igual)
  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
  // Gestor d'anàlisi (igual, espera { result: googleDocument })
  const handleAnalyzeDocument = async () => {
      if (!pdfUrl) { setError("Error intern: No hi ha URL de PDF."); return; }
      setIsLoadingAnalysis(true); setError(null);
      setAnalysisResult(null);

      try {
        const res = await fetch('/api/analyze-document-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pdfUrl }), });
        const data = await handleApiResponse(res, "/api/analyze-document-ai");

        // Validació backend simplificat
        if (!data || !data.result || !Array.isArray(data.result.pages)) {
             console.error("Frontend: Resposta invàlida del backend:", data);
             throw new Error("La resposta de l'API d'anàlisi no té l'estructura esperada ('result' amb 'pages').");
         }
        setAnalysisResult(data.result); // Guardem l'objecte 'document' de Google

      } catch (err: any) {
          setError('Error durant l’anàlisi: ' + err.message);
      } finally {
          setIsLoadingAnalysis(false);
      }
    };

  // Renderització JSX (igual)
  return (
     <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 bg-gradient-to-b from-gray-100 to-blue-100 min-h-screen">
       {/* ... Header ... */}
       <header className="text-center pt-8 pb-4"> <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight"> Analitzador Intel·ligent de PDF </h1> <p className="text-md md:text-lg text-gray-600 mt-3">Puja un document per extreure text, estructura i format usant <span className="font-semibold text-blue-600">Google Document AI</span></p> </header>

       {/* ... Secció Càrrega ... */}
       <section aria-labelledby="upload-section-title" className="p-6 border rounded-xl shadow-lg bg-white"> <h2 id="upload-section-title" className="text-xl font-semibold text-gray-700 mb-4 flex items-center"> <span className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">1</span> Pujar Document </h2> <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleUploadPdf} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 active:file:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out" disabled={isLoadingUpload || isLoadingAnalysis} /> <div className="mt-4 text-center h-6"> {isLoadingUpload && <p className="text-sm text-blue-600 font-medium animate-pulse">⏳ Carregant...</p>} {error && !isLoadingUpload && !isLoadingAnalysis && <p className="text-sm text-red-600 font-semibold">⚠️ Error: {error}</p>} {pdfUrl && !isLoadingUpload && !error && !analysisResult && <p className="text-sm text-green-700 font-medium">✅ PDF pujat.</p>} </div> </section>

       {/* ... Secció Accions ... */}
       {(pdfUrl || (images && images.length > 0)) && !isLoadingUpload && !error && ( <section aria-labelledby="action-section-title" className="mt-6 p-6 border rounded-xl shadow-lg bg-white"> <h2 id="action-section-title" className="text-xl font-semibold text-gray-700 mb-5 flex items-center"> <span className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">2</span> Accions </h2> {images && images.length > 0 && ( <div className="mb-6"> <h3 className="text-md font-medium text-gray-600 mb-3">Previsualització:</h3> <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 bg-gray-100 p-4 rounded-lg border"> {images.map((src, idx) => ( <a href={src} target="_blank" rel="noopener noreferrer" key={`thumb-${idx}`} className="block border rounded-md overflow-hidden shadow hover:shadow-lg transition-shadow duration-200 bg-white group"> <img src={src} alt={`Miniatura ${idx + 1}`} loading="lazy" className="w-full h-auto object-contain p-1 group-hover:opacity-80 transition-opacity" /> <p className="text-center text-xs font-medium py-1 px-2 bg-gray-50 border-t">P. {idx + 1}</p> </a> ))} </div> </div> )} {pdfUrl && ( <div className={`text-center ${images && images.length > 0 ? 'pt-6 border-t' : 'pt-2'}`}> <button onClick={handleAnalyzeDocument} className={`px-8 py-3 text-base font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 ease-in-out transform hover:scale-105 disabled:scale-100 ${isLoadingAnalysis || !!analysisResult ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800 focus:ring-indigo-500'}`} disabled={isLoadingAnalysis || isLoadingUpload || !!analysisResult} > {isLoadingAnalysis ? ( <span className="flex items-center justify-center"> <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Analitzant... </span> ) : (analysisResult ? 'Anàlisi Completada ✓' : 'Analitzar Document amb Google AI')} </button> {isLoadingAnalysis && ( <p className="text-sm text-blue-600 font-medium mt-4 flex items-center justify-center space-x-2"> <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> <span>Processant amb Google AI...</span> </p> )} </div> )} </section> )}

       {/* ===== SECCIÓ RESULTATS (Amb renderer avançat) ===== */}
       {analysisResult && !isLoadingUpload && !isLoadingAnalysis && (
         <section aria-labelledby="results-section-title" className="mt-10 mb-10">
           <h2 id="results-section-title" className="text-2xl font-semibold text-gray-800 border-b border-gray-300 pb-4 mb-6 flex items-center"> <span className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">3</span> Resultats de l'Anàlisi </h2>
           {error && <p className="text-center text-red-600 font-semibold mb-6">⚠️ Error Anàlisi: {error}</p>}
           <article aria-label="Document Analitzat" className="bg-white p-6 md:p-10 rounded-xl border border-gray-200 shadow-2xl">
              <GoogleDocumentRenderer document={analysisResult} />
           </article>
         </section>
       )}
    </main>
  );
}
