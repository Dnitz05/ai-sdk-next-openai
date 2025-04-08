'use client';

import { useState } from 'react';

// --- DEFINICIONS DE TIPUS I COMPONENTS/FUNCIONS HELPER ---
// (Definits fora del component principal per claredat i bones pràctiques)

interface Formatting {
  alignment?: string;
  style?: string[];
  relative_size?: string;
}

interface Element {
  type: string;
  level?: number; // Opcional
  text_content?: string;
  formatting: Formatting;
  list_items?: string[];
  table_data?: string[][];
}

/**
 * Genera classes CSS de Tailwind basades en l'objecte de formatació rebut de la IA.
 * @param formatting - L'objecte de formatació de l'element.
 * @returns Una cadena amb les classes de Tailwind corresponents.
 */
function getFormattingClasses(formatting: Formatting): string {
  let classes = '';
  // Alineació
  switch (formatting.alignment) {
    case 'center': classes += ' text-center'; break;
    case 'right': classes += ' text-right'; break;
    case 'justify': classes += ' text-justify'; break;
    default: classes += ' text-left'; break;
  }
  // Estil (negreta/cursiva)
  if (formatting.style?.includes('bold')) {
    classes += ' font-bold';
  }
  if (formatting.style?.includes('italics')) {
    classes += ' italic';
  }
  // Mida relativa (Ajustades per a més impacte visual)
  switch (formatting.relative_size) {
    case 'large': classes += ' text-xl md:text-2xl lg:text-3xl'; break;
    case 'medium': classes += ' text-lg md:text-xl'; break;
    case 'small': classes += ' text-xs'; break;
    case 'normal':
    default: classes += ' text-base'; break; // Mida base per defecte
  }
  return classes.trim();
}

/**
 * Component React per renderitzar un únic element estructural
 * (títol, paràgraf, llista, taula, etc.) basant-se en l'objecte element.
 * @param element - L'objecte element extret per la IA.
 * @returns El JSX corresponent a l'element.
 */
function ElementRenderer({ element }: { element: Element }) {
  const formattingClasses = getFormattingClasses(element.formatting);

  switch (element.type) {
    case 'heading':
      // === INICI CORRECCIÓ TYPESCRIPT ===
      // Assignem un nivell per defecte (2) si element.level és undefined o null
      const level = element.level ?? 2;
      // Ens assegurem que el nivell estigui entre 1 i 6 per a les etiquetes H HTML vàlides
      const validLevel = level >= 1 && level <= 6 ? level : 2;
      const Tag = `h${validLevel}` as keyof JSX.IntrinsicElements;
      // Calculem el marge usant el 'level' (que ara sabem que és un número)
      const headingMargin = `mt-${Math.max(2, 7 - level)} mb-${Math.max(1, 4 - level)}`;
      // === FI CORRECCIÓ TYPESCRIPT ===
      return <Tag className={`${formattingClasses} ${headingMargin} font-sans font-semibold`}>{element.text_content}</Tag>;

    case 'paragraph':
      // Paràgrafs amb interlineat relaxat i marge inferior
      return <p className={`${formattingClasses} mb-4 leading-relaxed`}>{element.text_content}</p>;

    case 'list':
      // Renderitza llistes (assumeix 'ul' per defecte) amb indentació i espaiat
      return (
        <ul className={`${formattingClasses} list-disc list-outside mb-4 pl-6 space-y-1`}>
          {element.list_items?.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      );

    case 'table':
      // Renderitza taules amb estils millorats (vores, padding, files alternades, capçalera)
      return (
        <div className="overflow-x-auto mb-6 shadow-sm border border-gray-200 rounded-md">
          <table className={`${formattingClasses} min-w-full text-sm border-collapse`}>
            {/* Capçalera: Renderitza la primera fila amb <th> si existeix */}
            {element.table_data && element.table_data.length > 0 && (
              <thead className="bg-gray-100">
                <tr>
                  {element.table_data[0].map((cell, cellIndex) => (
                    <th key={`header-cell-${cellIndex}`} className="px-4 py-2 border border-gray-300 text-left font-semibold text-gray-700">{cell}</th>
                  ))}
                </tr>
              </thead>
            )}
            {/* Cos: Renderitza la resta de files amb <td> */}
            <tbody className="bg-white">
              {element.table_data && element.table_data.length > 1 && element.table_data.slice(1).map((row, rowIndex) => (
                <tr key={`body-row-${rowIndex}`} className="odd:bg-white even:bg-gray-50">
                  {row.map((cell, cellIndex) => (
                    <td key={`body-cell-${rowIndex}-${cellIndex}`} className="px-4 py-2 border border-gray-300 align-top">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'signature':
      // Signatura amb marge superior
      return <p className={`${formattingClasses} text-sm text-gray-700 mt-8 mb-1`}>{element.text_content}</p>;

     case 'date':
       // Data
       return <p className={`${formattingClasses} text-sm text-gray-700 mb-4`}>{element.text_content}</p>;

    case 'footer':
      // Peu de pàgina amb línia superior
      return <p className={`${formattingClasses} text-xs text-gray-500 mt-6 pt-4 border-t`}>{element.text_content}</p>;

    case 'other':
    default:
      // Per a tipus desconeguts o 'other', mostra el text com a paràgraf
      return element.text_content ? <p className={`${formattingClasses} mb-3`}>{element.text_content}</p> : null;
  }
}
// --- FI COMPONENTS/FUNCIONS HELPER ---


// --- COMPONENT PRINCIPAL DE LA PÀGINA ---
export default function Page() {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<any[]>([]); // Guarda els objectes {page, analysis}

  // Gestor de pujada de PDF
  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setLoading(true); setError(''); setImages([]); setResults([]); const formData = new FormData(); formData.append('file', file); try { const res = await fetch('/api/upload-pdf', { method: 'POST', body: formData }); if (!res.ok) { let errorData = { error: 'Error generant imatges PDF' }; try { errorData = await res.json(); } catch (e) { console.error("Error no JSON /upload-pdf:", await res.text()); } throw new Error(errorData.error); } const data = await res.json(); setImages(data.pages); } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  // Gestor per analitzar les imatges amb IA
  const handleAnalyzeImages = async () => {
     if (images.length === 0) return; setLoading(true); setError(''); try { const analysisPromises = images.map((image, idx) => fetch('/api/analyze-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }), }).then(async (res) => { if (!res.ok) { let errorData = { error: `Error analitzant pàgina ${idx + 1}` }; try { errorData = await res.json(); } catch(e) { console.error(`Error no JSON /analyze-image p.${idx+1}:`, await res.text());} throw new Error(errorData.error); } const data = await res.json(); if (!data.result || !Array.isArray(data.result.elements)) { throw new Error(`Estructura JSON invàlida rebuda per pàgina ${idx + 1}`); } return { page: idx + 1, analysis: data.result }; }) ); const allResults = await Promise.all(analysisPromises); allResults.sort((a, b) => a.page - b.page); setResults(allResults); } catch (err: any) { setError('Error durant l’anàlisi: ' + err.message); } finally { setLoading(false); }
  };

  // Renderització JSX del component
  return (
    <main className="p-4 md:p-8 max-w-4xl mx-auto space-y-8"> {/* Ajustat max-w a 4xl */}
      <h1 className="text-2xl md:text-3xl font-bold text-center mb-8 text-gray-800">Anàlisi Visual de PDF</h1>

      {/* Secció Càrrega */}
      <div className="flex flex-col gap-2 p-4 border rounded shadow-sm bg-white">
        <label htmlFor="pdf-upload" className="font-medium text-gray-700">Puja un document PDF</label>
        <input
          id="pdf-upload"
          type="file"
          accept="application/pdf"
          onChange={handleUploadPdf}
          className="w-full border p-2 rounded text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 disabled:opacity-50 cursor-pointer"
          disabled={loading}
        />
      </div>

      {loading && <p className="text-center text-blue-600 font-medium">⏳ Processant... Si us plau, espera.</p>}
      {error && <p className="text-center text-red-600 font-semibold p-3 bg-red-50 border border-red-200 rounded">⚠️ {error}</p>}

      {/* Secció Miniatures */}
      {images.length > 0 && !loading && !error && (
        <div className="mt-6 p-4 border rounded shadow-sm bg-white">
           <h2 className="text-xl font-semibold text-gray-800 mb-4">Pàgines Detectades:</h2>
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
             {images.map((src, idx) => (
               <div key={`thumb-${idx}`} className="border rounded overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                 <img src={src} alt={`Pàgina ${idx + 1}`} loading="lazy" className="w-full h-auto object-contain bg-gray-50" />
                 <p className="text-center text-xs font-medium p-2 bg-gray-100 border-t">Pàgina {idx + 1}</p>
               </div>
             ))}
           </div>
           <div className="text-center">
             <button
               onClick={handleAnalyzeImages}
               className="px-6 py-3 bg-green-600 text-white rounded font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                // Deshabilitem si ja s'està analitzant o si ja hi ha resultats per evitar re-anàlisi
               disabled={loading || results.length > 0}
             >
               Analitzar totes les pàgines amb IA
             </button>
           </div>
        </div>
      )}

      {/* Secció Resultats Visualitzats */}
      {results.length > 0 && !loading && (
        <div className="mt-8 space-y-6">
          <h2 className="text-2xl font-semibold text-gray-800 border-b pb-2 mb-6">Resultats de l'Anàlisi:</h2>
          {results.map((pageResult) => (
            // Targeta per a cada pàgina analitzada
            <div key={`result-${pageResult.page}`} className="bg-white p-5 md:p-8 rounded border shadow-lg mb-8">
              <h3 className="font-bold text-xl mb-6 text-gray-700 border-b pb-3">Pàgina {pageResult.page}</h3>
              {/* Contenidor per al contingut renderitzat amb font base */}
              <div className="font-serif text-gray-900 leading-relaxed space-y-3 text-sm"> {/* Font serif, interlineat, espai entre elements */}
                 {/* Usem ElementRenderer per cada element detectat */}
                 {pageResult.analysis?.elements?.map((element: Element, index: number) => (
                   <ElementRenderer key={`element-${pageResult.page}-${index}`} element={element} />
                 ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
