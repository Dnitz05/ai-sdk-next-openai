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
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false); // Nou estat per al modal

  // Estat per renderitzat client (solució error #418)
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- Funcions DOCX (sense canvis) ---
  const triggerUpload = async (file: File) => {
    setIsLoadingDocx(true); setDocxError(null); setConvertedHtml(null); setMammothMessages([]);
    // Resetegem també l'estat de l'excel quan es puja un nou DOCX
    setSelectedExcelFileName(null); setExcelData(null); setExcelError(null); setIsExcelModalOpen(false);
    const formData = new FormData(); formData.append('file', file);
    try {
      const response = await fetch('/api/process-document', { method: 'POST', body: formData });
      const contentType = response.headers.get("content-type");
      if (!response.ok) {
        let errorPayload: any = { error: `Error del servidor: ${response.status} ${response.statusText}` };
        if (contentType && contentType.includes("application/json")) { try { errorPayload = await response.json(); } catch (e) { console.error("Error llegint error JSON", e); }} else { try { const rawErrorText = await response.text(); console.error("Resposta d'error no JSON:", rawErrorText); errorPayload.details = "Error inesperat."; } catch (e) { console.error("Error llegint error Text", e); }}
        throw new Error(errorPayload.error || JSON.stringify(errorPayload));
      }
      if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setConvertedHtml(data.html); setMammothMessages(data.messages || []);
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
        // Tanquem modal i netegem excel si el docx és invàlid
        setIsExcelModalOpen(false); setSelectedExcelFileName(null); setExcelData(null); setExcelError(null);
      }
    } else { setSelectedFileName(null); }
    event.target.value = '';
  };

  // --- Funcions EXCEL (sense canvis en la lògica, només s'usarà dins el modal) ---
  const handleExcelFileChange = (event: ChangeEvent<HTMLInputElement>) => {
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
    // Important per poder seleccionar el mateix fitxer un altre cop dins el modal
    // Potser cal gestionar el reset d'una altra manera si causa problemes dins el modal
    // event.target.value = ''; // Comentat temporalment per si interfereix amb el flux del modal
  };


  // --- JSX ---
  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">

      {/* --- Capçalera WEB --- */}
      {/* Ara només conté el títol i el botó del DOCX */}
      <div className="web-header w-full max-w-2xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 px-1 gap-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-600 flex-shrink-0">
          Visor DOCX / Processador Excel
        </h2>
        {/* Contenidor només per al botó DOCX */}
        <div className="flex w-full sm:w-auto">
          <div>
            <label htmlFor="fileInput" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${isLoadingDocx ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition ease-in-out duration-150 ${isLoadingDocx || isParsingExcel ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              {/* Deshabilitem si l'excel també carrega? O només amb DOCX? Per ara amb els dos. */}
              {isLoadingDocx ? 'Processant DOCX...' : (selectedFileName ? 'Canvia DOCX' : 'Selecciona DOCX')}
            </label>
            <input
              type="file"
              id="fileInput"
              onChange={handleFileChange}
              accept=".docx"
              className="hidden"
              disabled={isLoadingDocx || isParsingExcel} // Deshabilita si alguna cosa carrega
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

      {/* --- Àrea d'Errors Globals (només DOCX ara) --- */}
       {docxError && (
        <div className="web-errors w-full max-w-2xl mx-auto text-sm text-red-600 text-center mb-4 -mt-2 px-1">
            <p>{docxError}</p>
            {/* L'error de l'excel es mostrarà dins el modal */}
        </div>
       )}


      {/* --- "Foli" Blanc Principal --- */}
      <div className="print-content w-full max-w-2xl bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-4 relative"> {/* Afegit relative per posicionar botó si cal */}

        {/* Indicador de càrrega Global DOCX */}
        {isLoadingDocx && (
          <div className="text-center my-6">
             <p className="text-blue-600 animate-pulse">Processant DOCX: {selectedFileName}...</p>
          </div>
         )}

        {/* Àrea de Resultats DOCX */}
        <div className="mt-1">
          {isMounted && convertedHtml ? (
            <div
              className="prose max-w-none" // Mantenim la mida 'prose' base
              dangerouslySetInnerHTML={{ __html: convertedHtml }}
            />
          ) : (
             !isLoadingDocx && !docxError && <p className="text-gray-400 italic text-center py-10">Selecciona un fitxer .docx per visualitzar la plantilla.</p>
          )}
        </div>

        {/* --- Botó per obrir el Modal Excel --- */}
        {/* Només apareix si el DOCX s'ha carregat correctament */}
        {isMounted && convertedHtml && !isLoadingDocx && !docxError && (
            <div className="mt-8 text-center border-t pt-6">
                <button
                    onClick={() => setIsExcelModalOpen(true)}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition ease-in-out duration-150"
                    disabled={isLoadingDocx || isParsingExcel} // Deshabilitem si alguna cosa carrega
                >
                    Carregar Dades des d'Excel
                </button>
            </div>
        )}


        {/* Àrea de Missatges de Mammoth (sense canvis) */}
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

         {/* L'àrea de dades Excel ja no va aquí, es mourà al Modal */}

      </div> {/* Fi del "Foli" Blanc */}


      {/* --- MODAL PER EXCEL --- */}
      {/* Només es renderitza si isExcelModalOpen és true */}
      {isMounted && isExcelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm"> {/* Overlay */}
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"> {/* Contingut del Modal */}

            {/* Capçalera del Modal */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-700">Carregar i Visualitzar Dades Excel</h3>
              <button
                onClick={() => setIsExcelModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                aria-label="Tancar modal"
              >
                &times; {/* Icona 'x' per tancar */}
              </button>
            </div>

            {/* Cos del Modal (amb scroll si cal) */}
            <div className="p-6 overflow-y-auto flex-grow">

              {/* Input per seleccionar Excel */}
              <div className="mb-4 flex flex-col sm:flex-row items-center gap-3">
                <label htmlFor="excelInputModal" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${isParsingExcel ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition ease-in-out duration-150 ${isParsingExcel ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  {isParsingExcel ? 'Processant...' : (selectedExcelFileName ? 'Canvia Fitxer' : 'Selecciona Excel')}
                </label>
                <input
                  type="file"
                  id="excelInputModal" // ID diferent per si de cas, encara que l'altre s'elimina
                  onChange={handleExcelFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                  disabled={isParsingExcel} // Només deshabilitem per la càrrega de l'excel aquí
                />
                {selectedExcelFileName && !isParsingExcel && (
                  <span className="text-sm text-gray-600 italic">({selectedExcelFileName})</span>
                )}
              </div>

              {/* Indicador de Càrrega Excel */}
              {isParsingExcel && (
                <div className="text-center my-4">
                  <p className="text-green-600 animate-pulse">Processant Excel: {selectedExcelFileName}...</p>
                </div>
              )}

              {/* Error d'Excel */}
              {excelError && (
                <p className="text-sm text-red-600 text-center my-3">{excelError}</p>
              )}

              {/* Àrea de Dades Excel Processades dins el Modal */}
              {excelData && excelData.length > 0 && !isParsingExcel && (
                <div className="mt-4">
                    <h4 className="text-md font-semibold text-green-700 mb-2">Dades Extretes de l'Excel:</h4>
                    <p className="text-xs text-gray-600 mb-3">S'han llegit {excelData.length} files (mostrant les primeres 10 com a exemple).</p>
                    <div className="overflow-x-auto bg-gray-50 p-3 rounded shadow border max-h-[40vh] overflow-y-auto"> {/* Limitem alçada i activem scroll */}
                        <table className="min-w-full text-xs border border-gray-300">
                            <thead className="bg-gray-200 sticky top-0"> {/* Capçalera fixe */}
                                <tr>
                                    {Object.keys(excelData[0]).map((header) => (
                                        <th key={header} className="px-2 py-1 border border-gray-300 text-left font-medium text-gray-600 whitespace-nowrap">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {excelData.slice(0, 10).map((row, rowIndex) => ( // Mostra només les primeres 10 files
                                    <tr key={rowIndex} className="bg-white even:bg-gray-50">
                                        {Object.values(row).map((cell, cellIndex) => (
                                            <td key={cellIndex} className="px-2 py-1 border border-gray-300 text-gray-700">{String(cell)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Aquí podries afegir botons per confirmar/utilitzar aquestes dades */}
                </div>
              )}
              {excelData && excelData.length === 0 && !isParsingExcel && (
                 <div className="mt-4">
                     <p className="text-orange-600 text-center">L'Excel s'ha processat, però no s'han trobat dades a la primera fulla.</p>
                 </div>
              )}

              {/* Missatge inicial si no s'ha carregat res */}
               {!selectedExcelFileName && !isParsingExcel && !excelError && (
                   <p className="text-gray-400 italic text-center py-5">Selecciona un fitxer Excel per veure les dades.</p>
               )}

            </div> {/* Fi del Cos del Modal */}

            {/* Peu del Modal (opcional, per botons d'accions) */}
            <div className="flex justify-end items-center p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
               {/* Podries afegir un botó "Confirmar Dades" aquí si cal */}
              <button
                onClick={() => setIsExcelModalOpen(false)}
                className="px-4 py-2 bg-gray-500 text-white text-sm font-medium rounded shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition ease-in-out duration-150"
              >
                Tancar
              </button>
            </div>

          </div> {/* Fi del Contingut del Modal */}
        </div> // Fi del Overlay
      )} {/* Fi del renderitzat condicional del Modal */}

    </main>
  );
}