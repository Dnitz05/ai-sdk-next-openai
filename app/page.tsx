'use client';

import { useState } from 'react';

// --- NOU COMPONENT PER RENDERITZAR ELEMENTS INDIVIDUALS ---
interface Formatting {
  alignment?: string;
  style?: string[];
  relative_size?: string;
}

interface Element {
  type: string;
  level?: number;
  text_content?: string;
  formatting: Formatting;
  list_items?: string[];
  table_data?: string[][];
}

// Funció helper per obtenir classes CSS de Tailwind basades en el format
function getFormattingClasses(formatting: Formatting): string {
  let classes = '';
  // Alineació
  switch (formatting.alignment) {
    case 'center': classes += ' text-center'; break;
    case 'right': classes += ' text-right'; break;
    case 'justify': classes += ' text-justify'; break;
    default: classes += ' text-left'; break; // Per defecte a l'esquerra
  }
  // Estil (negreta/cursiva)
  if (formatting.style?.includes('bold')) {
    classes += ' font-bold';
  }
  if (formatting.style?.includes('italics')) {
    classes += ' italic';
  }
  // Mida relativa (ajusta les classes de mida segons necessitis)
  switch (formatting.relative_size) {
    case 'large': classes += ' text-xl md:text-2xl'; break; // Mida més gran
    case 'medium': classes += ' text-lg md:text-xl'; break; // Mida mitjana
    case 'small': classes += ' text-sm'; break;      // Mida petita
    // 'normal' no necessita classe extra si la base és 'text-base'
  }
  return classes.trim(); // Treu espais inicials/finals
}

function ElementRenderer({ element }: { element: Element }) {
  const formattingClasses = getFormattingClasses(element.formatting);

  switch (element.type) {
    case 'heading':
      const Tag = `h${element.level || 2}` as keyof JSX.IntrinsicElements; // h2 per defecte si no hi ha nivell
      // Afegim més marge inferior als títols
      const headingMargin = `mb-${6 - (element.level || 2)}`; // Més marge per H1, menys per H6
      return <Tag className={`${formattingClasses} ${headingMargin}`}>{element.text_content}</Tag>;

    case 'paragraph':
      return <p className={`${formattingClasses} mb-3`}>{element.text_content}</p>; // Marge inferior per paràgrafs

    case 'list':
      // Assumim llista desordenada (ul) si la IA no especifica més
      return (
        <ul className={`${formattingClasses} list-disc list-inside mb-3 pl-4`}>
          {element.list_items?.map((item, index) => (
            <li key={index} className="mb-1">{item}</li>
          ))}
        </ul>
      );

    case 'table':
      return (
        <div className="overflow-x-auto mb-4"> {/* Permet scroll horitzontal si la taula és ampla */}
           <table className={`${formattingClasses} min-w-full border border-gray-300 text-sm`}>
             <tbody className="bg-white divide-y divide-gray-200">
               {element.table_data?.map((row, rowIndex) => (
                 <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50' : ''}>
                   {row.map((cell, cellIndex) => (
                     // Podríem marcar la primera fila com a header (th) si volguéssim més lògica
                     <td key={cellIndex} className="px-4 py-2 border border-gray-200">{cell}</td>
                   ))}
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      );

    case 'signature':
    case 'date':
    case 'footer':
    case 'other':
      // Renderitzem aquests tipus com a paràgrafs, aplicant format
      return <p className={`${formattingClasses} text-sm text-gray-600 mb-2`}>{element.text_content}</p>;

    default:
      // Si és un tipus desconegut, mostrem el text si n'hi ha
      return element.text_content ? <p className={formattingClasses}>{element.text_content}</p> : null;
  }
}
// --- FI DEL NOU COMPONENT ---


export default function Page() {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<any[]>([]); // Guardem els objectes d'anàlisi

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setImages([]);
    setResults([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        let errorData = { error: 'Error desconegut del servidor generant imatges' };
        try { errorData = await res.json(); } catch (e) { console.error("Resp err /api/upload-pdf no JSON:", await res.text()); }
        throw new Error(errorData.error || 'Error desconegut');
      }
      const data = await res.json();
      setImages(data.pages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeImages = async () => {
    if (images.length === 0) return;

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const analysisPromises = images.map((image, idx) =>
        fetch('/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image }),
        }).then(async (res) => {
          if (!res.ok) {
            let errorData = { error: `Error analitzant pàgina ${idx + 1}` };
             try { errorData = await res.json(); } catch(e) { console.error(`Resp err /analyze-image ${idx+1} no JSON:`, await res.text());}
            throw new Error(errorData.error || `Error desconegut analitzant pàgina ${idx + 1}`);
          }
          const data = await res.json();
          if (!data.result || !data.result.elements) { // Validació bàsica del JSON rebut
             throw new Error(`Estructura JSON invàlida rebuda per pàgina ${idx + 1}`);
          }
          return { page: idx + 1, analysis: data.result };
        })
      );
      const allResults = await Promise.all(analysisPromises);
      allResults.sort((a, b) => a.page - b.page);
      setResults(allResults);
    } catch (err: any) {
      setError('Error durant l’anàlisi: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold text-center mb-8">Anàlisi Visual de PDF</h1>

      <div className="flex flex-col gap-2 p-4 border rounded shadow-sm bg-white">
        <label htmlFor="pdf-upload" className="font-medium text-gray-700">Puja un document PDF</label>
        <input
          id="pdf-upload"
          type="file"
          accept="application/pdf"
          onChange={handleUploadPdf}
          className="border p-2 rounded text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          disabled={loading}
        />
      </div>

      {loading && <p className="text-center text-blue-600 font-medium">⏳ Processant... Si us plau, espera.</p>}
      {error && <p className="text-center text-red-600 font-semibold p-3 bg-red-50 border border-red-200 rounded">⚠️ {error}</p>}

      {images.length > 0 && !loading && !error && (
        <div className="mt-6 p-4 border rounded shadow-sm bg-white">
           <h2 className="text-xl font-semibold text-gray-800 mb-4">Pàgines Detectades:</h2>
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
             {images.map((src, idx) => (
               <div key={idx} className="border rounded overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                 <img src={src} alt={`Pàgina ${idx + 1}`} className="w-full h-auto object-contain bg-gray-100" />
                 <p className="text-center text-xs font-medium p-2 bg-gray-100 border-t">Pàgina {idx + 1}</p>
               </div>
             ))}
           </div>
           <div className="text-center">
             <button
               onClick={handleAnalyzeImages}
               className="px-6 py-3 bg-green-600 text-white rounded font-semibold hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
               disabled={loading || results.length > 0}
             >
               Analitzar totes les pàgines amb IA
             </button>
           </div>
        </div>
      )}

      {/* --- SECCIÓ DE RESULTATS VISUALITZATS --- */}
      {results.length > 0 && !loading && (
        <div className="mt-8 space-y-6">
          <h2 className="text-2xl font-semibold text-green-800 border-b pb-2 mb-4">Resultats de l'Anàlisi:</h2>
          {results.map((pageResult) => (
            <div key={pageResult.page} className="bg-white p-4 md:p-6 rounded border shadow-md mb-6">
              <h3 className="font-bold text-xl mb-4 text-gray-700 border-b pb-2">Pàgina {pageResult.page}</h3>
              <div className="prose prose-sm max-w-none"> {/* Utilitzem 'prose' de tailwind per estils base */}
                {/* Iterem sobre els elements del JSON i usem ElementRenderer */}
                {pageResult.analysis?.elements?.map((element: Element, index: number) => (
                   <ElementRenderer key={index} element={element} />
                 ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* --- FI SECCIÓ RESULTATS --- */}
    </main>
  );
}
