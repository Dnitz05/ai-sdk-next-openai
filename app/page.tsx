// app/page.tsx
'use client';

import React, { useState, ChangeEvent, useEffect, useRef, MouseEvent, useMemo } from 'react'; // Importat useMemo
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
  const [isLinkerSidebarOpen, setIsLinkerSidebarOpen] = useState(false);

  // --- Estats per Vinculació ---
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null);
  const [links, setLinks] = useState<{ id: string; excelHeader: string; selectedText: string }[]>([]);

  // --- Refs ---
  const contentRef = useRef<HTMLDivElement>(null);

  // Estat per renderitzat client
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // useEffect per obrir el sidebar automàticament
  useEffect(() => {
    if (isMounted && convertedHtml && !isLoadingDocx && !docxError) {
      setIsLinkerSidebarOpen(true);
    }
  }, [convertedHtml, isLoadingDocx, docxError, isMounted]);

  // --- Càlcul dels recomptes de vincles ---
  const linkCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    for (const link of links) {
      counts[link.excelHeader] = (counts[link.excelHeader] || 0) + 1;
    }
    return counts;
  }, [links]); // Es recalcula només quan l'array 'links' canvia

  // --- Funcions DOCX (sense canvis) ---
  const triggerUpload = async (file: File) => {
    setIsLoadingDocx(true); setDocxError(null); setConvertedHtml(null); setMammothMessages([]);
    setSelectedExcelFileName(null); setExcelData(null); setExcelError(null);
    setExcelHeaders([]); setSelectedExcelHeader(null); setIsLinkerSidebarOpen(false); setLinks([]);
    const formData = new FormData(); formData.append('file', file);
    try {
        // ... (fetch) ...
      const response = await fetch('/api/process-document', { method: 'POST', body: formData });
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
    // ... (sense canvis) ...
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]; setSelectedFileName(file.name);
      const isValidType = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx');
      if (isValidType) {
        setDocxError(null); triggerUpload(file);
      } else {
        setDocxError('Si us plau, selecciona un fitxer .docx'); setConvertedHtml(null); setMammothMessages([]); setSelectedFileName('Cap fitxer seleccionat');
        setSelectedExcelFileName(null); setExcelData(null); setExcelError(null);
        setExcelHeaders([]); setSelectedExcelHeader(null); setIsLinkerSidebarOpen(false); setLinks([]);
      }
    } else { setSelectedFileName(null); }
    event.target.value = '';
  };

  // --- Funcions EXCEL (sense canvis) ---
  const handleExcelFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    // ... (sense canvis) ...
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedExcelFileName(file.name);
      setExcelError(null);
      setExcelData(null);
      setIsLinkerSidebarOpen(false);
      setSelectedExcelHeader(null);
      setExcelHeaders([]);

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
                      setExcelHeaders(headers);
                  } else {
                      console.warn("Excel: Primera fila no és un objecte.");
                      setExcelHeaders([]);
                      setExcelError("Format de fila inesperat a l'Excel.");
                  }
              } else {
                   setExcelHeaders([]);
                   setExcelError("L'Excel sembla buit o no té dades a la primera fulla.");
              }
              setExcelData(jsonData);
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
      // No fer res si es cancel·la
    }
     if (event.target) { event.target.value = ''; }
  };

  // --- Funcions per Vinculació (sense canvis interns) ---
  const handleSelectHeader = (header: string) => {
    setSelectedExcelHeader(header);
    console.log("Capçalera seleccionada per vincular:", header);
  };

  const handleTextSelection = () => {
    // ... (lògica interna sense canvis) ...
    if (!isLinkerSidebarOpen || !selectedExcelHeader) { return; }
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
      const originalSelectedText = selection.toString();
      if (!originalSelectedText.trim()) { return; }
      const range = selection.getRangeAt(0);
      const linkId = `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      if (!contentRef.current.contains(range.commonAncestorContainer)) {
          console.warn("Ignorant selecció: Fora de l'àrea de contingut permesa.");
          selection.removeAllRanges(); return;
      }
      const span = document.createElement('span');
      span.className = 'linked-placeholder';
      span.dataset.excelHeader = selectedExcelHeader;
      span.dataset.linkId = linkId;
      span.textContent = selectedExcelHeader;
      try {
        range.deleteContents();
        range.insertNode(span);
        const updatedHtml = contentRef.current.innerHTML;
        setConvertedHtml(updatedHtml);
        setLinks(prevLinks => [...prevLinks, { id: linkId, excelHeader: selectedExcelHeader!, selectedText: selectedExcelHeader! }]);
        console.log("Placeholder inserit amb èxit.");
      } catch (error) {
        console.error("Error modificant el DOM:", error);
        alert("Error: La selecció no es pot vincular. Intenta seleccionar text dins d'un mateix paràgraf.");
      } finally {
        selection.removeAllRanges();
        setSelectedExcelHeader(null);
      }
    }
  };

  const handleCloseSidebar = () => {
      setIsLinkerSidebarOpen(false);
      setSelectedExcelHeader(null);
  };

  // --- Funció per al botó Finalitzar ---
  const handleFinalizeLinking = () => {
      console.log("Procés de vinculació finalitzat.");
      console.log("Vincles creats:", links);
      console.log("HTML final:", contentRef.current?.innerHTML); // Accés a l'HTML final amb placeholders
      // Aquí aniria la lògica per al "següent pas":
      // - Preparar les dades (links, excelData?) per enviar al backend.
      // - Possiblement tancar el sidebar: setIsLinkerSidebarOpen(false);
      // - Mostrar un nou estat/UI a la pàgina principal.
      alert("Procés de vinculació finalitzat! (Consulta la consola per veure els resultats)\nProper pas pendent d'implementar.");
      // De moment, només tanquem el sidebar
      handleCloseSidebar();
  };


  // --- JSX ---
  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">

      {/* Capçalera WEB */}
      <div className="web-header w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 px-1 gap-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-600 flex-shrink-0">
          Visor DOCX / Processador Excel
        </h2>
        <div className="flex w-full sm:w-auto">
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
      <div id="print-header" className="hidden print:block w-full max-w-4xl mx-auto mb-4 text-center text-xs text-gray-500">Informe Generat - {new Date().toLocaleDateString()}</div>
      <div id="print-footer" className="hidden print:block w-full max-w-4xl mx-auto mt-8 text-center text-xs text-gray-500">Document Intern</div>

      {/* Errors DOCX */}
       {docxError && (<div className="web-errors w-full max-w-4xl mx-auto text-sm text-red-600 text-center mb-4 -mt-2 px-1"><p>{docxError}</p></div>)}

      {/* Contenidor Principal (Flexbox per Foli + Sidebar) */}
      <div className="flex w-full max-w-6xl gap-x-6 px-1">

          {/* Columna Esquerra: Foli Blanc DOCX */}
          <div className="flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-4">
              {isLoadingDocx && (<div className="text-center my-6"><p className="text-blue-600 animate-pulse">Processant DOCX: {selectedFileName}...</p></div>)}

              {/* Contingut DOCX */}
              <div className="mt-1" ref={contentRef} onMouseUp={handleTextSelection} >
                  {isMounted && convertedHtml ? (
                    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: convertedHtml }} />
                  ) : (
                     !isLoadingDocx && !docxError && <p className="text-gray-400 italic text-center py-10">Selecciona un fitxer .docx per visualitzar la plantilla.</p>
                  )}
              </div>

              {/* Missatges Mammoth */}
              {mammothMessages && mammothMessages.length > 0 && ( /* ... */ )}

              {/* Visualització Vincles (Debug) */}
              {links && links.length > 0 && ( /* ... */ )}

          </div> {/* Fi Columna Esquerra (Foli) */}


          {/* --- Columna Dreta: Sidebar de Vinculació --- */}
          {isMounted && isLinkerSidebarOpen && (
              <aside className="w-80 flex-shrink-0 my-4 relative">
                 <div className="sticky top-4 p-4 bg-white rounded shadow-lg border max-h-[calc(100vh-2rem)] overflow-y-auto flex flex-col"> {/* flex col */}
                      {/* Capçalera Sidebar */}
                      <div className="flex justify-between items-center mb-3 pb-2 border-b flex-shrink-0">
                          <h3 className="text-md font-semibold text-blue-700">Vincular Dades Excel</h3>
                          <button onClick={handleCloseSidebar} className="text-gray-400 hover:text-gray-600 text-xl font-bold" aria-label="Tancar panell">&times;</button>
                      </div>

                      {/* Contingut principal del Sidebar (amb scroll) */}
                      <div className="flex-grow overflow-y-auto space-y-4 pr-1 mb-4"> {/* Added mb-4 for spacing before button */}

                          {/* === Pas 1: Carregar Excel (si no hi ha capçaleres) === */}
                          {excelHeaders.length === 0 && (
                              <div className="p-3 border border-dashed border-gray-300 rounded">
                                  <p className="text-sm font-medium text-gray-700 mb-2">Pas 1: Carregar Excel</p>
                                  {/* ... (Input Excel sense canvis) ... */}
                                  <div className="flex flex-col items-start gap-2">
                                      <label htmlFor="excelInputSidebar" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${isParsingExcel ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition ease-in-out duration-150 ${isParsingExcel ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                          {isParsingExcel ? 'Processant...' : (selectedExcelFileName ? 'Canvia Fitxer' : 'Selecciona Excel')}
                                      </label>
                                      <input type="file" id="excelInputSidebar" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel} />
                                      {selectedExcelFileName && !isParsingExcel && (<span className="text-xs text-gray-500 italic">({selectedExcelFileName})</span>)}
                                  </div>
                                  {isParsingExcel && (<div className="text-center mt-2"><p className="text-green-600 animate-pulse text-xs">Processant...</p></div>)}
                                  {excelError && (<p className="text-xs text-red-600 mt-2">{excelError}</p>)}
                                  {!selectedExcelFileName && !isParsingExcel && !excelError && (<p className="text-xs text-gray-400 mt-2 italic">Puja un fitxer per veure les capçaleres.</p>)}
                              </div>
                          )}

                          {/* === Pas 2: Vincular (si hi ha capçaleres) === */}
                          {excelHeaders.length > 0 && (
                              <div>
                                  <p className="text-sm font-medium text-gray-700 mb-1">Pas 2: Vincular</p>
                                  <p className="text-xs text-gray-600 mb-2">1. Clica una capçalera d'Excel:</p>
                                  {/* Llista de Capçaleres amb Comptadors */}
                                  <div className="flex flex-col gap-1 mb-4 max-h-48 overflow-y-auto pr-1 border rounded p-2 bg-gray-50">
                                      {excelHeaders.map(header => {
                                          const count = linkCounts[header] || 0; // Obtenir recompte
                                          const isLinked = count > 0;
                                          return (
                                              <button
                                                  key={header}
                                                  onClick={() => handleSelectHeader(header)}
                                                  className={`w-full text-left px-2 py-1 border rounded text-xs font-medium transition-colors break-words flex justify-between items-center ${
                                                      selectedExcelHeader === header
                                                          ? 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-300' // Estil seleccionat
                                                          : isLinked
                                                          ? 'bg-green-50 text-green-800 border-green-300 hover:bg-green-100' // Estil vinculat
                                                          : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-100' // Estil normal
                                                  }`}
                                              >
                                                  <span>{header}</span>
                                                  {/* Mostra recompte si > 0 */}
                                                  {count > 0 && (
                                                      <span className={`ml-2 text-xs font-normal px-1.5 py-0.5 rounded ${selectedExcelHeader === header ? 'bg-white text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                                                          ({count})
                                                      </span>
                                                  )}
                                              </button>
                                          );
                                      })}
                                  </div>
                                  {/* Instruccions Pas 2 */}
                                  {selectedExcelHeader && ( <p className="text-xs text-gray-600 mb-1 bg-blue-50 p-2 rounded border border-blue-200">...</p> )}
                                  {!selectedExcelHeader && ( <p className="text-xs text-gray-500 mb-1 p-2">...</p> )}

                                  {/* Canviar fitxer Excel */}
                                  <div className="mt-4 text-center border-t pt-3">
                                       <label htmlFor="excelInputSidebarChange" className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer">
                                            Canviar fitxer Excel ({selectedExcelFileName || 'cap seleccionat'})
                                       </label>
                                       <input type="file" id="excelInputSidebarChange" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel}/>
                                  </div>
                              </div>
                          )}
                      </div> {/* Fi Contingut Principal Sidebar */}

                      {/* === Botó Finalitzar (Sempre visible si sidebar obert) === */}
                      <div className="mt-auto pt-4 border-t flex-shrink-0"> {/* mt-auto empeny cap avall, pt-4 espai, border-t separador, flex-shrink-0 evita que s'encongeixi */}
                          <button
                              onClick={handleFinalizeLinking}
                              disabled={links.length === 0} // Deshabilita si no s'ha fet cap vincle? Opcional.
                              className={`w-full px-4 py-2 text-sm font-medium rounded shadow-sm transition ease-in-out duration-150 ${
                                  links.length === 0
                                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                      : 'bg-purple-600 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
                                  }`}
                          >
                              Finalitzar i Següent Pas
                          </button>
                      </div>

                 </div>
              </aside>
          )} {/* Fi Sidebar */}

      </div> {/* Fi Contenidor Principal Flex */}
    </main>
  );
}