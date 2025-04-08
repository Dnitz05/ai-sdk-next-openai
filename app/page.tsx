'use client';

import { useState } from 'react';
import React from 'react'; // Importem React per a JSX

// --- DEFINICIONS DE TIPUS I COMPONENTS/FUNCIONS HELPER ---
interface Formatting {
  alignment?: string;
  style?: string[];
  relative_size?: string;
  decoration?: string[];
  font_family_type?: string;
  color?: string;
  indentation?: boolean;
}

interface Element {
  type: string;
  level?: number;
  text_content?: string;
  formatting?: Formatting; // Fem formatting opcional
  list_items?: string[];
  table_data?: string[][];
}

/**
 * Funció helper per obtenir un color distintiu per a la vora esquerra segons el tipus d'element.
 */
function getElementTypeColor(type: string): string {
    switch (type) {
        case 'heading': return '#1E3A8A'; // blue-900
        case 'table': return '#065F46'; // emerald-800
        case 'list': return '#9D174D'; // pink-800
        case 'paragraph': return '#78716C'; // stone-500
        case 'signature': case 'date': return '#7C2D12'; // orange-900
        default: return '#A1A1AA'; // zinc-400
    }
}

/**
 * Component React per renderitzar un únic element estructural
 * AMB VISUALITZACIÓ MILLORADA DE METADADES (Tipus i Format Descrit).
 */
function ElementRenderer({ element }: { element: Element }) {
  // Obtenim l'objecte formatting, o un objecte buit si no existeix
  const formatting = element.formatting ?? {};

  // Funció helper per mostrar "tags" o "pills" amb la informació de format detectada
  const renderFormattingTags = (fmt: Formatting) => {
    const tags: { label: string, value: string | boolean | string[] | undefined }[] = [
        // Afegim només els atributs que tenen valor i no són el default "visual"
        { label: 'Align', value: fmt.alignment && fmt.alignment !== 'left' ? fmt.alignment : undefined },
        { label: 'Style', value: fmt.style?.filter(s => s === 'bold' || s === 'italics') }, // Només bold/italics
        { label: 'Decor', value: fmt.decoration },
        { label: 'Size', value: fmt.relative_size && fmt.relative_size !== 'normal' ? fmt.relative_size : undefined },
        { label: 'Font', value: fmt.font_family_type && fmt.font_family_type !== 'unknown' ? fmt.font_family_type : undefined },
        { label: 'Color', value: fmt.color && fmt.color !== 'black' ? fmt.color : undefined },
        { label: 'Indent', value: fmt.indentation === true ? 'yes' : undefined },
    ];

    const validTags = tags.filter(tag => tag.value && (!Array.isArray(tag.value) || tag.value.length > 0));

    if (validTags.length === 0) return null; // No mostrem res si no hi ha format destacable

    return (
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-medium text-gray-500">Format:</span>
        {validTags.map(tag => (
          <span key={tag.label} className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full border border-gray-200">
            {tag.label}: {Array.isArray(tag.value) ? tag.value.join(', ') : String(tag.value)}
          </span>
        ))}
      </div>
    );
  };

  // Funció simple per convertir text amb Markdown links a JSX (sense canvis)
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

  // --- Renderització del contenidor per a l'element ---
  return (
    // Contenidor amb vora esquerra colorejada segons tipus
    <div className="mb-4 pl-3 py-2 border-l-4 rounded-r-sm bg-white hover:bg-gray-50 transition-colors duration-150"
         style={{ borderColor: getElementTypeColor(element.type) }}
    >
      {/* Etiqueta petita indicant el tipus d'element */}
      <span className="block text-xs font-bold uppercase tracking-wider mb-1"
            style={{ color: getElementTypeColor(element.type) }}
      >
        {element.type}{element.type === 'heading' && element.level ? ` ${element.level}` : ''}
      </span>

      {/* Contingut principal de l'element */}
      <div className="main-content text-gray-800">
        {(() => {
          // Apliquem només estils bàsics directament (negreta/cursiva)
          let contentClasses = '';
          if (formatting.style?.includes('bold')) contentClasses += ' font-semibold'; // Semibold en lloc de bold per menys contrast
          if (formatting.style?.includes('italics')) contentClasses += ' italic';

          switch (element.type) {
            case 'heading':
              // Títols amb mida base, la mida real es veu als tags de format
              const level = element.level ?? 2;
              const Tag = `h${level >= 1 && level <= 6 ? level : 2}` as keyof JSX.IntrinsicElements;
              // Fem servir mides de font estàndard per H tags i sobreescrivim si cal amb classes
               return <Tag className={`${contentClasses} font-sans text-lg md:text-xl`}>{renderTextWithLinks(element.text_content)}</Tag>;

            case 'paragraph':
              return <p className={`${contentClasses} leading-normal`}>{renderTextWithLinks(element.text_content)}</p>;

            case 'list':
              // Llistes sense format extra aplicat directament, es veurà als tags
              return ( <ul className="list-disc list-outside ml-5 space-y-1"> {element.list_items?.map((item, index) => ( <li key={index} className={contentClasses}>{renderTextWithLinks(item)}</li> ))} </ul> );

            case 'table':
              // Taula amb estil molt net i bàsic
              return (
                <div className="overflow-x-auto mt-2 shadow-sm border border-gray-300 rounded">
                  <table className="min-w-full text-xs md:text-sm border-collapse">
                    {element.table_data && element.table_data.length > 0 && (
                      <thead className="bg-gray-100">
                        <tr>{element.table_data[0].map((cell, cellIndex) => ( <th key={`hcell-${cellIndex}`} className="px-3 py-2 border border-gray-200 text-left font-medium text-gray-600">{cell}</th> ))}</tr>
                      </thead>
                    )}
                    <tbody className="bg-white divide-y divide-gray-200">
                      {element.table_data && element.table_data.length > 1 && element.table_data.slice(1).map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`} className="hover:bg-gray-50">
                          {row.map((cell, cellIndex) => ( <td key={`cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 border border-gray-200 align-top">{renderTextWithLinks(cell)}</td> ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );

            // Altres tipus: mostrem el text amb estil bàsic
            case 'signature': case 'date': case 'footer': case 'other': default:
              return element.text_content ? <p className={`${contentClasses}`}>{renderTextWithLinks(element.text_content)}</p> : null;
          }
        })()}
      </div>

      {/* Mostrem els tags amb la informació de format detectada */}
      {renderFormattingTags(formatting)}

    </div>
  );
}
// --- FI COMPONENTS/FUNCIONS HELPER ---


// --- COMPONENT PRINCIPAL DE LA PÀGINA ---
export default function Page() {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<any[]>([]);

  // Gestor de pujada de PDF (sense canvis respecte l'última versió completa)
  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setLoading(true); setError(''); setImages([]); setResults([]); const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData }); if (!res.ok) { let errorData = { error: 'Error generant imatges PDF' }; try { errorData = await res.json(); } catch (e) { console.error("Error no JSON /upload-pdf:", await res.text()); } throw new Error(errorData.error); } const data = await res.json(); setImages(data.pages); } catch (err: any) { setError(err.message); } finally { setLoading(false); } };

  // Gestor per analitzar les imatges amb IA (sense canvis respecte l'última versió completa)
  const handleAnalyzeImages = async () => { if (images.length === 0) return; setLoading(true); setError(''); try { const analysisPromises = images.map((image, idx) => fetch('/api/analyze-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }), }).then(async (res) => { if (!res.ok) { let errorData = { error: `Error analitzant pàgina ${idx + 1}` }; try { errorData = await res.json(); } catch(e) { console.error(`Error no JSON /analyze-image p.${idx+1}:`, await res.text());} throw new Error(errorData.error); } const data = await res.json(); if (!data.result || !Array.isArray(data.result.elements)) { throw new Error(`Estructura JSON invàlida rebuda per pàgina ${idx + 1}`); } return { page: idx + 1, analysis: data.result }; }) ); const allResults = await Promise.all(analysisPromises); allResults.sort((a, b) => a.page - b.page); setResults(allResults); } catch (err: any) { setError('Error durant l’anàlisi: ' + err.message); } finally { setLoading(false); } };

  // Renderització JSX del component
  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-8"> {/* Augmentat max-w a 5xl */}
      <h1 className="text-3xl md:text-4xl font-bold text-center mb-10 text-gray-900 tracking-tight">Anàlisi Visual de PDF</h1>

      {/* Secció Càrrega */}
      <section aria-labelledby="upload-section-title" className="p-5 border rounded-lg shadow-md bg-white">
        {/* ... (sense canvis) ... */}
         <h2 id="upload-section-title" className="text-lg font-semibold text-gray-700 mb-3">1. Puja el teu document</h2>
         <label htmlFor="pdf-upload" className="sr-only">Puja un document PDF</label>
         <input id="pdf-upload" type="file" accept="application/pdf" onChange={handleUploadPdf} className="w-full border p-2 rounded text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-violet-100 file:text-violet-700 hover:file:bg-violet-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500" disabled={loading}/>
         {loading && !images.length && <p className="text-center text-blue-600 font-medium mt-4">⏳ Carregant i processant PDF...</p>}
         {error && !loading && <p className="text-center text-red-600 font-semibold mt-4">⚠️ {error}</p>}
      </section>

      {/* Secció Miniatures i Botó Analitzar */}
      {images.length > 0 && !loading && !error && (
        <section aria-labelledby="preview-section-title" className="mt-6 p-5 border rounded-lg shadow-md bg-white">
           {/* ... (sense canvis) ... */}
           <h2 id="preview-section-title" className="text-lg font-semibold text-gray-700 mb-4">2. Pàgines Detectades</h2>
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
             {images.map((src, idx) => ( <div key={`thumb-${idx}`} className="border rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-200 bg-gray-50"> <img src={src} alt={`Previsualització pàgina ${idx + 1}`} loading="lazy" className="w-full h-auto object-contain" /> <p className="text-center text-xs font-medium p-2 bg-gray-100 border-t">Pàgina {idx + 1}</p> </div> ))}
           </div>
           <div className="text-center pt-4 border-t mt-6"> <button onClick={handleAnalyzeImages} className="px-6 py-3 bg-green-600 text-white rounded-md font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200" disabled={loading || results.length > 0} > {loading ? 'Analitzant...' : '3. Analitzar Pàgines amb IA'} </button> </div>
        </section>
      )}

      {/* Indicador durant anàlisi */}
      {loading && results.length === 0 && images.length > 0 && ( <p className="text-center text-blue-600 font-medium mt-4">⏳ Analitzant amb IA... Això pot trigar una mica.</p> )}

      {/* ===== SECCIÓ RESULTATS VISUALITZATS (AMB NOU ENFOCAMENT) ===== */}
      {results.length > 0 && !loading && (
        <section aria-labelledby="results-section-title" className="mt-10 space-y-8">
          <h2 id="results-section-title" className="text-2xl font-semibold text-gray-800 border-b pb-3 mb-6">4. Resultats de l'Anàlisi (Estructura i Format Detectat)</h2>
          {results.map((pageResult) => (
            // Targeta per a cada pàgina analitzada
            <article key={`result-${pageResult.page}`} aria-labelledby={`page-title-${pageResult.page}`} className="bg-gray-50 p-5 md:p-8 rounded-lg border border-gray-200 shadow-sm mb-8">
              <h3 id={`page-title-${pageResult.page}`} className="font-bold text-lg md:text-xl mb-6 text-gray-700 border-b border-gray-300 pb-3">Pàgina {pageResult.page}</h3>
              {/* Contenidor per als elements renderitzats */}
              <div className="text-gray-800 text-sm md:text-base"> {/* Mida base del text */}
                 {/* Iterem sobre els elements del JSON i usem ElementRenderer */}
                 {pageResult.analysis?.elements?.map((element: Element, index: number) => (
                   <ElementRenderer key={`element-${pageResult.page}-${index}`} element={element} />
                 ))}
              </div>
            </article>
          ))}
        </section>
      )}
      {/* ===== FI SECCIÓ RESULTATS ===== */}
    </main>
  );
}
