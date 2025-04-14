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

  // --- Estat del Modal ---
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  // --- Estats per Vinculació ---
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]); // Guarda les capçaleres de l'Excel
  const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null); // Capçalera seleccionada per vincular
  const [isLinkingModeActive, setIsLinkingModeActive] = useState<boolean>(false); // Estem en mode vinculació?
  const [links, setLinks] = useState<{ id: string; excelHeader: string; selectedText: string }[]>([]); // Vincles creats

  // --- Refs ---
  const contentRef = useRef<HTMLDivElement>(null); // Ref per al div que mostra l'HTML del DOCX

  // Estat per renderitzat client
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // useEffect per obrir el modal automàticament (sense canvis)
  useEffect(() => {
    if (isMounted && convertedHtml && !isLoadingDocx && !docxError) {
      console.log("DOCX processat correctament, obrint modal Excel...");
      setIsExcelModalOpen(true);
      // Resetejem l'estat de vinculació si s'obre automàticament
      setIsLinkingModeActive(false);
      setSelectedExcelHeader(null);
      setExcelHeaders([]);
      // No resetejem 'links' aquí, potser l'usuari vol continuar vinculant
    }
  }, [convertedHtml, isLoadingDocx, docxError, isMounted]);

  // --- Funcions DOCX ---
  const triggerUpload = async (file: File) => {
    setIsLoadingDocx(true); setDocxError(null); setConvertedHtml(null); setMammothMessages([]);
    setSelectedExcelFileName(null); setExcelData(null); setExcelError(null); setIsExcelModalOpen(false);
    // Resetejar estats de vinculació quan es puja nou DOCX
    setExcelHeaders([]); setSelectedExcelHeader(null); setIsLinkingModeActive(false); setLinks([]);
    const formData = new FormData(); formData.append('file', file);
    try {
      // ... (resta de la lògica de fetch sense canvis) ...
      const response = await fetch('/api/process-document', { method: 'POST', body: formData });
      const contentType = response.headers.get("content-type");
      if (!response.ok) {
        let errorPayload: any = { error: `Error del servidor: ${response.status} ${response.statusText}` };
        if (contentType && contentType.includes("application/json")) { try { errorPayload = await response.json(); } catch (e) { console.error("Error llegint error JSON", e); }} else { try { const rawErrorText = await response.text(); console.error("Resposta d'error no JSON:", rawErrorText); errorPayload.details = "Error inesperat."; } catch (e) { console.error("Error llegint error Text", e); }}
        throw new Error(errorPayload.error || JSON.stringify(errorPayload));
      }
      if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          console.log("API ha retornat HTML, actualitzant estat...");
          setConvertedHtml(data.html);
          setMammothMessages(data.messages || []);
          // Important: NO obrim el modal aquí, l'useEffect s'encarregarà
      } else { const rawText = await response.text(); console.warn("Resposta OK però no és JSON:", rawText); throw new Error("Format de resposta inesperat."); }
    } catch (err) { console.error("Error processant DOCX:", err); setDocxError(err instanceof Error ? err.message : 'Error desconegut'); setConvertedHtml(null);
    } finally { setIsLoadingDocx(false); console.log("Finalitzada càrrega DOCX.");}
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    // ... (lògica sense canvis, assegura't que reseteja estats si el fitxer és invàlid) ...
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]; setSelectedFileName(file.name);
      const isValidType = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx');
      if (isValidType) {
        setDocxError(null); triggerUpload(file);
      } else {
        setDocxError('Si us plau, selecciona un fitxer .docx'); setConvertedHtml(null); setMammothMessages([]); setSelectedFileName('Cap fitxer seleccionat');
        setIsExcelModalOpen(false); setSelectedExcelFileName(null); setExcelData(null); setExcelError(null);
        setExcelHeaders([]); setSelectedExcelHeader(null); setIsLinkingModeActive(false); setLinks([]); // Reset vincle
      }
    } else { setSelectedFileName(null); }
    event.target.value = '';
  };

  // --- Funcions EXCEL ---
  const handleExcelFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    // ... (lògica interna sense canvis) ...
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedExcelFileName(file.name);
      setExcelError(null);
      setExcelData(null);
      // Reseteja estat de vinculació quan es canvia l'excel
      setIsLinkingModeActive(false);
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
              setExcelData(jsonData);
              // Extreu capçaleres si hi ha dades
              if (jsonData.length > 0) {
                  const headers = Object.keys(jsonData[0]);
                  setExcelHeaders(headers); // Guardem les capçaleres per a la vinculació
              } else {
                  setExcelHeaders([]);
              }
              console.log("Dades Excel Parsejades:", jsonData);
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
    // event.target.value = ''; // Considerar si cal o no
  };

  // --- Funcions per Vinculació ---
  const handleActivateLinkingMode = () => {
    if (excelData && excelData.length > 0) {
      const headers = Object.keys(excelData[0]);
      setExcelHeaders(headers);
      setIsLinkingModeActive(true);
      setSelectedExcelHeader(null); // Reseteja capçalera seleccionada
      console.log("Mode vinculació activat. Capçaleres:", headers);
    } else {
        console.warn("No es pot activar el mode vinculació sense dades d'Excel.");
        // Podríem mostrar un error a l'usuari
    }
  };

  const handleSelectHeader = (header: string) => {
    setSelectedExcelHeader(header);
    console.log("Capçalera seleccionada per vincular:", header);
  };

  const handleTextSelection = () => {
    // Només actua si estem en mode vinculació i s'ha seleccionat una capçalera
    if (!isLinkingModeActive || !selectedExcelHeader) {
      // console.log("Ignorant selecció: Mode vinculació inactiu o capçalera no seleccionada.");
      return;
    }

    const selection = window.getSelection();

    if (selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
      const selectedText = selection.toString();
      if (!selectedText.trim()) {
          console.log("Ignorant selecció: Text buit.");
          return; // Ignora si només s'ha seleccionat espai en blanc
      }

      const range = selection.getRangeAt(0);
      const linkId = `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // Comprova si la selecció està dins del contenidor de contingut
      if (!contentRef.current.contains(range.commonAncestorContainer)) {
          console.warn("Ignorant selecció: Fora de l'àrea de contingut permesa.");
          selection.removeAllRanges(); // Neteja la selecció del navegador
          return;
      }

      console.log(`Intentant vincular "${selectedText}" amb "${selectedExcelHeader}" (ID: ${linkId})`);

      // Crea l'element span per embolcallar
      const span = document.createElement('span');
      span.className = 'linked-placeholder'; // Classe per a CSS
      span.dataset.excelHeader = selectedExcelHeader; // Guarda la capçalera
      span.dataset.linkId = linkId; // Guarda l'ID únic

      try {
        // Intenta embolcallar el contingut seleccionat
        // Això pot fallar si la selecció travessa certs límits d'elements
        range.surroundContents(span);

        // CRÍTIC: Llegeix l'HTML modificat i actualitza l'estat de React
        const updatedHtml = contentRef.current.innerHTML;
        setConvertedHtml(updatedHtml); // Fa persistent el canvi

        // Guarda la informació del vincle a l'estat 'links'
        setLinks(prevLinks => [...prevLinks, { id: linkId, excelHeader: selectedExcelHeader, selectedText }]);

        console.log("Vinculació creada amb èxit.");
        // Opcional: Mostra un missatge temporal d'èxit a l'usuari

      } catch (error) {
        console.error("Error embolcallant la selecció amb range.surroundContents():", error);
        // Informa l'usuari que la selecció no és vàlida (potser creua blocs)
        alert("Error: La selecció no es pot vincular. Intenta seleccionar text dins d'un mateix paràgraf o bloc.");
      } finally {
        // Sempre neteja l'estat de selecció i la selecció del navegador
        selection.removeAllRanges();
        setSelectedExcelHeader(null); // Requereix tornar a seleccionar capçalera
      }
    }
  };

  // Funció per tancar el modal i resetejar estats de vinculació
  const handleCloseModal = () => {
      setIsExcelModalOpen(false);
      setIsLinkingModeActive(false);
      setSelectedExcelHeader(null);
      // No resetejem excelHeaders ni excelData, podrien voler tornar a obrir
  };


  // --- JSX ---
  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">

      {/* --- Capçalera WEB (sense canvis) --- */}
      <div className="web-header w-full max-w-2xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 px-1 gap-4">
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

      {/* --- Capçalera/Peu per a Impressió (sense canvis) --- */}
      <div id="print-header" className="hidden print:block w-full max-w-2xl mx-auto mb-4 text-center text-xs text-gray-500">Informe Generat - {new Date().toLocaleDateString()}</div>
      <div id="print-footer" className="hidden print:block w-full max-w-2xl mx-auto mt-8 text-center text-xs text-gray-500">Document Intern</div>

      {/* --- Àrea d'Errors Globals DOCX (sense canvis) --- */}
       {docxError && (<div className="web-errors w-full max-w-2xl mx-auto text-sm text-red-600 text-center mb-4 -mt-2 px-1"><p>{docxError}</p></div>)}

      {/* --- "Foli" Blanc Principal --- */}
      <div className="print-content w-full max-w-2xl bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-4 relative">
        {isLoadingDocx && (<div className="text-center my-6"><p className="text-blue-600 animate-pulse">Processant DOCX: {selectedFileName}...</p></div>)}

        {/* === Contingut DOCX amb Ref i Event Listener === */}
        <div
            className="mt-1"
            ref={contentRef} // Assignem la ref aquí
            onMouseUp={handleTextSelection} // Assignem el gestor d'esdeveniments aquí
        >
          {isMounted && convertedHtml ? (
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: convertedHtml }}
            />
          ) : (
             !isLoadingDocx && !docxError && <p className="text-gray-400 italic text-center py-10">Selecciona un fitxer .docx per visualitzar la plantilla.</p>
          )}
        </div>

        {/* Àrea de Missatges de Mammoth (sense canvis) */}
        {mammothMessages && mammothMessages.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-orange-600 mb-2">Missatges de la Conversió DOCX:</h3>
              <ul className="list-disc list-inside text-sm text-orange-700 bg-orange-50 p-4 rounded-md">
                {mammothMessages.map((msg, index) => ( <li key={index}><strong>{msg.type}:</strong> {msg.message}</li> ))}
              </ul>
            </div>
          )}

        {/* Àrea per mostrar els vincles creats (opcional, per depuració) */}
        {links && links.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-4">
                 <h3 className="text-md font-semibold text-purple-600 mb-2">Vincles Creats:</h3>
                 <ul className="list-disc list-inside text-xs text-gray-700">
                     {links.map(link => (
                         <li key={link.id}>
                           "{link.selectedText}" {'=>'} <strong>{link.excelHeader}</strong> (ID: {link.id})
                         </li>
                     ))}
                 </ul>
            </div>
        )}

      </div> {/* Fi del "Foli" Blanc */}


      {/* --- MODAL PER EXCEL --- */}
      {isMounted && isExcelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

            {/* Capçalera del Modal */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-700">
                {isLinkingModeActive ? 'Vinculant Dades Excel' : 'Carregar i Visualitzar Dades Excel'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-2xl font-bold" aria-label="Tancar modal">&times;</button>
            </div>

            {/* Cos del Modal */}
            <div className="p-6 overflow-y-auto flex-grow space-y-4">

              {/* Secció de Càrrega Excel (Sempre visible dins el modal) */}
              <div className="flex flex-col sm:flex-row items-center gap-3 border-b pb-4">
                <label htmlFor="excelInputModal" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${isParsingExcel ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition ease-in-out duration-150 ${isParsingExcel ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  {isParsingExcel ? 'Processant...' : (selectedExcelFileName ? 'Canvia Fitxer' : 'Selecciona Excel')}
                </label>
                <input type="file" id="excelInputModal" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel} />
                {selectedExcelFileName && !isParsingExcel && (<span className="text-sm text-gray-600 italic">({selectedExcelFileName})</span>)}
              </div>
              {isParsingExcel && (<div className="text-center"><p className="text-green-600 animate-pulse">Processant Excel...</p></div>)}
              {excelError && (<p className="text-sm text-red-600 text-center">{excelError}</p>)}

              {/* === Nova Secció: Mode Vinculació === */}
              {isLinkingModeActive && (
                <div className="p-4 border border-blue-200 rounded bg-blue-50">
                   <h4 className="text-md font-semibold text-blue-700 mb-3">Mode Vinculació Actiu</h4>
                   <p className="text-sm text-blue-600 mb-1">1. Selecciona una capçalera d'Excel de la llista:</p>
                   <div className="flex flex-wrap gap-2 mb-4">
                       {excelHeaders.map(header => (
                           <button
                               key={header}
                               onClick={() => handleSelectHeader(header)}
                               className={`px-2 py-1 border rounded text-xs font-medium transition-colors ${selectedExcelHeader === header ? 'bg-blue-500 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-100'}`}
                           >
                               {header}
                           </button>
                       ))}
                   </div>
                   {selectedExcelHeader && (
                        <p className="text-sm text-blue-600 mb-1">
                            2. Ara, selecciona el text corresponent al document principal (fora d'aquesta finestra) que vols vincular amb: <strong>{selectedExcelHeader}</strong>.
                        </p>
                   )}
                    {!selectedExcelHeader && (
                        <p className="text-sm text-blue-600 mb-1">
                            2. Esperant selecció de text al document...
                        </p>
                   )}
                   <button
                       onClick={() => { setIsLinkingModeActive(false); setSelectedExcelHeader(null); }}
                       className="mt-3 text-xs text-gray-500 hover:text-gray-700 underline"
                   >
                       Cancel·lar Mode Vinculació
                   </button>
                </div>
              )}

              {/* === Secció: Vista Prèvia Excel / Botó Vincular === */}
              {!isLinkingModeActive && excelData && excelData.length > 0 && !isParsingExcel && (
                 <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                         <h4 className="text-md font-semibold text-green-700">Dades Extretes de l'Excel:</h4>
                         {/* Botó per activar la vinculació */}
                         <button
                           onClick={handleActivateLinkingMode}
                           className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition ease-in-out duration-150"
                         >
                            Vincular Capçaleres amb Text
                         </button>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">S'han llegit {excelData.length} files (mostrant les primeres 10 com a exemple).</p>
                    <div className="overflow-x-auto bg-gray-50 p-3 rounded shadow border max-h-[30vh] overflow-y-auto"> {/* Reduït max-h */}
                        <table className="min-w-full text-xs border border-gray-300">
                            <thead className="bg-gray-200 sticky top-0"><tr>{Object.keys(excelData[0]).map((header) => (<th key={header} className="px-2 py-1 border border-gray-300 text-left font-medium text-gray-600 whitespace-nowrap">{header}</th>))}</tr></thead>
                            <tbody>{excelData.slice(0, 10).map((row, rowIndex) => (<tr key={rowIndex} className="bg-white even:bg-gray-50">{Object.values(row).map((cell, cellIndex) => (<td key={cellIndex} className="px-2 py-1 border border-gray-300 text-gray-700">{String(cell)}</td>))}</tr>))}</tbody>
                        </table>
                    </div>
                </div>
              )}
              {!isLinkingModeActive && excelData && excelData.length === 0 && !isParsingExcel && (
                 <div className="mt-4"><p className="text-orange-600 text-center">L'Excel s'ha processat, però no s'han trobat dades a la primera fulla.</p></div>
              )}
              {!isLinkingModeActive && !selectedExcelFileName && !isParsingExcel && !excelError && (
                 <p className="text-gray-400 italic text-center py-5">Selecciona un fitxer Excel.</p>
              )}

            </div>

            {/* Peu del Modal */}
            <div className="flex justify-end items-center p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button onClick={handleCloseModal} className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition ease-in-out duration-150">
                Tancar
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}