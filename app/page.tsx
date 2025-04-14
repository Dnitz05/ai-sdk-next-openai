// app/page.tsx
'use client';

import React, { useState, ChangeEvent, useEffect } from 'react';
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

  // Estat per renderitzat client
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- NOU useEffect per obrir el modal automàticament ---
  useEffect(() => {
    // Condicions per obrir el modal:
    // 1. El component està muntat al client (isMounted).
    // 2. Tenim HTML convertit del DOCX (convertedHtml no és null).
    // 3. No estem carregant el DOCX (isLoadingDocx és false).
    // 4. No hi ha hagut error processant el DOCX (docxError és null).
    if (isMounted && convertedHtml && !isLoadingDocx && !docxError) {
      console.log("DOCX processat correctament, obrint modal Excel...");
      setIsExcelModalOpen(true);
    }
    // Nota: No afegim lògica per tancar-lo aquí, es tancarà manualment
    // o quan es pugi un nou DOCX (perquè triggerUpload reseteja estats).

  }, [convertedHtml, isLoadingDocx, docxError, isMounted]); // Dependències de l'efect

  // --- Funcions DOCX ---
  const triggerUpload = async (file: File) => {
    setIsLoadingDocx(true); setDocxError(null); setConvertedHtml(null); setMammothMessages([]);
    setSelectedExcelFileName(null); setExcelData(null); setExcelError(null); setIsExcelModalOpen(false); // Reset Excel/Modal
    const formData = new FormData(); formData.append('file', file);
    try {
      const response = await fetch('/api/process-document', { method: 'POST', body: formData });
      const contentType = response.headers.get("content-type");
      if (!response.ok) {
        // ... (gestió d'errors API sense canvis) ...
        let errorPayload: any = { error: `Error del servidor: ${response.status} ${response.statusText}` };
        if (contentType && contentType.includes("application/json")) { try { errorPayload = await response.json(); } catch (e) { console.error("Error llegint error JSON", e); }} else { try { const rawErrorText = await response.text(); console.error("Resposta d'error no JSON:", rawErrorText); errorPayload.details = "Error inesperat."; } catch (e) { console.error("Error llegint error Text", e); }}
        throw new Error(errorPayload.error || JSON.stringify(errorPayload));
      }
      if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          console.log("API ha retornat HTML, actualitzant estat...");
          setConvertedHtml(data.html); // <-- Això dispararà l'useEffect per obrir el modal
          setMammothMessages(data.messages || []);
      } else { const rawText = await response.text(); console.warn("Resposta OK però no és JSON:", rawText); throw new Error("Format de resposta inesperat."); }
    } catch (err) { console.error("Error processant DOCX:", err); setDocxError(err instanceof Error ? err.message : 'Error desconegut'); setConvertedHtml(null);
    } finally { setIsLoadingDocx(false); console.log("Finalitzada càrrega DOCX.");}
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0]; setSelectedFileName(file.name);
      const isValidType = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx');
      if (isValidType) {
        setDocxError(null); triggerUpload(file);
      } else {
        setDocxError('Si us plau, selecciona un fitxer .docx'); setConvertedHtml(null); setMammothMessages([]); setSelectedFileName('Cap fitxer seleccionat');
        setIsExcelModalOpen(false); setSelectedExcelFileName(null); setExcelData(null); setExcelError(null);
      }
    } else { setSelectedFileName(null); }
    event.target.value = '';
  };

  // --- Funcions EXCEL (sense canvis) ---
  const handleExcelFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    // ... (la lògica interna és la mateixa) ...
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedExcelFileName(file.name);
      setExcelError(null);
      setExcelData(null);

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
              console.log("Dades Excel Parsejades:", jsonData);
            } else { throw new Error("No s'ha pogut llegir el contingut del fitxer."); }
          } catch (err) {
            console.error("Error parsejant Excel:", err);
            setExcelError(err instanceof Error ? `Error parsejant: ${err.message}` : 'Error desconegut durant el parseig');
            setExcelData(null);
          } finally { setIsParsingExcel(false); }
        };
        reader.onerror = (e) => {
          console.error("Error llegint fitxer Excel:", e);
          setExcelError("Error llegint el fitxer Excel.");
          setIsParsingExcel(false); setExcelData(null);
        };
        reader.readAsArrayBuffer(file);
      } else {
        setExcelError('Si us plau, selecciona un fitxer .xlsx o .xls');
        setSelectedExcelFileName(null); setExcelData(null);
      }
    } else {
      setSelectedExcelFileName(null); setExcelData(null);
    }
    // event.target.value = ''; // Potser el necessitem per poder pujar el mateix excel un altre cop
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
            <input
              type="file"
              id="fileInput"
              onChange={handleFileChange}
              accept=".docx"
              className="hidden"
              disabled={isLoadingDocx || isParsingExcel}
            />
             {selectedFileName && !isLoadingDocx && <span className="ml-2 text-xs text-gray-500 italic hidden sm:inline">({selectedFileName})</span>}
          </div>
        </div>
      </div>

      {/* --- Capçalera/Peu per a Impressió (sense canvis) --- */}
      <div id="print-header" className="hidden print:block w-full max-w-2xl mx-auto mb-4 text-center text-xs text-gray-500">
        Informe Generat - {new Date().toLocaleDateString()}
      </div>
      <div id="print-footer" className="hidden print:block w-full max-w-2xl mx-auto mt-8 text-center text-xs text-gray-500">
        Document Intern
      </div>

      {/* --- Àrea d'Errors Globals DOCX (sense canvis) --- */}
       {docxError && (
        <div className="web-errors w-full max-w-2xl mx-auto text-sm text-red-600 text-center mb-4 -mt-2 px-1">
            <p>{docxError}</p>
        </div>
       )}


      {/* --- "Foli" Blanc Principal (sense canvis) --- */}
      <div className="print-content w-full max-w-2xl bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-4 relative">

        {isLoadingDocx && (
          <div className="text-center my-6">
             <p className="text-blue-600 animate-pulse">Processant DOCX: {selectedFileName}...</p>
          </div>
         )}

        <div className="mt-1">
          {isMounted && convertedHtml ? (
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: convertedHtml }}
            />
          ) : (
             !isLoadingDocx && !docxError && <p className="text-gray-400 italic text-center py-10">Selecciona un fitxer .docx per visualitzar la plantilla.</p>
          )}
        </div>

        {/* ===== ELIMINAT EL BOTÓ PER OBRIR EL MODAL ===== */}
        {/* Ja no cal, s'obre automàticament amb useEffect */}

        {mammothMessages && mammothMessages.length > 0 && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-orange-600 mb-2">Missatges de la Conversió DOCX:</h3>
              <ul className="list-disc list-inside text-sm text-orange-700 bg-orange-50 p-4 rounded-md">
                {mammothMessages.map((msg, index) => (
                  <li key={index}><strong>{msg.type}:</strong> {msg.message}</li>
                ))}
              </ul>
            </div>
          )}

      </div> {/* Fi del "Foli" Blanc */}


      {/* --- MODAL PER EXCEL (Sense canvis interns, només la forma d'obrir-lo) --- */}
      {isMounted && isExcelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-700">Carregar i Visualitzar Dades Excel</h3>
              <button
                onClick={() => setIsExcelModalOpen(false)} // <-- Botó per tancar manualment
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                aria-label="Tancar modal"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-grow">
              {/* Input Excel */}
              <div className="mb-4 flex flex-col sm:flex-row items-center gap-3">
                <label htmlFor="excelInputModal" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${isParsingExcel ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition ease-in-out duration-150 ${isParsingExcel ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  {isParsingExcel ? 'Processant...' : (selectedExcelFileName ? 'Canvia Fitxer' : 'Selecciona Excel')}
                </label>
                <input type="file" id="excelInputModal" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel} />
                {selectedExcelFileName && !isParsingExcel && (<span className="text-sm text-gray-600 italic">({selectedExcelFileName})</span>)}
              </div>
              {/* Loading Excel */}
              {isParsingExcel && (<div className="text-center my-4"><p className="text-green-600 animate-pulse">Processant Excel: {selectedExcelFileName}...</p></div>)}
              {/* Error Excel */}
              {excelError && (<p className="text-sm text-red-600 text-center my-3">{excelError}</p>)}
              {/* Taula Excel */}
              {excelData && excelData.length > 0 && !isParsingExcel && (
                <div className="mt-4">
                    <h4 className="text-md font-semibold text-green-700 mb-2">Dades Extretes de l'Excel:</h4>
                    <p className="text-xs text-gray-600 mb-3">S'han llegit {excelData.length} files (mostrant les primeres 10 com a exemple).</p>
                    <div className="overflow-x-auto bg-gray-50 p-3 rounded shadow border max-h-[40vh] overflow-y-auto">
                        <table className="min-w-full text-xs border border-gray-300">
                            <thead className="bg-gray-200 sticky top-0">
                                <tr>{Object.keys(excelData[0]).map((header) => (<th key={header} className="px-2 py-1 border border-gray-300 text-left font-medium text-gray-600 whitespace-nowrap">{header}</th>))}</tr>
                            </thead>
                            <tbody>
                                {excelData.slice(0, 10).map((row, rowIndex) => (<tr key={rowIndex} className="bg-white even:bg-gray-50">{Object.values(row).map((cell, cellIndex) => (<td key={cellIndex} className="px-2 py-1 border border-gray-300 text-gray-700">{String(cell)}</td>))}</tr>))}
                            </tbody>
                        </table>
                    </div>
                </div>
              )}
              {excelData && excelData.length === 0 && !isParsingExcel && (<div className="mt-4"><p className="text-orange-600 text-center">L'Excel s'ha processat, però no s'han trobat dades a la primera fulla.</p></div>)}
              {!selectedExcelFileName && !isParsingExcel && !excelError && (<p className="text-gray-400 italic text-center py-5">Selecciona un fitxer Excel per veure les dades.</p>)}
            </div>

            {/* Peu del Modal */}
            <div className="flex justify-end items-center p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => setIsExcelModalOpen(false)} // <-- Botó per tancar manualment
                className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition ease-in-out duration-150"
              >
                Tancar
              </button>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}