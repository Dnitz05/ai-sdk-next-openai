// app/page.tsx
'use client';

import React, { useState, ChangeEvent, useEffect, useRef, MouseEvent, useMemo } from 'react';
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

    // --- Estat del Sidebar ---
    const [isLinkerSidebarOpen, setIsLinkerSidebarOpen] = useState(false);

    // --- Estats per Vinculació Excel ---
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null);
    const [links, setLinks] = useState<{ id: string; excelHeader: string; selectedText: string }[]>([]);

    // --- Estats per IA ---
    const [aiSelectedText, setAiSelectedText] = useState<string | null>(null);
    const [aiSelectedRangeId, setAiSelectedRangeId] = useState<string | null>(null);
    const [aiUserPrompt, setAiUserPrompt] = useState<string>('');
    const [aiResult, setAiResult] = useState<string | null>(null);
    const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);

    // --- Estat per Guardar Configuració ---
    type SaveStatus = 'idle' | 'saving' | 'success' | 'error';
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    // --- Refs ---
    const contentRef = useRef<HTMLDivElement>(null);
    const prevIsLoadingDocx = useRef<boolean>(isLoadingDocx); // Ref per detectar canvi d'estat

    // Estat per renderitzat client
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // --- useEffect per obrir el sidebar automàticament (CORREGIT) ---
    useEffect(() => {
        // Obre i reseteja només quan isLoadingDocx passa de TRUE a FALSE amb èxit
        if (prevIsLoadingDocx.current && !isLoadingDocx && isMounted && convertedHtml && !docxError) {
            console.log(">>> useEffect: DOCX carregat amb èxit, obrint sidebar i resetejant IA/Save <<<");
            setIsLinkerSidebarOpen(true);
            setAiSelectedText(null);
            setAiSelectedRangeId(null);
            setAiUserPrompt('');
            setAiResult(null);
            setSaveStatus('idle');
            setSaveMessage(null);
        }
        // Actualitza el valor previ per a la propera execució
        prevIsLoadingDocx.current = isLoadingDocx;
    }, [isLoadingDocx, convertedHtml, docxError, isMounted]); // Dependències CORRECTES

    // Càlcul dels recomptes de vincles
    const linkCounts = useMemo(() => { /* ... (sense canvis) ... */
        const counts: { [key: string]: number } = {}; for (const link of links) { counts[link.excelHeader] = (counts[link.excelHeader] || 0) + 1; } return counts;
    }, [links]);

    // --- Funcions DOCX ---
    const triggerUpload = async (file: File) => { /* ... (sense canvis) ... */
        setIsLoadingDocx(true); setDocxError(null); setConvertedHtml(null); setMammothMessages([]); setSelectedExcelFileName(null); setExcelData(null); setExcelError(null); setExcelHeaders([]); setSelectedExcelHeader(null); setIsLinkerSidebarOpen(false); setLinks([]); setAiSelectedText(null); setAiSelectedRangeId(null); setAiUserPrompt(''); setAiResult(null); setIsLoadingAI(false); setSaveStatus('idle'); setSaveMessage(null); const formData = new FormData(); formData.append('file', file); try { const response = await fetch('/api/process-document', { method: 'POST', body: formData }); const contentType = response.headers.get("content-type"); if (!response.ok) { let errorPayload: any = { error: `Error del servidor: ${response.status} ${response.statusText}` }; if (contentType && contentType.includes("application/json")) { try { errorPayload = await response.json(); } catch (e) { console.error("Error llegint error JSON", e); } } else { try { const rawErrorText = await response.text(); console.error("Resposta d'error no JSON:", rawErrorText); errorPayload.details = "Error inesperat."; } catch (e) { console.error("Error llegint error Text", e); } } throw new Error(errorPayload.error || JSON.stringify(errorPayload)); } if (contentType && contentType.includes("application/json")) { const data = await response.json(); setConvertedHtml(data.html); setMammothMessages(data.messages || []); } else { const rawText = await response.text(); console.warn("Resposta OK però no és JSON:", rawText); throw new Error("Format de resposta inesperat."); } } catch (err) { console.error("Error processant DOCX:", err); setDocxError(err instanceof Error ? err.message : 'Error desconegut'); setConvertedHtml(null); } finally { setIsLoadingDocx(false); } // Aquesta transició dispararà l'useEffect si tot va bé
    };
    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => { /* ... (sense canvis) ... */
        if (event.target.files && event.target.files[0]) { const file = event.target.files[0]; setSelectedFileName(file.name); const isValidType = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx'); if (isValidType) { setDocxError(null); triggerUpload(file); } else { setDocxError('Si us plau, selecciona un fitxer .docx'); setConvertedHtml(null); setMammothMessages([]); setSelectedFileName('Cap fitxer seleccionat'); setSelectedExcelFileName(null); setExcelData(null); setExcelError(null); setExcelHeaders([]); setSelectedExcelHeader(null); setIsLinkerSidebarOpen(false); setLinks([]); setAiSelectedText(null); setAiSelectedRangeId(null); setAiUserPrompt(''); setAiResult(null); setIsLoadingAI(false); setSaveStatus('idle'); setSaveMessage(null); } } else { setSelectedFileName(null); } event.target.value = '';
    };

    // --- Funcions EXCEL (sense canvis) ---
    const handleExcelFileChange = (event: ChangeEvent<HTMLInputElement>) => { /* ... (sense canvis) ... */
        if (event.target.files && event.target.files[0]) { const file = event.target.files[0]; setSelectedExcelFileName(file.name); setExcelError(null); setExcelData(null); setSelectedExcelHeader(null); setExcelHeaders([]); setAiSelectedText(null); setAiSelectedRangeId(null); setAiUserPrompt(''); setAiResult(null); setSaveStatus('idle'); setSaveMessage(null); const validMimeTypes = [ 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ]; const isValidType = validMimeTypes.includes(file.type) || file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls'); if (isValidType) { setIsParsingExcel(true); const reader = new FileReader(); reader.onload = (e) => { try { const arrayBuffer = e.target?.result; if (arrayBuffer) { const workbook = XLSX.read(arrayBuffer, { type: 'buffer' }); const firstSheetName = workbook.SheetNames[0]; const worksheet = workbook.Sheets[firstSheetName]; const jsonData = XLSX.utils.sheet_to_json(worksheet); if (jsonData.length > 0) { const firstRow = jsonData[0]; if (firstRow && typeof firstRow === 'object') { const headers = Object.keys(firstRow); setExcelHeaders(headers); } else { console.warn("Excel: Primera fila no és un objecte."); setExcelHeaders([]); setExcelError("Format de fila inesperat a l'Excel."); } } else { setExcelHeaders([]); setExcelError("L'Excel sembla buit o no té dades a la primera fulla."); } setExcelData(jsonData); } else { throw new Error("No s'ha pogut llegir el contingut del fitxer."); } } catch (err) { console.error("Error parsejant Excel:", err); setExcelError(err instanceof Error ? `Error parsejant: ${err.message}` : 'Error desconegut durant el parseig'); setExcelData(null); setExcelHeaders([]); } finally { setIsParsingExcel(false); } }; reader.onerror = (e) => { console.error("Error llegint fitxer Excel:", e); setExcelError("Error llegint el fitxer Excel."); setIsParsingExcel(false); setExcelData(null); setExcelHeaders([]); }; reader.readAsArrayBuffer(file); } else { setExcelError('Si us plau, selecciona un fitxer .xlsx o .xls'); setSelectedExcelFileName(null); setExcelData(null); setExcelHeaders([]); } } else { } if (event.target) { event.target.value = ''; }
    };

    // --- Funcions per Vinculació Excel i Selecció IA ---
    const handleSelectHeader = (header: string) => { /* ... (sense canvis) ... */
        setAiSelectedText(null); setAiSelectedRangeId(null); setAiUserPrompt(''); setAiResult(null); setSelectedExcelHeader(header);
    };

    // Funció principal que gestiona el que passa quan l'usuari deixa de seleccionar text (MODIFICADA per IA)
    const handleTextSelection = () => {
        if (!isLinkerSidebarOpen) return;
        const selection = window.getSelection();

        // Cas 1: Vincular (Capçalera seleccionada)
        if (selectedExcelHeader && selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
            // ... (Lògica de vinculació sense canvis, usa delete/insertNode) ...
            const originalSelectedText = selection.toString(); if (!originalSelectedText.trim()) { selection.removeAllRanges(); return; } const range = selection.getRangeAt(0); const linkId = `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`; if (!contentRef.current.contains(range.commonAncestorContainer)) { console.warn("Ignorant selecció (link): Fora de l'àrea de contingut."); selection.removeAllRanges(); setSelectedExcelHeader(null); return; } const span = document.createElement('span'); span.className = 'linked-placeholder'; span.dataset.excelHeader = selectedExcelHeader; span.dataset.linkId = linkId; span.textContent = selectedExcelHeader; try { range.deleteContents(); range.insertNode(span); const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); setLinks(prevLinks => [...prevLinks, { id: linkId, excelHeader: selectedExcelHeader!, selectedText: selectedExcelHeader! }]); } catch (error) { console.error("Error modificant DOM (link):", error); alert("Error: La selecció no es pot vincular. Intenta seleccionar text dins d'un mateix paràgraf."); } finally { selection.removeAllRanges(); setSelectedExcelHeader(null); }
        }
        // Cas 2: Preparar per IA (Capçalera NO seleccionada)
        else if (!selectedExcelHeader && selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
            const currentSelectedText = selection.toString();
            if (!currentSelectedText.trim()) { selection.removeAllRanges(); return; }
            const range = selection.getRangeAt(0);
            if (!contentRef.current.contains(range.commonAncestorContainer)) {
                console.warn("Ignorant selecció (IA): Fora de l'àrea de contingut.");
                selection.removeAllRanges(); return;
            }

            // Neteja marca IA anterior
            if (aiSelectedRangeId) { const previousSpan = contentRef.current.querySelector(`span[data-ai-id="${aiSelectedRangeId}"]`); if (previousSpan) { previousSpan.removeAttribute("data-ai-id"); } }

            const tempId = `temp-ai-${Date.now()}`;
            const tempSpan = document.createElement('span');
            tempSpan.dataset.aiId = tempId;

            try {
                // === CANVI: Mètode Robust per Embolcallar ===
                const fragment = range.extractContents(); // Extreu (i esborra) contingut
                tempSpan.appendChild(fragment); // Posa el contingut dins l'span
                range.insertNode(tempSpan); // Insereix l'span amb el contingut
                // ==========================================

                const updatedHtmlWithTempSpan = contentRef.current.innerHTML;
                setConvertedHtml(updatedHtmlWithTempSpan); // Actualitza HTML amb marcador

                console.log("DEBUG HANDLER: Setting AI state -> Text:", currentSelectedText, "ID:", tempId);
                setAiSelectedText(currentSelectedText); // <-- Actualitza estat AI
                setAiSelectedRangeId(tempId);
                setAiUserPrompt('');
                setAiResult(null);
                setIsLoadingAI(false);

            } catch (error) {
                console.error("Error manipulant DOM per IA (extract/insert):", error);
                alert("Error al marcar la selecció per a la IA. La selecció podria ser massa complexa.");
                // Si falla, l'estat AI no s'hauria d'actualitzar
                setAiSelectedText(null);
                setAiSelectedRangeId(null);
            } finally {
                selection.removeAllRanges(); // Desselecciona text al navegador
            }
        }
    };

    // Funció per tancar el sidebar
    const handleCloseSidebar = () => { /* ... (sense canvis) ... */
        if (aiSelectedRangeId && contentRef.current) { const previousSpan = contentRef.current.querySelector(`span[data-ai-id="${aiSelectedRangeId}"]`); if (previousSpan) { previousSpan.removeAttribute("data-ai-id"); } } setIsLinkerSidebarOpen(false); setSelectedExcelHeader(null); setAiSelectedText(null); setAiSelectedRangeId(null); setSaveStatus('idle'); setSaveMessage(null);
    };

    // --- Funcions per Eines IA (Esquelets, sense canvis) ---
    const handleProcessAI = async () => { /* ... (sense canvis) ... */
        if (!aiSelectedText || !aiUserPrompt) return; setIsLoadingAI(true); setAiResult(null); console.log("Enviant a IA:", { text: aiSelectedText, prompt: aiUserPrompt }); try { const response = await fetch('/api/process-ai-prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selectedText: aiSelectedText, userPrompt: aiUserPrompt }) }); if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `Error del servidor: ${response.status}`); } const data = await response.json(); setAiResult(data.result || "No s'ha rebut resultat."); } catch (error) { console.error("Error trucant a l'API d'IA:", error); setAiResult(`Error: ${error instanceof Error ? error.message : String(error)}`); } finally { setIsLoadingAI(false); }
    };
    const handleReplaceWithAI = () => { /* ... (sense canvis) ... */
         if (!aiResult || !aiSelectedRangeId || !contentRef.current) return; const targetSpan = contentRef.current.querySelector(`span[data-ai-id="${aiSelectedRangeId}"]`); if (targetSpan) { try { const aiSpan = document.createElement('span'); aiSpan.className = 'ai-generated-content'; aiSpan.textContent = aiResult; targetSpan.replaceWith(aiSpan); const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); setAiSelectedText(null); setAiSelectedRangeId(null); setAiUserPrompt(''); setAiResult(null); } catch (error) { console.error("Error reemplaçant text amb resultat IA:", error); alert("Error reemplaçant el text."); } } else { console.error("No s'ha trobat l'span temporal amb ID:", aiSelectedRangeId); alert("Error: No s'ha pogut trobar la selecció original per reemplaçar."); setAiSelectedText(null); setAiSelectedRangeId(null); setAiUserPrompt(''); setAiResult(null); }
    };
    const handleDiscardAI = () => { /* ... (sense canvis) ... */
         if (aiSelectedRangeId && contentRef.current) { const targetSpan = contentRef.current.querySelector(`span[data-ai-id="${aiSelectedRangeId}"]`); if (targetSpan) { targetSpan.removeAttribute("data-ai-id"); const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); } } setAiSelectedText(null); setAiSelectedRangeId(null); setAiUserPrompt(''); setAiResult(null);
     };

    // --- Funció per al botó Guardar Configuració (MODIFICADA per no tancar sidebar) ---
    const handleSaveConfiguration = async () => {
        console.log("Intentant desar configuració...");
        setSaveStatus('saving'); setSaveMessage(null);
        if (!contentRef.current) { setSaveMessage("Error: No es pot accedir al contingut HTML final."); setSaveStatus('error'); return; }
        const finalHtml = contentRef.current.innerHTML;
        const configuration = { baseDocxName: selectedFileName, excelInfo: { fileName: selectedExcelFileName, headers: excelHeaders, }, linkMappings: links, finalHtml: finalHtml };
        console.log("Configuració a desar:", configuration);
        try {
            // TODO: Reemplaçar amb la crida real a l'API backend
            // const response = await fetch('/api/save-configuration', { method: 'POST', body: JSON.stringify(configuration), headers: {'Content-Type': 'application/json'} });
            // if (!response.ok) { throw new Error('Error del servidor al guardar'); }
            // const result = await response.json();

            // Simulació d'èxit
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log("Configuració guardada (simulat).");
            setSaveMessage("Configuració guardada amb èxit!");
            setSaveStatus('success');
            // NO tanquem el sidebar: // handleCloseSidebar();

        } catch (error) {
            console.error("Error desant configuració:", error);
            setSaveMessage(`Error al guardar: ${error instanceof Error ? error.message : 'Error desconegut'}`);
            setSaveStatus('error');
        }
    };


    // --- JSX ---
    // Eliminem el log de DEBUG RENDER CHECK per netejar consola
    // if (isMounted) { console.log("DEBUG RENDER CHECK:", { ... }); }

    return (
        <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">

            {/* Capçalera WEB */}
            {/* ... (sense canvis) ... */}
            <div className="web-header w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 px-1 gap-4"><h2 className="text-base sm:text-lg font-semibold text-gray-600 flex-shrink-0"> Visor DOCX / Processador Excel </h2><div className="flex w-full sm:w-auto"> <div> <label htmlFor="fileInput" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${isLoadingDocx ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition ease-in-out duration-150 ${isLoadingDocx || isParsingExcel ? 'cursor-not-allowed' : 'cursor-pointer'}`}> {isLoadingDocx ? 'Processant DOCX...' : (selectedFileName ? 'Canvia DOCX' : 'Selecciona DOCX')} </label> <input type="file" id="fileInput" onChange={handleFileChange} accept=".docx" className="hidden" disabled={isLoadingDocx || isParsingExcel} /> {selectedFileName && !isLoadingDocx && <span className="ml-2 text-xs text-gray-500 italic hidden sm:inline">({selectedFileName})</span>} </div> </div></div>


            {/* Capçalera/Peu Impressió */}
            {/* ... (sense canvis) ... */}
            <div id="print-header" className="hidden print:block w-full max-w-4xl mx-auto mb-4 text-center text-xs text-gray-500">Informe Generat - {new Date().toLocaleDateString()}</div><div id="print-footer" className="hidden print:block w-full max-w-4xl mx-auto mt-8 text-center text-xs text-gray-500">Document Intern</div>


            {/* Errors DOCX */}
            {docxError && (<div className="web-errors w-full max-w-4xl mx-auto text-sm text-red-600 text-center mb-4 -mt-2 px-1"><p>{docxError}</p></div>)}

            {/* Contenidor Principal (Flexbox per Foli + Sidebar) */}
            <div className="flex w-full max-w-6xl gap-x-6 px-1">

                {/* Columna Esquerra: Foli Blanc DOCX */}
                <div className="flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-4">
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
                         <div className="mt-6 border-t border-gray-200 pt-6"> <h3 className="text-lg font-semibold text-orange-600 mb-2">Missatges de la Conversió DOCX:</h3> <ul className="list-disc list-inside text-sm text-orange-700 bg-orange-50 p-4 rounded-md"> {mammothMessages.map((msg, index) => ( <li key={index}><strong>{msg.type}:</strong> {msg.message}</li> ))} </ul> </div>
                    )}
                    {/* Visualització Vincles (Debug) */}
                    {links && links.length > 0 && (
                        <div className="mt-6 border-t border-gray-200 pt-4"> <h3 className="text-md font-semibold text-purple-600 mb-2">Vincles Creats (Placeholders):</h3> <ul className="list-disc list-inside text-xs text-gray-700"> {links.map(link => ( <li key={link.id}> "{link.selectedText}" {' (Vinculat a '} <strong>{link.excelHeader}</strong>{')'} ID: {link.id} </li> ))} </ul> </div>
                    )}
                </div> {/* Fi Columna Esquerra (Foli) */}


                {/* Columna Dreta: Sidebar de Vinculació */}
                {isMounted && isLinkerSidebarOpen && (
                    <aside className="w-80 flex-shrink-0 my-4 relative">
                        <div className="sticky top-4 p-4 bg-white rounded shadow-lg border max-h-[calc(100vh-2rem)] overflow-y-auto flex flex-col">
                            {/* Capçalera Sidebar */}
                            <div className="flex justify-between items-center mb-3 pb-2 border-b flex-shrink-0">
                                <h3 className="text-md font-semibold text-blue-700">Edició i Vinculació</h3>
                                <button onClick={handleCloseSidebar} className="text-gray-400 hover:text-gray-600 text-xl font-bold" aria-label="Tancar panell">&times;</button>
                            </div>

                            {/* Contingut principal del Sidebar */}
                            <div className="flex-grow overflow-y-auto space-y-4 pr-1 mb-4">

                                {/* Pas 1: Carregar Excel */}
                                {excelHeaders.length === 0 && (
                                    <div className="p-3 border border-dashed border-gray-300 rounded">
                                        {/* ... Input Excel ... */}
                                        <p className="text-sm font-medium text-gray-700 mb-2">Pas 1: Carregar Excel</p><div className="flex flex-col items-start gap-2"> <label htmlFor="excelInputSidebar" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${isParsingExcel ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition ease-in-out duration-150 ${isParsingExcel ? 'cursor-not-allowed' : 'cursor-pointer'}`}> {isParsingExcel ? 'Processant...' : (selectedExcelFileName ? 'Canvia Fitxer' : 'Selecciona Excel')} </label> <input type="file" id="excelInputSidebar" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel} /> {selectedExcelFileName && !isParsingExcel && (<span className="text-xs text-gray-500 italic">({selectedExcelFileName})</span>)} </div> {isParsingExcel && (<div className="text-center mt-2"><p className="text-green-600 animate-pulse text-xs">Processant...</p></div>)} {excelError && (<p className="text-xs text-red-600 mt-2">{excelError}</p>)} {!selectedExcelFileName && !isParsingExcel && !excelError && (<p className="text-xs text-gray-400 mt-2 italic">Puja un fitxer per veure les capçaleres.</p>)}
                                    </div>
                                )}

                                {/* Pas 2: Vincular */}
                                {excelHeaders.length > 0 && (
                                    <div>
                                        {/* ... Llista Capçaleres amb comptadors ... */}
                                        <p className="text-sm font-medium text-gray-700 mb-1">Pas 2: Vincular amb Excel</p> <p className="text-xs text-gray-600 mb-2">1. Clica una capçalera:</p> <div className="flex flex-col gap-1 mb-4 max-h-48 overflow-y-auto pr-1 border rounded p-2 bg-gray-50"> {excelHeaders.map(header => { const count = linkCounts[header] || 0; const isLinked = count > 0; return ( <button key={header} onClick={() => handleSelectHeader(header)} className={`w-full text-left px-2 py-1 border rounded text-xs font-medium transition-colors break-words flex justify-between items-center ${ selectedExcelHeader === header ? 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-300' : isLinked ? 'bg-green-50 text-green-800 border-green-300 hover:bg-green-100' : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-100' }`} > <span>{header}</span> {count > 0 && ( <span className={`ml-2 text-xs font-normal px-1.5 py-0.5 rounded ${selectedExcelHeader === header ? 'bg-white text-blue-700' : 'bg-gray-200 text-gray-600'}`}> ({count}) </span> )} </button> ); })} </div> {selectedExcelHeader && ( <p className="text-xs text-gray-600 mb-1 bg-blue-50 p-2 rounded border border-blue-200"> <strong className="text-blue-700 block mb-1">PAS 2 (cont.):</strong> Ara, selecciona el text al document (a l'esquerra) que vols <strong className='text-red-600'>REEMPLAÇAR</strong> per:<br /> <span className="font-semibold italic">{selectedExcelHeader}</span> </p> )} {!selectedExcelHeader && ( <p className="text-xs text-gray-500 mb-1 p-2"> <strong className="block mb-1">PAS 2 (cont.):</strong> Esperant selecció de text per vincular... (O selecciona text per a la IA) </p> )} <div className="mt-4 text-center border-t pt-3"> <label htmlFor="excelInputSidebarChange" className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer"> Canviar fitxer Excel ({selectedExcelFileName || 'cap seleccionat'}) </label> <input type="file" id="excelInputSidebarChange" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel}/> </div>
                                    </div>
                                )}

                                {/* Pas 3: Eines IA */}
                                {excelHeaders.length > 0 && aiSelectedText && ( // Condició: Excel carregat I text seleccionat per IA
                                    <div className="mt-4 pt-4 border-t border-indigo-200">
                                        <h4 className="text-sm font-medium text-gray-700 mb-2">Pas 3: Eines IA</h4>
                                        {/* ... Contingut Eines IA ... */}
                                        <div className='p-3 border rounded bg-indigo-50 space-y-3 border-indigo-200'> <div> <label className='block text-xs font-medium text-gray-600 mb-1'>Text Seleccionat:</label> <p className="text-xs text-gray-800 bg-white p-2 border rounded max-h-20 overflow-y-auto"> {aiSelectedText} </p> </div> <div> <label htmlFor="aiPrompt" className='block text-xs font-medium text-gray-600 mb-1'> Indica què vols fer (Mini-Prompt): </label> <textarea id="aiPrompt" rows={3} value={aiUserPrompt} onChange={(e) => setAiUserPrompt(e.target.value)} placeholder="Ex: Resumeix, Tradueix a l'anglès, Fes-ho més formal..." className="w-full p-2 border border-gray-300 rounded text-xs focus:ring-indigo-500 focus:border-indigo-500" disabled={isLoadingAI} /> </div> <button onClick={handleProcessAI} disabled={isLoadingAI || !aiUserPrompt.trim()} className={`w-full px-3 py-1.5 text-xs font-medium rounded shadow-sm text-white transition ease-in-out duration-150 ${isLoadingAI || !aiUserPrompt.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'}`} > {isLoadingAI ? 'Processant IA...' : 'Processar amb IA'} </button> {isLoadingAI && ( <p className="text-center text-xs text-indigo-600 animate-pulse">Esperant resposta de la IA...</p> )} {aiResult && !isLoadingAI && ( <div className='mt-3 p-3 border rounded bg-white space-y-2'> <p className='text-xs font-medium text-gray-700'>Resultat IA:</p> <p className="text-xs text-gray-800 max-h-32 overflow-y-auto border p-2 bg-gray-50 rounded">{aiResult}</p> <div className='flex gap-2 mt-2 justify-end'> <button onClick={handleReplaceWithAI} className='px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700'>Reemplaçar</button> <button onClick={() => navigator.clipboard.writeText(aiResult)} className='px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300'>Copiar</button> <button onClick={handleDiscardAI} className='px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600'>Descartar</button> </div> </div> )} </div>
                                    </div>
                                )}
                                {/* Missatge si no hi ha Excel i es selecciona text */}
                                {excelHeaders.length === 0 && aiSelectedText && (
                                     <p className="text-xs text-orange-500 text-center p-2 border-t mt-4 pt-4">Has seleccionat text, però necessites carregar un fitxer Excel primer.</p>
                                )}

                            </div> {/* Fi Contingut Principal Sidebar */}

                            {/* Botó Guardar Configuració */}
                            <div className="mt-auto pt-4 border-t flex-shrink-0 space-y-2">
                                <button
                                    onClick={handleSaveConfiguration}
                                    disabled={saveStatus === 'saving'}
                                    className={`w-full px-4 py-2 text-sm font-medium rounded shadow-sm transition ease-in-out duration-150 ${saveStatus === 'saving' ? 'bg-gray-400 text-gray-600 cursor-wait' : 'bg-purple-600 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'}`}
                                >
                                    {saveStatus === 'saving' ? 'Guardant...' : 'Guardar Configuració'}
                                </button>
                                {/* Mostra missatge d'estat de guardat */}
                                {saveMessage && (
                                    <p className={`text-xs text-center ${saveStatus === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                                        {saveMessage}
                                    </p>
                                )}
                            </div>
                        </div>
                    </aside>
                )} {/* Fi Sidebar */}

            </div> {/* Fi Contenidor Principal Flex */}

        </main>
    );
} // <<< Fi component Home