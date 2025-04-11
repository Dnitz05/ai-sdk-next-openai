'use client';

import { useState } from 'react';
import React from 'react';

// --- DEFINICIONS DE TIPUS AMPLIADES ---
interface StyleInfo { fontWeight?: string; fontStyle?: string; textDecoration?: string; fontSize?: { size: number; unit: string }; fontFamily?: string; foregroundColor?: { color: { red?: number; green?: number; blue?: number } }; backgroundColor?: { color: { red?: number; green?: number; blue?: number } };}
interface TextAnchor { textSegments: { startIndex?: string; endIndex?: string }[]; content?: string; }
interface Layout { textAnchor?: TextAnchor; boundingPoly?: any; orientation?: string; colspan?: number; rowspan?: number; }
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

// Funció Helper getText (igual)
const getText = (textAnchor: TextAnchor | undefined, fullText: string): string => { if (!textAnchor?.textSegments || !fullText) { return ''; } let extractedText = ''; for (const segment of textAnchor.textSegments) { const startIndex = parseInt(segment?.startIndex || '0', 10); const endIndex = parseInt(segment?.endIndex || '0', 10); if (!isNaN(startIndex) && !isNaN(endIndex) && startIndex >= 0 && endIndex >= startIndex && endIndex <= fullText.length) { extractedText += fullText.substring(startIndex, endIndex); } else { console.warn("Segment índex invàlid:", segment); } } return extractedText; };

/**
 * Funció Avançada v4 per renderitzar text amb estils inline (negreta, cursiva, etc.)
 * basant-se en els tokens dins d'un TextAnchor.
 */
function renderRichText(textAnchor: TextAnchor | undefined, pageTokens: Token[] | undefined, fullText: string): React.ReactNode {
    if (!textAnchor?.textSegments || !pageTokens || !fullText) { return getText(textAnchor, fullText); }

    const contentNodes: React.ReactNode[] = [];
    let overallStartIndex = -1;
    let overallEndIndex = -1;

    if (textAnchor.textSegments.length > 0) {
        overallStartIndex = parseInt(textAnchor.textSegments[0].startIndex || '0', 10);
        overallEndIndex = parseInt(textAnchor.textSegments[textAnchor.textSegments.length - 1].endIndex || '0', 10);
    }
    if (isNaN(overallStartIndex) || isNaN(overallEndIndex) || overallStartIndex === -1 || overallEndIndex === -1) return getText(textAnchor, fullText);

    // Filtrem i ordenem tokens rellevants per a aquest anchor
    const relevantTokens = pageTokens.filter(token => {
        const tokenStart = parseInt(token.layout?.textAnchor?.textSegments?.[0]?.startIndex || '-1', 10);
        return !isNaN(tokenStart) && tokenStart >= overallStartIndex && tokenStart < overallEndIndex;
    }).sort((a,b) => parseInt(a.layout?.textAnchor?.textSegments?.[0]?.startIndex || '0', 10) - parseInt(b.layout?.textAnchor?.textSegments?.[0]?.startIndex || '0', 10));

    if (relevantTokens.length === 0) { return getText(textAnchor, fullText); }

    let lastIndex = overallStartIndex;

    // Construïm el JSX iterant pels tokens
    relevantTokens.forEach((token, index) => {
        const tokenText = getText(token.layout?.textAnchor, fullText);
        const tokenStart = parseInt(token.layout?.textAnchor?.textSegments?.[0]?.startIndex || '-1', 10);

        // Afegim text/espais entre l'últim token i l'actual
        if (!isNaN(tokenStart) && tokenStart > lastIndex) {
            contentNodes.push(
                <React.Fragment key={`gap-${index}`}>{fullText.substring(lastIndex, tokenStart)}</React.Fragment>
            );
        }

        // Apliquem estils al token actual
        let styledToken: React.ReactNode = tokenText;
        const style = token.styleInfo;
        if (style) {
            if (style.textDecoration === 'underline') styledToken = <u>{styledToken}</u>;
            if (style.textDecoration === 'line-through') styledToken = <del>{styledToken}</del>;
            if (style.fontStyle === 'italic') styledToken = <em>{styledToken}</em>;
            if (style.fontWeight === 'bold') styledToken = <strong>{styledToken}</strong>;
            // Podríem afegir <span> amb style per fontSize, fontFamily, color si calgués
        }
        contentNodes.push(<React.Fragment key={`token-${index}`}>{styledToken}</React.Fragment>);

        lastIndex = parseInt(token.layout?.textAnchor?.textSegments?.[0]?.endIndex || '-1', 10);
         if (isNaN(lastIndex)) lastIndex = tokenStart + tokenText.length; // Fallback
    });

     // Afegim el tros final de text si n'hi ha
     if (lastIndex < overallEndIndex) {
        contentNodes.push(
            <React.Fragment key="final-gap">{fullText.substring(lastIndex, overallEndIndex)}</React.Fragment>
        );
     }

    return <>{contentNodes}</>; // Retornem un fragment amb tot el contingut
}

/**
 * Component Avançat v4 per Renderitzar Google Document AI
 * Intenta aplicar estils inline i detectar títols.
 */
function GoogleDocumentRenderer({ document }: { document: GoogleDocument }) {
  if (!document || !document.pages || !document.text) { return <p className="text-center text-gray-500 italic py-10">No hi ha dades del document.</p>; }
  const fullText = document.text;

  // Funció Millorada per Renderitzar Taules (usa renderRichText per cel·les)
  const renderTable = (table: Table, pageIndex: number, tableIndex: number, pageTokens: Token[]) => {
      return ( <div key={`page-${pageIndex}-table-${tableIndex}`} className="overflow-x-auto my-6 shadow-lg border border-gray-300 rounded-lg bg-white"> <table className="min-w-full text-sm border-collapse border border-slate-400"> {table.headerRows?.map((hRow: TableRow, hrIndex: number) => ( <thead key={`thead-${hrIndex}`} className="bg-slate-100"> <tr className="border-b-2 border-slate-300"> {hRow.cells?.map((cell: TableCell, cIndex: number) => ( <th key={`th-${hrIndex}-${cIndex}`} className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-700 whitespace-nowrap" colSpan={cell.layout?.colspan && cell.layout.colspan > 1 ? cell.layout.colspan : undefined} rowSpan={cell.layout?.rowSpan && cell.layout.rowSpan > 1 ? cell.layout.rowSpan : undefined} > {renderRichText(cell.layout?.textAnchor, pageTokens, fullText)} </th> ))} </tr> </thead> ))} <tbody className="divide-y divide-slate-200"> {table.bodyRows?.map((bRow: TableRow, brIndex: number) => ( <tr key={`brow-${brIndex}`} className="hover:bg-slate-50"> {bRow.cells?.map((cell: TableCell, cIndex: number) => ( <td key={`bcell-${brIndex}-${cIndex}`} className="border border-slate-300 px-4 py-2 align-top" colSpan={cell.layout?.colspan && cell.layout.colspan > 1 ? cell.layout.colspan : undefined} rowSpan={cell.layout?.rowSpan && cell.layout.rowSpan > 1 ? cell.layout.rowSpan : undefined} > {renderRichText(cell.layout?.textAnchor, pageTokens, fullText)} </td> ))} </tr> ))} </tbody> </table> </div> );
  }; // Fi de renderTable

  // --- Renderització Principal ---
  return (
    <div className="space-y-4 font-serif text-gray-900 text-sm md:text-base leading-relaxed">
      {document.pages.map((page: Page, pageIndex: number) => (
        <div key={`page-${pageIndex}`} className="page-content mb-8 border-t pt-6 border-gray-200 first:border-t-0 first:pt-0">
          {document.pages.length > 1 && ( <p className="text-center text-xs font-semibold text-gray-500 mb-6 pb-2 border-b border-dashed border-gray-300">--- PÀGINA {pageIndex + 1} ---</p> )}

          {/* Renderitzem paràgrafs, llistes i taules */}
          {page.paragraphs?.map((paragraph: Paragraph, pIndex: number) => {
             // Heurística simple per detectar títols
             let isLikelyHeading = false; let headingLevel = 0; const paraTokens = page.tokens?.filter(token => { const tokenStart = parseInt(token.layout?.textAnchor?.textSegments?.[0]?.startIndex || '-1', 10); const paraStart = parseInt(paragraph.layout?.textAnchor?.textSegments?.[0]?.startIndex || '0', 10); const paraEnd = parseInt(paragraph.layout?.textAnchor?.textSegments?.[paragraph.layout.textAnchor.textSegments.length - 1]?.endIndex || '0', 10); return !isNaN(tokenStart) && !isNaN(paraStart) && !isNaN(paraEnd) && tokenStart >= paraStart && tokenStart < paraEnd; }) ?? [];
             if (paraTokens.length > 0) { const averageSize = paraTokens.reduce((sum, t) => sum + (t.styleInfo?.fontSize?.size || 12), 0) / paraTokens.length; const isConsistentlyBold = paraTokens.length > 0 && paraTokens.every(t => t.styleInfo?.fontWeight === 'bold'); if (isConsistentlyBold && averageSize > 14) { isLikelyHeading = true; headingLevel = averageSize > 18 ? 2 : 3; } else if (averageSize > 16) { isLikelyHeading = true; headingLevel = 4; } }

             const content = renderRichText(paragraph.layout?.textAnchor, page.tokens ?? [], fullText);

             if (isLikelyHeading) {
                 const HeadingTag = `h${headingLevel}` as keyof JSX.IntrinsicElements;
                 const headingMargin = `mt-${Math.max(2, 7 - headingLevel)} mb-${Math.max(2, 4 - headingLevel)}`;
                 return <HeadingTag key={`h-${pageIndex}-${pIndex}`} className={`${headingMargin} font-sans font-semibold text-gray-800`}>{content}</HeadingTag>;
             } else {
                 // Podríem comprovar la indentació aquí amb paragraph.layout.boundingPoly si volguéssim
                 const paragraphStyle = 'mb-4 leading-relaxed text-justify';
                 return <p key={`p-${pageIndex}-${pIndex}`} className={paragraphStyle}>{content}</p>;
             }
          })}

           {page.lists?.map((list: List, lIndex: number) => { const ListTag = 'ul'; const listStyle = 'list-disc'; return ( <ListTag key={`list-${pageIndex}-${lIndex}`} className={`${listStyle} list-outside ml-6 md:ml-8 mb-4 space-y-1.5`}> {list.listItems?.map((item: ListItem, iIndex: number) => ( <li key={`item-${pageIndex}-${lIndex}-${iIndex}`}> {renderRichText(item.layout?.textAnchor, page.tokens ?? [], fullText)} </li> ))} </ListTag> ); })}
           {page.tables?.map((table: Table, tIndex: number) => renderTable(table, pageIndex, tIndex, page.tokens ?? []) )}

        </div>
      ))}
       {/* JSON de Debug */}
       <div className="mt-12 pt-6 border-t border-gray-300"> <div className="flex justify-between items-center mb-3"> <h3 className="text-lg font-semibold text-gray-700">Resposta JSON Completa (Debug)</h3> <button onClick={() => { /* ... (download json logic) ... */ }} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md transition-colors duration-150 disabled:opacity-50" disabled={!document} > Descarregar JSON </button> </div> <details className="bg-gray-800 text-white rounded-lg shadow-inner border border-gray-600"> <summary className="text-sm text-gray-400 p-3 cursor-pointer hover:bg-gray-700 rounded-t-lg">Mostra/Amaga JSON</summary> <pre className="whitespace-pre-wrap text-xs text-green-400 p-4 overflow-x-auto font-mono max-h-[600px]"> {JSON.stringify(document, null, 2)} </pre> </details> </div>
    </div>
  );
}


// --- Component Principal de la Pàgina (`Page`) ---
export default function Page() {
  // Estats
  const [images, setImages] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoadingUpload, setIsLoadingUpload] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ara guardem l'objecte document sencer aquí
  const [analysisResult, setAnalysisResult] = useState<GoogleDocument | null>(null);

  // Funció handleApiResponse (sense canvis)
  async function handleApiResponse(res: Response, context: string): Promise<any> { /* ... */ }
  // Gestor de pujada PDF (sense canvis)
  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };

  // Gestor d'anàlisi (ARA NOMÉS ESPERA { result: googleDocument } )
  const handleAnalyzeDocument = async () => {
    if (!pdfUrl) { setError("Error intern: No hi ha URL de PDF."); return; }
    setIsLoadingAnalysis(true); setError(null);
    setAnalysisResult(null); // Neteja resultat anterior

    try {
      const res = await fetch('/api/analyze-document-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pdfUrl }), });
      const data = await handleApiResponse(res, "/api/analyze-document-ai");

      // Validació: assegurem que rebem { result: { ... } }
      if (!data || !data.result || typeof data.result !== 'object' || !Array.isArray(data.result.pages)) {
          console.error("Frontend: Resposta invàlida des del backend simplificat:", data);
          throw new Error("La resposta de l'API d'anàlisi no té l'estructura esperada ('result' amb 'pages').");
       }
      setAnalysisResult(data.result); // Guardem l'objecte 'document' de Google

    } catch (err: any) {
        setError('Error durant l’anàlisi: ' + err.message);
    } finally {
        setIsLoadingAnalysis(false);
    }
  };

  // Renderització JSX (sense canvis estructurals grans)
  return (
     <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 bg-gradient-to-b from-gray-100 to-blue-100 min-h-screen">
       {/* ... Header ... */}
       {/* ... Secció Càrrega ... */}
       {/* ... Secció Accions ... */}
       {/* ... Indicador Anàlisi ... */}

       {/* ===== SECCIÓ RESULTATS (Passant analysisResult al nou renderer) ===== */}
       {analysisResult && !isLoadingUpload && !isLoadingAnalysis && (
         <section aria-labelledby="results-section-title" className="mt-10 mb-10">
           <h2 id="results-section-title" className="text-2xl font-semibold text-gray-800 border-b border-gray-300 pb-4 mb-6 flex items-center"> <span className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">3</span> Resultats de l'Anàlisi </h2>
           {error && <p className="text-center text-red-600 font-semibold mb-6">⚠️ Error Anàlisi: {error}</p>}
           <article aria-label="Document Analitzat" className="bg-white p-6 md:p-10 rounded-xl border border-gray-200 shadow-2xl">
              {/* Passem només el document de Google al renderer avançat */}
              <GoogleDocumentRenderer document={analysisResult} />
           </article>
         </section>
       )}
     </main>
  );
}
