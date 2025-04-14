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

  // Estat per renderitzat client (solució error #418)
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- Funcions DOCX ---
  const triggerUpload = async (file: File) => {
    setIsLoadingDocx(true); setDocxError(null); setConvertedHtml(null); setMammothMessages([]);
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

      const validMimeTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
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
            } else {
              throw new Error("No s'ha pogut llegir el contingut del fitxer.");
            }
          } catch (err) {
            console.error("Error parsejant Excel:", err);
            setExcelError(err instanceof Error ? `Error parsejant: ${err.message}` : 'Error desconegut durant el parseig');
            setExcelData(null);
          } finally {
            setIsParsingExcel(false);
          }
        };
        reader.onerror = (e) => {
          console.error("Error llegint fitxer Excel:", e);
          setExcelError("Error llegint el fitxer Excel.");
          setIsParsingExcel(false);
          setExcelData(null);
        };
        reader.readAsArrayBuffer(file);
      } else {
        setExcelError('Si us plau, selecciona un fitxer .xlsx o .xls');
        setSelectedExcelFileName(null);
        setExcelData(null);
      }
    } else {
      setSelectedExcelFileName(null);
      setExcelData(null);
    }
    event.target.value = '';
  };


  // --- JSX ---
  return (
    // Mantenim el fons gris per contrast
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">

      {/* --- Capçalera WEB --- */}
      {/* Ajustem l'amplada màxima aquí també per coherència */}
      <div className="web-header w-full max-w-2xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 px-1 gap-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-600 flex-shrink-0">
          Visor DOCX / Processador Excel
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {/* Botó Càrrega DOCX */}
          <div>
            <label htmlFor="fileInput" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${isLoadingDocx ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition ease-in-out duration-150 ${isLoadingDocx ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
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
          {/* Botó Càrrega EXCEL */}
          <div>
            <label htmlFor="excelInput" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${isParsingExcel ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition ease-in-out duration-150 ${isParsingExcel ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              {isParsingExcel ? 'Processant Excel...' : (selectedExcelFileName ? 'Canvia Excel' : 'Selecciona Excel')}
            </label>
            <input
              type="file"
              id="excelInput"
              onChange={handleExcelFileChange}
              accept=".xlsx, .xls"
              className="hidden"
              disabled={isLoadingDocx || isParsingExcel}
            />
            {selectedExcelFileName && !isParsingExcel && <span className="ml-2 text-xs text-gray-500 italic hidden sm:inline">({selectedExcelFileName})</span>}
          </div>
        </div>
      </div>

      {/* --- Capçalera/Peu per a Impressió --- */}
      {/* Ajustem l'amplada màxima aquí també */}
      <div id="print-header" className="hidden print:block w-full max-w-2xl mx-auto mb-4 text-center text-xs text-gray-500">
        Informe Generat - {new Date().toLocaleDateString()}
      </div>
      <div id="print-footer" className="hidden print:block w-full max-w-2xl mx-auto mt-8 text-center text-xs text-gray-500">
        Document Intern
      </div>

      {/* --- Àrea d'Errors --- */}
      {/* Ajustem l'amplada màxima aquí també */}
       {(docxError || excelError) && (
        <div className="web-errors w-full max-w-2xl mx-auto text-sm text-red-600 text-center mb-4 -mt-2 px-1">
            {docxError && <p>{docxError}</p>}
            {excelError && <p>{excelError}</p>}
        </div>
       )}


      {/* --- "Foli" Blanc Principal --- */}
      {/* ===== CANVI PRINCIPAL: AMPLADA ===== */}
      {/* Reduïm max-w- de 4xl a 2xl per assemblar-se més a A4 */}
      <div className="print-content w-full max-w-2xl bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-4">

        {(isLoadingDocx || isParsingExcel) && (
          <div className="text-center my-6">
             {isLoadingDocx && <p className="text-blue-600 animate-pulse">Processant DOCX: {selectedFileName}...</p>}
             {isParsingExcel && <p className="text-green-600 animate-pulse">Processant Excel: {selectedExcelFileName}...</p>}
          </div>
         )}

        {/* Àrea de Resultats DOCX */}
        <div className="mt-1">
          {isMounted && convertedHtml ? (
            <div
              // ===== CANVI PRINCIPAL: MIDA LLETRA =====
              // Canviem prose-sm a prose per augmentar mida base (normalment a 16px)
              className="prose max-w-none" // Eliminem prose-sm, deixem prose base
              dangerouslySetInnerHTML={{ __html: convertedHtml }}
            />
          ) : (
             !isLoadingDocx && !docxError && !convertedHtml && <p className="text-gray-400 italic text-center py-10">Selecciona un fitxer .docx per visualitzar la plantilla.</p>
          )}
        </div>

        {/* Àrea de Missatges de Mammoth */}
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

         {/* --- Àrea de Dades Excel Processades (Exemple) --- */}
         {isMounted && excelData && excelData.length > 0 && !isParsingExcel && (
            <div className="mt-8 border-t border-gray-300 pt-6">
                <h3 className="text-xl font-semibold text-green-700 mb-3">Dades Extretes de l'Excel:</h3>
                <p className="text-sm text-gray-600 mb-4">S'han llegit {excelData.length} files (mostrant les primeres 10 com a exemple).</p>
                <div className="overflow-x-auto bg-gray-50 p-4 rounded shadow">
                    {/* Ajustem la mida de la taula d'exemple perquè hereti de 'prose' */}
                    <table className="min-w-full text-sm border border-gray-300"> {/* Canviat text-xs a text-sm */}
                        <thead className="bg-gray-200">
                            <tr>
                                {Object.keys(excelData[0]).map((header) => (
                                    <th key={header} className="px-2 py-1 border border-gray-300 text-left font-medium text-gray-600">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {excelData.slice(0, 10).map((row, rowIndex) => (
                                <tr key={rowIndex} className="bg-white even:bg-gray-50">
                                    {Object.values(row).map((cell, cellIndex) => (
                                        <td key={cellIndex} className="px-2 py-1 border border-gray-300 text-gray-700">{String(cell)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
         )}
         {isMounted && excelData && excelData.length === 0 && !isParsingExcel && (
             <div className="mt-8 border-t border-gray-300 pt-6">
                 <p className="text-orange-600">L'Excel s'ha processat, però no s'han trobat dades a la primera fulla.</p>
             </div>
         )}

      </div> {/* Fi del "Foli" Blanc */}
    </main>
  );
}