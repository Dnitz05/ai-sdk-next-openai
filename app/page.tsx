// app/page.tsx
'use client';

import React, { useState, ChangeEvent, useEffect, useRef, MouseEvent } from 'react';
import * as XLSX from 'xlsx';

export default function Home() {
  // --- Estats DOCX ---
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
  const [isLoadingDocx, setIsLoadingDocx] = useState<boolean>(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [mammothMessages, setMammothMessages] = useState<any[]>([]);

  // --- Estats EXCEL ---
  const [selectedExcelFileName, setSelectedExcelFileName] = useState<string | null>(null);
  const [excelData, setExcelData] = useState<any[] | null>(null);
  const [isParsingExcel, setIsParsingExcel] = useState<boolean>(false);
  const [excelError, setExcelError] = useState<string | null>(null);

  // --- Estat del Sidebar de Vinculació ---
  const [isLinkerSidebarOpen, setIsLinkerSidebarOpen] = useState(false); // Estat per al sidebar

  // --- Estats per Vinculació ---
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null);
  // Ja no necessitem isLinkingModeActive, farem servir isLinkerSidebarOpen
  const [links, setLinks] = useState<{ id: string; excelHeader: string; selectedText: string }[]>([]);

  // --- Refs ---
  const contentRef = useRef<HTMLDivElement>(null);

  // Estat per renderitzat client
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // JA NO necessitem useEffect per obrir modal automàticament

  // --- Funcions DOCX ---
  const triggerUpload = async (file: File) => {
    setIsLoadingDocx(true); setDocxError(null); setConvertedHtml(null); setMammothMessages([]);
    // Reset complet Excel i Sidebar/Vinculació
    setSelectedExcelFileName(null); setExcelData(null); setExcelError(null);
    setExcelHeaders([]); setSelectedExcelHeader(null); setIsLinkerSidebarOpen(false); setLinks([]);
    const formData = new FormData(); formData.append('file', file);
    try {
      const response = await fetch('/api/process-document', { method: 'POST', body: formData });
      // ... (resta fetch i gestió errors API sense canvis) ...
      const contentType = response.headers.get("content-type");
      if (!response.ok) {
        let errorPayload: any = { error: `Error del servidor: ${response.status} ${response.statusText}` };
        if (contentType && contentType.includes("application/json")) { try { errorPayload = await response.json(); } catch (e) { console.error("Error llegint error JSON", e); }} else { try { const rawErrorText = await response.text(); console.error("Resposta d'error no JSON:", rawErrorText); errorPayload.details = "Error inesperat."; } catch (e) { console.error("Error llegint error Text", e); }}
        throw new Error(errorPayload.error || JSON.stringify(errorPayload));
      }
      if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setConvertedHtml(data.html);
          setMammothMessages(data.messages || []);
      } else { const rawText = await response.text(); console.warn("Resposta OK però no és JSON:", rawText); throw new Error("Format de resposta inesperat."); }
    } catch (err) { console.error("Error processant DOCX:", err); setDocxError(err instanceof Error ? err.message : 'Error desconegut'); setConvertedHtml(null);
    } finally { setIsLoadingDocx(false); }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]; setSelectedFileName(file.name);
      const isValidType = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx');
      if (isValidType) {
        setDocxError(null); triggerUpload(file);
      } else {
        setDocxError('Si us plau, selecciona un fitxer .docx'); setConvertedHtml(null); setMammothMessages([]); setSelectedFileName('Cap fitxer seleccionat');
        // Reset complet Excel i Sidebar/Vinculació
        setSelectedExcelFileName(null); setExcelData(null); setExcelError(null);
        setExcelHeaders([]); setSelectedExcelHeader(null); setIsLinkerSidebarOpen(false); setLinks([]);
      }
    } else { setSelectedFileName(null); }
    event.target.value = '';
  };

  // --- Funcions EXCEL ---
  const handleExcelFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedExcelFileName(file.name);
      setExcelError(null);
      setExcelData(null);
      // Quan es carrega nou Excel, tanquem sidebar i resetejem vinculació
      setIsLinkerSidebarOpen(false);
      setSelectedExcelHeader(null);
      setExcelHeaders([]);
      // No resetejem 'links' aquí, potser són d'un excel anterior vàlid
      // Si volem que es netegin, afegir setLinks([]) aquí. Per ara no.

      const validMimeTypes = [ 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ];
      const isValidType = validMimeTypes.includes(file.type) || file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');

      if (isValidType) {
        setIsParsingExcel(true);
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const arrayBuffer = e.target?.result;
            if (arrayBuffer) {
              const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
              const firstSheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[firstSheetName];
              const jsonData = XLSX.utils.sheet_to_json(worksheet);

              if (jsonData.length > 0) {
                  const firstRow = jsonData[0];
                  if (firstRow && typeof firstRow === 'object') {
                      const headers = Object.keys(firstRow);
                      setExcelHeaders(headers); // <-- Guardem capçaleres
                  } else {
                      console.warn("Excel: Primera fila no és un objecte.");
                      setExcelHeaders([]);
                      setExcelError("Format de fila inesperat a l'Excel."); // Informem error
                  }
              } else {
                  setExcelHeaders([]);
              }
              setExcelData(jsonData); // Guardem dades
            } else { throw new Error("No s'ha pogut llegir el contingut del fitxer."); }
          } catch (err) {
            console.error("Error parsejant Excel:", err);
            setExcelError(err instanceof Error ? `Error parsejant: ${err.message}` : 'Error desconegut durant el parseig');
            setExcelData(null); setExcelHeaders([]);
          } finally { setIsParsingExcel(false); }
        };
        reader.onerror = (e) => {
          console.error("Error llegint fitxer Excel:", e);
          setExcelError("Error llegint el fitxer Excel.");
          setIsParsingExcel(false); setExcelData(null); setExcelHeaders([]);
        };
        reader.readAsArrayBuffer(file);
      } else {
        setExcelError('Si us plau, selecciona un fitxer .xlsx o .xls');
        setSelectedExcelFileName(null); setExcelData(null); setExcelHeaders([]);
      }
    } else {
      setSelectedExcelFileName(null); setExcelData(null); setExcelHeaders([]);
    }
    event.target.value = ''; // Permet seleccionar el mateix fitxer
  };

  // --- Funcions per Vinculació ---
  // handleActivateLinkingMode ja no cal, s'activa obrint el sidebar

  const handleSelectHeader = (header: string) => {
    setSelectedExcelHeader(header);
    console.log("Capçalera seleccionada per vincular:", header);
  };

  const handleTextSelection = () => {
    // Només actua si el sidebar està obert i s'ha seleccionat una capçalera
    if (!isLinkerSidebarOpen || !selectedExcelHeader) {
      return;
    }
    // ... (resta de la lògica de handleTextSelection és la mateixa) ...
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
      const selectedText = selection.toString();
      if (!selectedText.trim()) { return; }
      const range = selection.getRangeAt(0);
      const linkId = `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      if (!contentRef.current.contains(range.commonAncestorContainer)) {
          console.warn("Ignorant selecció: Fora de l'àrea de contingut permesa.");
          selection.removeAllRanges(); return;
      }
      console.log(`Intentant vincular "${selectedText}" amb "${selectedExcelHeader}" (ID: ${linkId})`);
      const span = document.createElement('span');
      span.className = 'linked-placeholder';
      span.dataset.excelHeader = selectedExcelHeader;
      span.dataset.linkId = linkId;
      try {
        range.surroundContents(span);
        const updatedHtml = contentRef.current.innerHTML;
        setConvertedHtml(updatedHtml); // <-- Actualitza estat React
        setLinks(prevLinks => [...prevLinks, { id: linkId, excelHeader: selectedExcelHeader!, selectedText }]);
        console.log("Vinculació creada amb èxit.");
      } catch (error) {
        console.error("Error embolcallant la selecció:", error);
        alert("Error: La selecció no es pot vincular. Intenta seleccionar text dins d'un mateix paràgraf.");
      } finally {
        selection.removeAllRanges();
        setSelectedExcelHeader(null); // Reseteja capçalera seleccionada
      }
    }
  };

  // Funció per tancar el sidebar i resetejar estat de selecció
  const handleCloseSidebar = () => {
      setIsLinkerSidebarOpen(false);
      setSelectedExcelHeader(null); // Reseteja capçalera en tancar
  };

  // --- JSX ---
  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">

      {/* Capçalera WEB */}
      <div className="web-header w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 px-1 gap-4"> {/* Amplada màxima augmentada per acomodar sidebar */}
        <h2 className="text-base sm:text-lg font-semibold text-gray-600 flex-shrink-0">
          Visor DOCX / Processador Excel
        </h2>
        <div className="flex w-full sm:w-auto">
          {/* Només botó DOCX */}
          <div>
            <label htmlFor="fileInput" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${isLoadingDocx ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition ease-in-out duration-150 ${isLoadingDocx || isParsingExcel ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              {isLoadingDocx ? 'Processant DOCX...' : (selectedFileName ? 'Canvia DOCX' : 'Selecciona DOCX')}
            </label>
            <input type="file" id="fileInput" onChange={handleFileChange} accept=".docx" className="hidden" disabled={isLoadingDocx || isParsingExcel} />
             {selectedFileName && !isLoadingDocx && <span className="ml-2 text-xs text-gray-500 italic hidden sm:inline">({selectedFileName})</span>}
          </div>
        </div>
      </div>

      {/* Capçalera/Peu Impressió */}
      {/* Ajustem amplada màxima */}
      <div id="print-header" className="hidden print:block w-full max-w-4xl mx-auto mb-4 text-center text-xs text-gray-500">Informe Generat - {new Date().toLocaleDateString()}</div>
      <div id="print-footer" className="hidden print:block w-full max-w-4xl mx-auto mt-8 text-center text-xs text-gray-500">Document Intern</div>

      {/* Errors DOCX */}
       {docxError && (<div className="web-errors w-full max-w-4xl mx-auto text-sm text-red-600 text-center mb-4 -mt-2 px-1"><p>{docxError}</p></div>)}


      {/* --- Contenidor Principal (Flexbox per Foli + Sidebar) --- */}
      <div className="flex w-full max-w-6xl gap-x-6 px-1"> {/* Amplada màxima augmentada, gap entre columnes */}

          {/* --- Columna Esquerra: Foli Blanc DOCX --- */}
          <div className="flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-4"> {/* flex-grow permet que ocupi l'espai restant */}
              {isLoadingDocx && (<div className="text-center my-6"><p className="text-blue-600 animate-pulse">Processant DOCX: {selectedFileName}...</p></div>)}

              {/* Contingut DOCX amb Ref i Listener */}
              <div className="mt-1" ref={contentRef} onMouseUp={handleTextSelection} >
                  {isMounted && convertedHtml ? (
                    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: convertedHtml }} />
                  ) : (
                     !isLoadingDocx && !docxError && <p className="text-gray-400 italic text-center py-10">Selecciona un fitxer .docx per visualitzar la plantilla.</p>
                  )}
              </div>

              {/* Missatges Mammoth */}
              {mammothMessages && mammothMessages.length > 0 && (
                  <div className="mt-6 border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-semibold text-orange-600 mb-2">Missatges de la Conversió DOCX:</h3>
                      <ul className="list-disc list-inside text-sm text-orange-700 bg-orange-50 p-4 rounded-md">
                          {mammothMessages.map((msg, index) => ( <li key={index}><strong>{msg.type}:</strong> {msg.message}</li> ))}
                      </ul>
                  </div>
              )}

              {/* === Input Simple per Carregar Excel === */}
              {/* Apareix només quan el DOCX està llest */}
              {isMounted && convertedHtml && !isLoadingDocx && !docxError && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                      <h3 className="text-md font-semibold text-gray-700 mb-3">Pas 2: Carregar Dades des d'Excel (Opcional)</h3>
                      <div className="flex flex-col sm:flex-row items-center gap-3 p-4 border rounded bg-gray-50">
                          <label htmlFor="excelInputSimple" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${isParsingExcel ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition ease-in-out duration-150 ${isParsingExcel ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                              {isParsingExcel ? 'Processant...' : (selectedExcelFileName ? 'Canvia Excel' : 'Selecciona Excel')}
                          </label>
                          <input type="file" id="excelInputSimple" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel} />
                          {selectedExcelFileName && !isParsingExcel && (<span className="text-sm text-gray-600 italic">({selectedExcelFileName})</span>)}
                          {isParsingExcel && (<div className="text-center"><p className="text-green-600 animate-pulse text-sm">Processant...</p></div>)}
                      </div>
                      {excelError && (<p className="text-sm text-red-600 mt-2">{excelError}</p>)}
                      {/* Podríem mostrar un resum bàsic de l'excel aquí si volem, però ho farem al sidebar */}
                  </div>
              )}

               {/* === Botó per Obrir Sidebar de Vinculació === */}
               {/* Apareix només quan DOCX i EXCEL estan llestos (tenim capçaleres) */}
               {isMounted && convertedHtml && excelHeaders.length > 0 && !isLoadingDocx && !isParsingExcel && !docxError && !excelError && (
                 <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                    <button
                      onClick={() => setIsLinkerSidebarOpen(true)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition ease-in-out duration-150"
                      disabled={isLinkerSidebarOpen} // Deshabilita si ja està obert
                    >
                        Pas 3: Vincular Dades Excel amb Text
                    </button>
                 </div>
               )}


              {/* Visualització Vincles (Debug) */}
              {links && links.length > 0 && (
                  <div className="mt-6 border-t border-gray-200 pt-4">
                      <h3 className="text-md font-semibold text-purple-600 mb-2">Vincles Creats:</h3>
                      <ul className="list-disc list-inside text-xs text-gray-700">
                          {links.map(link => ( <li key={link.id}> "{link.selectedText}" {'=>'} <strong>{link.excelHeader}</strong> (ID: {link.id}) </li> ))}
                      </ul>
                  </div>
              )}
          </div> {/* Fi Columna Esquerra (Foli) */}


          {/* --- Columna Dreta: Sidebar de Vinculació --- */}
          {isMounted && isLinkerSidebarOpen && (
              <aside className="w-72 flex-shrink-0 my-4 relative"> {/* Amplada fixa, no es redueix */}
                 <div className="sticky top-4 p-4 bg-white rounded shadow-lg border max-h-[calc(100vh-2rem)] overflow-y-auto"> {/* Sticky i max alçada */}
                      <div className="flex justify-between items-center mb-3 pb-2 border-b">
                          <h3 className="text-md font-semibold text-blue-700">Vincular Capçaleres</h3>
                          <button onClick={handleCloseSidebar} className="text-gray-400 hover:text-gray-600 text-xl font-bold" aria-label="Tancar panell">&times;</button>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">1. Clica una capçalera d'Excel:</p>
                      <div className="flex flex-col gap-1 mb-4 max-h-48 overflow-y-auto pr-1"> {/* Scroll per capçaleres si n'hi ha moltes */}
                          {excelHeaders.map(header => (
                              <button
                                  key={header}
                                  onClick={() => handleSelectHeader(header)}
                                  className={`w-full text-left px-2 py-1 border rounded text-xs font-medium transition-colors break-words ${selectedExcelHeader === header ? 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-300' : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-100'}`}
                              >
                                  {header}
                              </button>
                          ))}
                      </div>
                      {selectedExcelHeader && (
                           <p className="text-xs text-gray-600 mb-1 bg-blue-50 p-2 rounded border border-blue-200">
                              <strong className="text-blue-700 block mb-1">PAS 2:</strong> Ara, selecciona el text al document (a l'esquerra) que vols vincular amb:<br/>
                              <span className="font-semibold italic">{selectedExcelHeader}</span>
                           </p>
                      )}
                      {!selectedExcelHeader && excelHeaders.length > 0 && (
                           <p className="text-xs text-gray-500 mb-1 p-2">
                              <strong className="block mb-1">PAS 2:</strong> Esperant selecció de text...
                           </p>
                      )}
                      {excelHeaders.length === 0 && (
                           <p className="text-xs text-red-500 mb-1 p-2">No s'han trobat capçaleres a l'Excel.</p>
                      )}
                 </div>
              </aside>
          )} {/* Fi Sidebar */}

      </div> {/* Fi Contenidor Principal Flex */}

      {/* === ELIMINAT EL MODAL === */}

    </main>
  );
}