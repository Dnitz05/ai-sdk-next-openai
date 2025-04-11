'use client';

import { useState } from 'react';
import React from 'react';

// --- DEFINICIONS DE TIPUS AMPLIADES ---
interface StyleInfo {
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  fontSize?: { size: number; unit: string };
  fontFamily?: string;
  foregroundColor?: { color: { red?: number; green?: number; blue?: number } };
  backgroundColor?: { color: { red?: number; green?: number; blue?: number } };
}
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

// Funció Helper getText (sense canvis)
const getText = (textAnchor: TextAnchor | undefined, fullText: string): string => {
  if (!textAnchor?.textSegments || !fullText) { return ''; }
  let extractedText = '';
  for (const segment of textAnchor.textSegments) {
    const startIndex = parseInt(segment?.startIndex || '0', 10);
    const endIndex = parseInt(segment?.endIndex || '0', 10);
    if (!isNaN(startIndex) && !isNaN(endIndex) && startIndex >= 0 && endIndex >= startIndex && endIndex <= fullText.length) {
      extractedText += fullText.substring(startIndex, endIndex);
    } else {
      console.warn("Segment índex invàlid:", segment);
    }
  }
  return extractedText;
};

// Funció per convertir color RGB de Google a CSS
function formatCssColor(colorInfo: StyleInfo['foregroundColor']): string | undefined {
  if (!colorInfo?.color) return undefined;
  const r = Math.round((colorInfo.color.red ?? 0) * 255);
  const g = Math.round((colorInfo.color.green ?? 0) * 255);
  const b = Math.round((colorInfo.color.blue ?? 0) * 255);
  // Evitem retornar 'rgb(0, 0, 0)' si no cal (és el color per defecte)
  if (r === 0 && g === 0 && b === 0) return undefined;
  return `rgb(${r}, ${g}, ${b})`;
}

// Funció per mapejar fonts (simplificat)
function mapFontFamily(pdfFont?: string): string | undefined {
    if (!pdfFont) return undefined;
    const font = pdfFont.toLowerCase();
    if (font.includes('times')) return 'serif';
    if (font.includes('arial') || font.includes('helvetica') || font.includes('verdana') || font.includes('sans')) return 'sans-serif';
    if (font.includes('courier') || font.includes('mono')) return 'monospace';
    return 'serif'; // Default genèric
}

/**
 * Funció Avançada v5 per renderitzar text amb estils inline
 * Ara inclou: mida, família (genèrica) i color.
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

    const relevantTokens = pageTokens.filter(token => {
        const tokenStart = parseInt(token.layout?.textAnchor?.textSegments?.[0]?.startIndex || '-1', 10);
        // Tolerància: incloem tokens que comencen just a l'índex final per si de cas
        return !isNaN(tokenStart) && tokenStart >= overallStartIndex && tokenStart <= overallEndIndex;
    }).sort((a, b) => parseInt(a.layout?.textAnchor?.textSegments?.[0]?.startIndex || '0', 10) - parseInt(b.layout?.textAnchor?.textSegments?.[0]?.startIndex || '0', 10));

    if (relevantTokens.length === 0) { return getText(textAnchor, fullText); }

    let lastIndex = overallStartIndex;

    relevantTokens.forEach((token, index) => {
        const tokenText = getText(token.layout?.textAnchor, fullText);
        const tokenStart = parseInt(token.layout?.textAnchor?.textSegments?.[0]?.startIndex || '-1', 10);
        const tokenEnd = parseInt(token.layout?.textAnchor?.textSegments?.[0]?.endIndex || '-1', 10);

        // Només processem si tenim un inici vàlid
        if(isNaN(tokenStart)) return;

        // Afegim text/espais entre l'últim token i l'actual
        if (tokenStart > lastIndex) {
            contentNodes.push(
                <React.Fragment key={`gap-${index}`}>{fullText.substring(lastIndex, tokenStart)}</React.Fragment>
            );
        }

        // Apliquem estils al token actual
        let currentContent: React.ReactNode = tokenText;
        const style = token.styleInfo;
        const inlineStyles: React.CSSProperties = {};

        if (style) {
            // Estils bàsics (negreta, cursiva, etc.)
            if (style.textDecoration === 'underline') currentContent = <u>{currentContent}</u>;
            if (style.textDecoration === 'line-through') currentContent = <del>{currentContent}</del>;
            if (style.fontStyle === 'italic') currentContent = <em>{currentContent}</em>;
            if (style.fontWeight === 'bold') currentContent = <strong>{currentContent}</strong>;

            // Mida de font
            if (style.fontSize?.size && style.fontSize?.unit) {
                inlineStyles.fontSize = `${style.fontSize.size}${style.fontSize.unit}`;
            }
            // Família de font (mapejada)
            const fontFamily = mapFontFamily(style.fontFamily);
            if (fontFamily) {
                inlineStyles.fontFamily = fontFamily;
            }
            // Color de text
            const color = formatCssColor(style.foregroundColor);
            if (color) {
                inlineStyles.color = color;
            }
            // Color de fons (menys comú, però per si de cas)
            // const backgroundColor = formatCssColor(style.backgroundColor);
            // if (backgroundColor) inlineStyles.backgroundColor = backgroundColor;
        }

        // Si hem afegit estils inline, embolcallem amb un span
        if (Object.keys(inlineStyles).length > 0) {
            contentNodes.push(<span key={`token-${index}`} style={inlineStyles}>{currentContent}</span>);
        } else {
            // Si no hi ha estils inline, afegim el contingut (amb possible strong, em, etc.) directament
             contentNodes.push(<React.Fragment key={`token-${index}`}>{currentContent}</React.Fragment>);
        }

        lastIndex = !isNaN(tokenEnd) ? tokenEnd : tokenStart + tokenText.length;
    });

     // Afegim el tros final de text si n'hi ha (i si lastIndex s'ha mogut)
     if (lastIndex > overallStartIndex && lastIndex < overallEndIndex) {
        contentNodes.push(
            <React.Fragment key="final-gap">{fullText.substring(lastIndex, overallEndIndex)}</React.Fragment>
        );
     }

    return <>{contentNodes}</>; // Retornem un fragment amb tot el contingut
}

/**
 * Component Avançat v5 per Renderitzar Google Document AI
 * Amb format inline millorat (mida, font, color)
 */
function GoogleDocumentRenderer({ document }: { document: GoogleDocument }) {
  if (!document || !document.pages || !document.text) { return <p className="text-center text-gray-500 italic py-10">No hi ha dades del document.</p>; }
  const fullText = document.text;

  // Funció per Renderitzar Taules (amb rowspan corregit)
  const renderTable = (table: Table, pageIndex: number, tableIndex: number, pageTokens: Token[]) => {
      return ( <div key={`page-${pageIndex}-table-${tableIndex}`} className="overflow-x-auto my-6 shadow-lg border border-gray-300 rounded-lg bg-white"> <table className="min-w-full text-sm border-collapse border border-slate-400"> {table.headerRows?.map((hRow: TableRow, hrIndex: number) => ( <thead key={`thead-${hrIndex}`} className="bg-slate-100"> <tr className="border-b-2 border-slate-300"> {hRow.cells?.map((cell: TableCell, cIndex: number) => ( <th key={`th-${hrIndex}-${cIndex}`} className="border border-slate-300 px-4 py-2 text-left font-semibold text-slate-700 whitespace-nowrap" colSpan={cell.layout?.colspan && cell.layout.colspan > 1 ? cell.layout.colspan : undefined} rowSpan={cell.layout?.rowspan && cell.layout.rowspan > 1 ? cell.layout.rowspan : undefined} > {renderRichText(cell.layout?.textAnchor, pageTokens, fullText)} </th> ))} </tr> </thead> ))} <tbody className="divide-y divide-slate-200"> {table.bodyRows?.map((bRow: TableRow, brIndex: number) => ( <tr key={`brow-${brIndex}`} className="hover:bg-slate-50"> {bRow.cells?.map((cell: TableCell, cIndex: number) => ( <td key={`bcell-${brIndex}-${cIndex}`} className="border border-slate-300 px-4 py-2 align-top" colSpan={cell.layout?.colspan && cell.layout.colspan > 1 ? cell.layout.colspan : undefined} rowSpan={cell.layout?.rowspan && cell.layout.rowspan > 1 ? cell.layout.rowspan : undefined} > {renderRichText(cell.layout?.textAnchor, pageTokens, fullText)} </td> ))} </tr> ))} </tbody> </table> </div> );
  };

  // --- Renderització Principal ---
  return (
    // Ara fem servir 'prose' de Tailwind per estils tipogràfics base, i space-y per espaiat vertical
    <div className="prose prose-sm md:prose-base max-w-none space-y-4">
      {document.pages.map((page: Page, pageIndex: number) => (
        <div key={`page-${pageIndex}`} className="page-content mb-8 border-t pt-6 border-gray-200 first:border-t-0 first:pt-0">
          {document.pages.length > 1 && ( <p className="text-center text-xs font-semibold text-gray-500 not-prose mb-6 pb-2 border-b border-dashed border-gray-300">--- PÀGINA {pageIndex + 1} ---</p> )}

          {/* Iterem per paràgrafs, llistes i taules */}
          {/* (Nota: L'ordre pot no ser exactament com al PDF original si els elements s'intercalen) */}

          {page.paragraphs?.map((paragraph: Paragraph, pIndex: number) => {
             // Heurística simple per detectar títols (igual que abans)
             let isLikelyHeading = false; let headingLevel = 0; const paraTokens = page.tokens?.filter(token => { const tokenStart = parseInt(token.layout?.textAnchor?.textSegments?.[0]?.startIndex || '-1', 10); const paraStart = parseInt(paragraph.layout?.textAnchor?.textSegments?.[0]?.startIndex || '0', 10); const paraEnd = parseInt(paragraph.layout?.textAnchor?.textSegments?.[paragraph.layout.textAnchor.textSegments.length - 1]?.endIndex || '0', 10); return !isNaN(tokenStart) && !isNaN(paraStart) && !isNaN(paraEnd) && tokenStart >= paraStart && tokenStart < paraEnd; }) ?? [];
             if (paraTokens.length > 0) { const averageSize = paraTokens.reduce((sum, t) => sum + (t.styleInfo?.fontSize?.size || 12), 0) / paraTokens.length; const isConsistentlyBold = paraTokens.length > 0 && paraTokens.every(t => t.styleInfo?.fontWeight === 'bold'); if (isConsistentlyBold && averageSize > 14) { isLikelyHeading = true; headingLevel = averageSize > 18 ? 2 : 3; } else if (averageSize > 16) { isLikelyHeading = true; headingLevel = 4; } }

             const content = renderRichText(paragraph.layout?.textAnchor, page.tokens ?? [], fullText);

             // TODO: Comprovar alineació si Google ho proporciona a paragraph.layout
             const alignmentClass = 'text-justify'; // Mantenim justificat per defecte

             if (isLikelyHeading) {
                 const HeadingTag = `h${headingLevel}` as keyof JSX.IntrinsicElements;
                 // Treiem marges verticals d'aquí, deixem que 'prose' ho gestioni
                 return <HeadingTag key={`h-${pageIndex}-${pIndex}`} className={alignmentClass}>{content}</HeadingTag>;
             } else {
                 // Afegim classe 'not-prose' si volem evitar els estils de 'prose' per a <p> normals
                 return <p key={`p-${pageIndex}-${pIndex}`} className={alignmentClass}>{content}</p>;
             }
          })}

           {page.lists?.map((list: List, lIndex: number) => {
               const ListTag = list.type === 'ORDERED' ? 'ol' : 'ul'; // Respectem el tipus si ve
               const listStyle = ListTag === 'ol' ? 'list-decimal' : 'list-disc';
               // Aplicar 'prose' també a les llistes per bon format
               return ( <ListTag key={`list-${pageIndex}-${lIndex}`} className={`${listStyle} list-outside ml-6 md:ml-8`}> {list.listItems?.map((item: ListItem, iIndex: number) => ( <li key={`item-${pageIndex}-${lIndex}-${iIndex}`}> {renderRichText(item.layout?.textAnchor, page.tokens ?? [], fullText)} </li> ))} </ListTag> );
           })}

           {/* Envolvem les taules amb 'not-prose' per evitar conflictes d'estil */}
           {page.tables?.map((table: Table, tIndex: number) => (
               <div key={`table-wrapper-${pageIndex}-${tIndex}`} className="not-prose">
                  {renderTable(table, pageIndex, tIndex, page.tokens ?? [])}
               </div>
           ))}

        </div> // Fi page-content
      ))}
       {/* JSON de Debug (opcional) */}
       <div className="not-prose mt-12 pt-6 border-t border-gray-300">
           <div className="flex justify-between items-center mb-3">
               <h3 className="text-lg font-semibold text-gray-700">Resposta JSON Completa (Debug)</h3>
               <button onClick={() => { if (!document) return; try { const jsonString = JSON.stringify(document, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = window.document.createElement('a'); a.href = url; a.download = 'google-doc-ai-full-response.json'; window.document.body.appendChild(a); a.click(); setTimeout(() => { window.document.body.removeChild(a); URL.revokeObjectURL(url); }, 100); } catch (error) { console.error("Error descarregant JSON:", error); alert("Error descarregant JSON."); } }} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md transition-colors duration-150 disabled:opacity-50" disabled={!document} > Descarregar JSON </button>
           </div>
           <details className="bg-gray-800 text-white rounded-lg shadow-inner border border-gray-600">
               <summary className="text-sm text-gray-400 p-3 cursor-pointer hover:bg-gray-700 rounded-t-lg">Mostra/Amaga JSON</summary>
               <pre className="whitespace-pre-wrap text-xs text-green-400 p-4 overflow-x-auto font-mono max-h-[600px]">
                   {JSON.stringify(document, null, 2)}
               </pre>
           </details>
       </div>
    </div> // Fi contenidor principal renderer
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
  const [analysisResult, setAnalysisResult] = useState<GoogleDocument | null>(null);

  // Funció handleApiResponse (sense canvis)
  async function handleApiResponse(res: Response, context: string): Promise<any> { /* ... (mateixa funció) ... */ if (res.ok) { try { return await res.json(); } catch (jsonError: any) { throw new Error(`Resposta invàlida (${context}, no JSON).`); } } else { let errorMessage = `Error ${res.status} (${context})`; try { const errorText = await res.text(); try { const errorJson = JSON.parse(errorText); errorMessage = errorJson.error || errorText || errorMessage; } catch (parseError) { errorMessage = errorText || errorMessage; console.warn(`Resp err no JSON (${context}):`, errorText); } } catch (readError: any) { errorMessage = `Error ${res.status} (${context}, resp no llegible)`; } throw new Error(errorMessage); } }

  // *** Gestor d'anàlisi (Ara accepta URL i valida) ***
  const handleAnalyzeDocument = async (urlToAnalyze: string) => {
    if (!urlToAnalyze) {
        setError("Error intern: Falta la URL del PDF per analitzar.");
        return;
    }
    console.log(`Iniciant anàlisi per: ${urlToAnalyze}`);
    setIsLoadingAnalysis(true);
    setError(null);
    setAnalysisResult(null); // Neteja resultat anterior

    try {
      const res = await fetch('/api/analyze-document-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pdfUrl: urlToAnalyze }), // Envia la URL rebuda
      });
      const data = await handleApiResponse(res, "/api/analyze-document-ai");

      // Validació (espera { result: { pages: [...] ... } })
      if (!data || !data.result || !Array.isArray(data.result.pages)) {
           console.error("Frontend: Resposta invàlida del backend:", data);
           throw new Error("La resposta de l'API d'anàlisi no té l'estructura esperada ('result' amb 'pages').");
       }
      console.log("Anàlisi completada, rebudes dades:", data.result);
      setAnalysisResult(data.result); // Guardem l'objecte 'document' de Google

    } catch (err: any) {
        console.error("Error dins handleAnalyzeDocument:", err);
        setError('Error durant l’anàlisi: ' + err.message);
    } finally {
        setIsLoadingAnalysis(false);
        console.log("handleAnalyzeDocument finalitzat.");
    }
  }; // Fi handleAnalyzeDocument

  // *** Gestor de pujada PDF (Ara crida handleAnalyzeDocument) ***
  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingUpload(true);
    setError(null);
    setImages([]);
    setPdfUrl(null);
    setAnalysisResult(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log("Iniciant pujada PDF...");
      const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData });
      const data = await handleApiResponse(res, "/api/upload-pdf");
      console.log("Pujada PDF completada, resposta:", data);

      if (!data.pdfUrl) {
        throw new Error("L'API d'upload no va retornar la pdfUrl.");
      }

      setImages(data.pages ?? []);
      setPdfUrl(data.pdfUrl); // Guardem URL per si de cas, encara que l'anàlisi és automàtica

      // *** Disparar Anàlisi Automàticament ***
      console.log("Pujada amb èxit, iniciant anàlisi automàtica...");
      await handleAnalyzeDocument(data.pdfUrl); // Cridem l'anàlisi passant la URL

    } catch (err: any) {
      console.error("Error dins handleUploadPdf:", err);
      setError(err.message || 'Error durant la pujada o inici de l\'anàlisi.');
      setPdfUrl(null); // Assegurem neteja
    } finally {
      setIsLoadingUpload(false); // Indiquem que la pujada (el primer pas) ha acabat
      console.log("handleUploadPdf finalitzat.");
      // No cal canviar isLoadingAnalysis aquí, ho fa handleAnalyzeDocument
    }
  }; // Fi handleUploadPdf


  // Renderització JSX
  return (
     <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 bg-gray-100 min-h-screen">
       <header className="text-center pt-8 pb-4">
           <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight">
               Analitzador Intel·ligent de PDF
           </h1>
           <p className="text-md md:text-lg text-gray-600 mt-3">
               Puja un document per extreure text, estructura i format usant <span className="font-semibold text-blue-600">Google Document AI</span>
           </p>
       </header>

       {/* Secció Càrrega */}
       <section aria-labelledby="upload-section-title" className="p-6 border rounded-xl shadow-lg bg-white">
            <h2 id="upload-section-title" className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
                <span className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">1</span> Pujar Document PDF
            </h2>
            <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={handleUploadPdf}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 active:file:bg-blue-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150 ease-in-out"
                // Es deshabilita durant la pujada O l'anàlisi que ara és automàtica
                disabled={isLoadingUpload || isLoadingAnalysis}
            />
            <div className="mt-4 text-center h-10 flex items-center justify-center"> {/* Augmentat alçada per missatges */}
                {isLoadingUpload && <p className="text-sm text-blue-600 font-medium animate-pulse">⏳ Carregant PDF...</p>}
                {/* Mostrem indicador d'anàlisi aquí si la pujada ha acabat però l'anàlisi no */}
                {isLoadingAnalysis && !isLoadingUpload && (
                    <p className="text-sm text-blue-600 font-medium mt-4 flex items-center justify-center space-x-2">
                         <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         <span>Analitzant document...</span>
                     </p>
                )}
                {error && !isLoadingUpload && !isLoadingAnalysis && <p className="text-sm text-red-600 font-semibold">⚠️ Error: {error}</p>}
                {/* Missatge d'èxit quan tot ha acabat */}
                {!isLoadingUpload && !isLoadingAnalysis && analysisResult && !error && <p className="text-sm text-green-700 font-medium">✅ Anàlisi completada.</p>}
                 {/* Missatge inicial o si només hi ha miniatures (poc probable ara) */}
                 {!isLoadingUpload && !isLoadingAnalysis && !analysisResult && !error && pdfUrl && <p className="text-sm text-gray-500">Esperant resultats...</p>}

            </div>
       </section>

       {/* Secció Accions ELIMINADA (ja no cal botó Analitzar) */}
       {/* Si volguéssim mantenir les miniatures, les posaríem en una secció separada */}
       {/* Opcional: Secció Previsualització (si encara es vol) */}
       {images.length > 0 && !isLoadingUpload && (
            <section aria-labelledby="preview-section-title" className="mt-6 p-6 border rounded-xl shadow-lg bg-white">
                 <h2 id="preview-section-title" className="text-xl font-semibold text-gray-700 mb-5 flex items-center">
                    <span className="bg-gray-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">🖼️</span> Previsualització (Miniatures)
                 </h2>
                 <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 bg-gray-100 p-4 rounded-lg border">
                      {images.map((src, idx) => (
                          <a href={src} target="_blank" rel="noopener noreferrer" key={`thumb-${idx}`} className="block border rounded-md overflow-hidden shadow hover:shadow-lg transition-shadow duration-200 bg-white group">
                              <img src={src} alt={`Miniatura ${idx + 1}`} loading="lazy" className="w-full h-auto object-contain p-1 group-hover:opacity-80 transition-opacity" />
                              <p className="text-center text-xs font-medium py-1 px-2 bg-gray-50 border-t">P. {idx + 1}</p>
                          </a>
                      ))}
                  </div>
            </section>
        )}


       {/* ===== SECCIÓ RESULTATS ===== */}
       {/* Ara es mostra quan analysisResult té dades (i ja no estem carregant) */}
       {analysisResult && !isLoadingAnalysis && (
         <section aria-labelledby="results-section-title" className="mt-10 mb-10">
           <h2 id="results-section-title" className="text-2xl font-semibold text-gray-800 border-b border-gray-300 pb-4 mb-6 flex items-center">
               <span className="bg-blue-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-sm font-bold mr-3">📄</span> Resultats de l'Anàlisi
           </h2>
           {/* Mostrem error si n'hi ha hagut durant l'anàlisi */}
           {error && <p className="text-center text-red-600 font-semibold mb-6 p-3 bg-red-50 border border-red-200 rounded">⚠️ Error durant l'anàlisi: {error}</p>}
           <article aria-label="Document Analitzat" className="bg-white p-6 md:p-10 rounded-xl border border-gray-200 shadow-2xl">
              <GoogleDocumentRenderer document={analysisResult} />
           </article>
         </section>
       )}
     </main>
  );
}
