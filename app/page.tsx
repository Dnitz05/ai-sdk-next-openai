'use client';

import { useState } from 'react';

// --- DEFINICIONS DE TIPUS I COMPONENTS/FUNCIONS HELPER ---
interface Formatting {
  alignment?: string;
  style?: string[];
  relative_size?: string;
  // Afegim els nous camps opcionals que pot retornar la IA
  decoration?: string[];
  font_family_type?: string;
  color?: string;
  indentation?: boolean;
}

interface Element {
  type: string;
  level?: number;
  text_content?: string;
  // Formatting podria no venir per algun element, el tipem com a opcional
  formatting?: Formatting; // <-- Fem formatting opcional aquí també
  list_items?: string[];
  table_data?: string[][];
}

/**
 * Genera classes CSS de Tailwind basades en l'objecte de formatació rebut de la IA.
 * VERSIÓ CORREGIDA: Gestiona si 'formatting' és undefined.
 * @param formatting - L'objecte de formatació de l'element (pot ser undefined).
 * @returns Una cadena amb les classes de Tailwind corresponents.
 */
function getFormattingClasses(formatting: Formatting | undefined): string { // <-- Accepta undefined
  // Comprovació clau: si no hi ha objecte formatting, retornem classes per defecte
  if (!formatting) {
    return 'text-left text-base'; // Ex: Alineat esquerra, mida normal
  }

  // Si sí que existeix 'formatting', continuem
  let classes = '';
  switch (formatting.alignment) {
    case 'center': classes += ' text-center'; break;
    case 'right': classes += ' text-right'; break;
    case 'justify': classes += ' text-justify'; break;
    default: classes += ' text-left'; break;
  }
  if (formatting.style?.includes('bold')) { classes += ' font-bold'; }
  if (formatting.style?.includes('italics')) { classes += ' italic'; }
  switch (formatting.relative_size) {
    case 'large': classes += ' text-xl md:text-2xl lg:text-3xl'; break;
    case 'medium': classes += ' text-lg md:text-xl'; break;
    case 'small': classes += ' text-xs'; break;
    case 'normal': default: classes += ' text-base'; break;
  }
  // Aquí afegiríem la lògica per a decoration, font_family_type, color, indentation si volguéssim aplicar-los visualment
  // if (formatting.decoration?.includes('underline')) { classes += ' underline'; }
  // if (formatting.font_family_type === 'serif') { /* potser no cal classe si la base ja és serif */ }
  // ... etc. (De moment només ens assegurem que no peti)
  return classes.trim();
}


/**
 * Component React per renderitzar un únic element estructural.
 * VERSIÓ CORREGIDA: Passa 'element.formatting' (que pot ser undefined) a getFormattingClasses.
 */
function ElementRenderer({ element }: { element: Element }) {
  // Ara 'getFormattingClasses' ja gestiona si 'element.formatting' és undefined
  const formattingClasses = getFormattingClasses(element.formatting);

  // Funció simple per convertir text amb Markdown links a JSX
  const renderTextWithLinks = (text: string | undefined) => {
    if (!text) return null;
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0; let match;
    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) { parts.push(text.substring(lastIndex, match.index)); }
      parts.push( <a href={match[2]} key={`link-${lastIndex}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{match[1]}</a> );
      lastIndex = linkRegex.lastIndex;
    }
    if (lastIndex < text.length) { parts.push(text.substring(lastIndex)); }
    return parts.length === 1 ? parts[0] : parts;
  };

  switch (element.type) {
    case 'heading':
      const level = element.level ?? 2;
      const validLevel = level >= 1 && level <= 6 ? level : 2;
      const Tag = `h${validLevel}` as keyof JSX.IntrinsicElements;
      const headingMargin = `mt-${Math.max(2, 7 - level)} mb-${Math.max(2, 4 - level)}`;
      const headingStyle = validLevel <= 2 ? 'pb-2 border-b border-gray-200' : '';
      return <Tag className={`${formattingClasses} ${headingMargin} ${headingStyle} font-sans font-semibold text-gray-800`}>{renderTextWithLinks(element.text_content)}</Tag>;

    case 'paragraph':
      return <p className={`${formattingClasses} mb-4 leading-relaxed`}>{renderTextWithLinks(element.text_content)}</p>;

    case 'list':
      return ( <ul className={`${formattingClasses} list-disc list-outside mb-4 pl-6 space-y-2`}> {element.list_items?.map((item, index) => ( <li key={index}>{renderTextWithLinks(item)}</li> ))} </ul> );

    case 'table':
      return ( <div className="overflow-x-auto mb-6 shadow-md border border-gray-300 rounded-lg"> <table className={`${formattingClasses} min-w-full text-sm border-collapse`}> {element.table_data && element.table_data.length > 0 && ( <thead className="bg-gray-200"> <tr> {element.table_data[0].map((cell, cellIndex) => ( <th key={`header-cell-${cellIndex}`} className="px-5 py-3 border-b-2 border-gray-300 text-left font-bold text-gray-600 uppercase tracking-wider">{cell}</th> ))} </tr> </thead> )} <tbody className="bg-white"> {element.table_data && element.table_data.length > 1 && element.table_data.slice(1).map((row, rowIndex) => ( <tr key={`body-row-${rowIndex}`} className="border-b border-gray-200 last:border-b-0"> {row.map((cell, cellIndex) => ( <td key={`body-cell-${rowIndex}-${cellIndex}`} className="px-5 py-3 border-r border-gray-200 last:border-r-0 align-top">{renderTextWithLinks(cell)}</td> ))} </tr> ))} </tbody> </table> </div> );

    case 'signature': return <p className={`${formattingClasses} text-sm text-gray-700 mt-10 mb-1 italic`}>{renderTextWithLinks(element.text_content)}</p>;
    case 'date': return <p className={`${formattingClasses} text-sm text-gray-700 mb-6`}>{renderTextWithLinks(element.text_content)}</p>;
    case 'footer': return <p className={`${formattingClasses} text-xs text-gray-500 mt-8 pt-4 border-t border-gray-200`}>{renderTextWithLinks(element.text_content)}</p>;
    case 'other': default: return element.text_content ? <p className={`${formattingClasses} mb-3`}>{renderTextWithLinks(element.text_content)}</p> : null;
  }
}
// --- FI COMPONENTS/FUNCIONS HELPER ---


// --- COMPONENT PRINCIPAL DE LA PÀGINA ---
export default function Page() {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setLoading(true); setError(''); setImages([]); setResults([]); const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData }); if (!res.ok) { let errorData = { error: 'Error generant imatges PDF' }; try { errorData = await res.json(); } catch (e) { console.error("Error no JSON /upload-pdf:", await res.text()); } throw new Error(errorData.error); } const data = await res.json(); setImages(data.pages); } catch (err: any) { setError(err.message); } finally { setLoading(false); } };
  const handleAnalyzeImages = async () => { if (images.length === 0) return; setLoading(true); setError(''); try { const analysisPromises = images.map((image, idx) => fetch('/api/analyze-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }), }).then(async (res) => { if (!res.ok) { let errorData = { error: `Error analitzant pàgina ${idx + 1}` }; try { errorData = await res.json(); } catch(e) { console.error(`Error no JSON /analyze-image p.${idx+1}:`, await res.text());} throw new Error(errorData.error); } const data = await res.json(); if (!data.result || !Array.isArray(data.result.elements)) { throw new Error(`Estructura JSON invàlida rebuda per pàgina ${idx + 1}`); } return { page: idx + 1, analysis: data.result }; }) ); const allResults = await Promise.all(analysisPromises); allResults.sort((a, b) => a.page - b.page); setResults(allResults); } catch (err: any) { setError('Error durant l’anàlisi: ' + err.message); } finally { setLoading(false); } };

  // Renderització JSX
  return ( <main className="p-4 md:p-8 max-w-4xl mx-auto space-y-8"> <h1 className="text-3xl md:text-4xl font-bold text-center mb-10 text-gray-800 tracking-tight">Anàlisi Visual de PDF</h1> <section aria-labelledby="upload-section-title" className="p-5 border rounded-lg shadow-md bg-white"> <h2 id="upload-section-title" className="text-lg font-semibold text-gray-700 mb-3">1. Puja el teu document</h2> <label htmlFor="pdf-upload" className="sr-only">Puja un document PDF</label> <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleUploadPdf} className="w-full border p-2 rounded text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-violet-100 file:text-violet-700 hover:file:bg-violet-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500" disabled={loading}/> {loading && !images.length && <p className="text-center text-blue-600 font-medium mt-4">⏳ Carregant i processant PDF...</p>} {error && !loading && <p className="text-center text-red-600 font-semibold mt-4">⚠️ {error}</p>} </section> {images.length > 0 && !loading && !error && ( <section aria-labelledby="preview-section-title" className="mt-6 p-5 border rounded-lg shadow-md bg-white"> <h2 id="preview-section-title" className="text-lg font-semibold text-gray-700 mb-4">2. Pàgines Detectades</h2> <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6"> {images.map((src, idx) => ( <div key={`thumb-${idx}`} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-200 bg-gray-50"> <img src={src} alt={`Previsualització pàgina ${idx + 1}`} loading="lazy" className="w-full h-auto object-contain" /> <p className="text-center text-xs font-medium p-2 bg-gray-100 border-t">Pàgina {idx + 1}</p> </div> ))} </div> <div className="text-center pt-4 border-t mt-6"> <button onClick={handleAnalyzeImages} className="px-6 py-3 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200" disabled={loading || results.length > 0} > {loading ? 'Analitzant...' : '3. Analitzar Pàgines amb IA'} </button> </div> </section> )} {loading && results.length === 0 && images.length > 0 && ( <p className="text-center text-blue-600 font-medium mt-4">⏳ Analitzant amb IA... Això pot trigar una mica.</p> )} {results.length > 0 && !loading && ( <section aria-labelledby="results-section-title" className="mt-10 space-y-8"> <h2 id="results-section-title" className="text-2xl font-semibold text-gray-800 border-b pb-3 mb-6">4. Resultats de l'Anàlisi</h2> {results.map((pageResult) => ( <article key={`result-${pageResult.page}`} aria-labelledby={`page-title-${pageResult.page}`} className="bg-white p-6 md:p-10 rounded-lg border shadow-xl mb-8"> <h3 id={`page-title-${pageResult.page}`} className="font-bold text-xl mb-6 text-gray-600 border-b pb-3">Pàgina {pageResult.page}</h3> <div className="font-serif text-gray-800 leading-relaxed space-y-3 text-sm md:text-base"> {pageResult.analysis?.elements?.map((element: Element, index: number) => ( <ElementRenderer key={`element-${pageResult.page}-${index}`} element={element} /> ))} </div> </article> ))} </section> )} </main> );
}
