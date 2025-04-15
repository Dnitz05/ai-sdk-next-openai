// app/page.tsx
'use client';

import React, { useState, ChangeEvent, useEffect, useRef, MouseEvent, useMemo } from 'react';
import * as XLSX from 'xlsx';

// Interfícies (sense canvis)
interface Link { id: string; excelHeader: string; selectedText: string; }
interface AiInstruction { id: string; prompt: string; originalText?: string; }

export default function Home() {
    // --- Estats (la majoria sense canvis, eliminem isLinkerSidebarOpen) ---
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
    const [isLoadingDocx, setIsLoadingDocx] = useState<boolean>(false);
    const [docxError, setDocxError] = useState<string | null>(null);
    const [mammothMessages, setMammothMessages] = useState<any[]>([]);
    const [selectedExcelFileName, setSelectedExcelFileName] = useState<string | null>(null);
    const [excelData, setExcelData] = useState<any[] | null>(null);
    const [isParsingExcel, setIsParsingExcel] = useState<boolean>(false);
    const [excelError, setExcelError] = useState<string | null>(null);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null);
    const [links, setLinks] = useState<Link[]>([]);
    const [aiSelectedText, setAiSelectedText] = useState<string | null>(null);
    const [aiTemporaryMarkerId, setAiTemporaryMarkerId] = useState<string | null>(null);
    const [aiUserPrompt, setAiUserPrompt] = useState<string>('');
    const [aiInstructions, setAiInstructions] = useState<AiInstruction[]>([]);
    type SaveStatus = 'idle' | 'saving' | 'success' | 'error';
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    // --- Refs ---
    const contentRef = useRef<HTMLDivElement>(null);
    // Ja NO necessitem prevIsLoadingDocx

    // Estat per renderitzat client
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    // Eliminat useEffect per obrir sidebar automàticament

    // Càlcul recomptes vincles Excel
    const linkCounts = useMemo(() => { /* ... (sense canvis) ... */
         const counts: { [key: string]: number } = {}; for (const link of links) { counts[link.excelHeader] = (counts[link.excelHeader] || 0) + 1; } return counts;
    }, [links]);

    // --- Funcions DOCX ---
    const triggerUpload = async (file: File) => {
        // Neteja tot excepte el nom del DOCX seleccionat
        setIsLoadingDocx(true); setDocxError(null); setConvertedHtml(null); setMammothMessages([]);
        setSelectedExcelFileName(null); setExcelData(null); setExcelError(null);
        setExcelHeaders([]); setSelectedExcelHeader(null); setLinks([]); // Reset links
        setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt(''); setAiInstructions([]); // Reset IA
        setSaveStatus('idle'); setSaveMessage(null);
        // ... (resta de la funció triggerUpload sense canvis) ...
        const formData = new FormData(); formData.append('file', file); try { const r=await fetch('/api/process-document',{method:'POST',body:formData});const ct=r.headers.get("content-type");if(!r.ok){let e:any={error:`E: ${r.status}`};try{e=await r.json();}catch{}throw new Error(e.error||`E ${r.status}`);}if(ct?.includes("application/json")){const d=await r.json();setConvertedHtml(d.html);setMammothMessages(d.messages||[]);}else{throw new Error("Format resposta inesperat.");}}catch(err){console.error("E DOCX:",err);setDocxError(err instanceof Error?err.message:'Error');setConvertedHtml(null);}finally{setIsLoadingDocx(false);}
    };

    // Ara cridat des de l'input del SIDEBAR per al DOCX
    const handleDocxFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            const isValidType = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx');
            if (isValidType) {
                setSelectedFileName(file.name); // Guardem nom
                setDocxError(null);
                triggerUpload(file); // Iniciem processament
            } else {
                setDocxError('Si us plau, selecciona un fitxer .docx');
                // Neteja tot si el fitxer no és vàlid
                setConvertedHtml(null); setMammothMessages([]); setSelectedFileName(null);
                setSelectedExcelFileName(null); setExcelData(null); setExcelError(null);
                setExcelHeaders([]); setSelectedExcelHeader(null); setLinks([]);
                setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt(''); setAiInstructions([]);
                setSaveStatus('idle'); setSaveMessage(null);
            }
        } else {
            // No fer res si cancel·la
        }
         if (event.target) { event.target.value = ''; } // Permet re-seleccionar
    };

    // --- Funcions EXCEL (Ara cridada des del sidebar Pas 2) ---
    const handleExcelFileChange = (event: ChangeEvent<HTMLInputElement>) => {
         // ... (Lògica interna igual, només reseteja IA/Guardat) ...
         if (event.target.files && event.target.files[0]) { const f=event.target.files[0];setSelectedExcelFileName(f.name);setExcelError(null);setExcelData(null);setSelectedExcelHeader(null);setExcelHeaders([]);setAiSelectedText(null);setAiTemporaryMarkerId(null);setAiUserPrompt('');/* NO reset aiInstructions */setSaveStatus('idle');setSaveMessage(null);const vMT=['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];const vT=vMT.includes(f.type)||f.name.toLowerCase().endsWith('.xlsx')||f.name.toLowerCase().endsWith('.xls');if(vT){setIsParsingExcel(true);const r=new FileReader();r.onload=(e)=>{try{const a=e.target?.result;if(a){const w=XLSX.read(a,{type:'buffer'});const sN=w.SheetNames[0];const wS=w.Sheets[sN];const jD=XLSX.utils.sheet_to_json(wS);if(jD.length>0){const fR=jD[0];if(fR&&typeof fR==='object'){setExcelHeaders(Object.keys(fR));}else{setExcelHeaders([]);setExcelError("Format fila Excel invàlid.");}}else{setExcelHeaders([]);setExcelError("Excel buit.");}setExcelData(jD);}else{throw new Error("Error llegint");}}catch(err){setExcelError(err instanceof Error?err.message:'Error');setExcelData(null);setExcelHeaders([]);}finally{setIsParsingExcel(false);}};r.onerror=(e)=>{setExcelError("Error llegint fitxer.");setIsParsingExcel(false);setExcelData(null);setExcelHeaders([]);};r.readAsArrayBuffer(f);}else{setExcelError('Selecciona .xlsx/.xls');setSelectedExcelFileName(null);setExcelData(null);setExcelHeaders([]);}}else{}if(event.target){event.target.value='';}
    };

    // --- Funcions per Vinculació Excel i Selecció IA ---
    const handleSelectHeader = (header: string) => {
         // Neteja estat temporal IA quan seleccionem capçalera per vincular
         if (aiTemporaryMarkerId && contentRef.current) { const tempSpan = contentRef.current.querySelector(`span[data-ai-temp-id="${aiTemporaryMarkerId}"]`); if (tempSpan) { tempSpan.replaceWith(...tempSpan.childNodes); const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); } }
         setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt('');
         setSelectedExcelHeader(header); // Activa per vincular Excel
    };

    const handleTextSelection = () => {
        // Aquesta funció ara només s'activa per onMouseUp al contingut principal
        const selection = window.getSelection();

        // Cas 1: Vincular Excel (selectedExcelHeader té valor)
        if (selectedExcelHeader && selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
            // ... (lògica vinculació Excel com abans: reemplaça text amb capçalera dins span.linked-placeholder) ...
             const originalSelectedText = selection.toString(); if (!originalSelectedText.trim()) { selection.removeAllRanges(); return; } const range = selection.getRangeAt(0); const linkId = `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`; if (!contentRef.current.contains(range.commonAncestorContainer)) { console.warn("Ignorant selecció (link): Fora de l'àrea."); selection.removeAllRanges(); setSelectedExcelHeader(null); return; } const span = document.createElement('span'); span.className = 'linked-placeholder'; span.dataset.excelHeader = selectedExcelHeader; span.dataset.linkId = linkId; span.textContent = selectedExcelHeader; try { range.deleteContents(); range.insertNode(span); const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); setLinks(prevLinks => [...prevLinks, { id: linkId, excelHeader: selectedExcelHeader!, selectedText: selectedExcelHeader! }]); console.log("Placeholder Excel inserit:", selectedExcelHeader); } catch (error) { console.error("Error DOM (link):", error); alert("Error vinculant."); } finally { selection.removeAllRanges(); setSelectedExcelHeader(null); }
             // Neteja temporal IA per si de cas
             if (aiTemporaryMarkerId && contentRef.current) { const tempSpan = contentRef.current.querySelector(`span[data-ai-temp-id="${aiTemporaryMarkerId}"]`); if (tempSpan) { tempSpan.replaceWith(...tempSpan.childNodes); } }
             setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt('');
        }
        // Cas 2: Preparar per Instrucció IA (selectedExcelHeader és null)
        else if (!selectedExcelHeader && selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
            const currentSelectedText = selection.toString();
            if (!currentSelectedText.trim()) { selection.removeAllRanges(); return; }
            const range = selection.getRangeAt(0);
            if (!contentRef.current.contains(range.commonAncestorContainer)) {
                console.warn("Ignorant selecció (IA): Fora de l'àrea.");
                selection.removeAllRanges(); return;
            }

            // Neteja marcador temporal IA anterior
            if (aiTemporaryMarkerId && contentRef.current) { const previousSpan = contentRef.current.querySelector(`span[data-ai-temp-id="${aiTemporaryMarkerId}"]`); if (previousSpan) { previousSpan.replaceWith(...previousSpan.childNodes); } }

            const tempId = `temp-ai-${Date.now()}`;
            const tempSpan = document.createElement('span');
            tempSpan.dataset.aiTempId = tempId;

            try {
                const fragment = range.extractContents();
                tempSpan.appendChild(fragment);
                range.insertNode(tempSpan);
                const updatedHtmlWithTempSpan = contentRef.current.innerHTML;
                setConvertedHtml(updatedHtmlWithTempSpan); // Actualitza HTML amb marcador temporal

                setAiSelectedText(currentSelectedText); // Guarda text original seleccionat
                setAiTemporaryMarkerId(tempId);      // Guarda ID temporal
                setAiUserPrompt('');                  // Reseteja prompt previ

            } catch (error) { console.error("Error embolcallant text per IA:", error); setAiSelectedText(null); setAiTemporaryMarkerId(null);
            } finally { selection.removeAllRanges(); }
        }
    };

    // Funció per tancar el sidebar (ja no és condicional)
    const handleCloseSidebar = () => {
        // Neteja marcador temporal IA si n'hi ha en tancar
         if (aiTemporaryMarkerId && contentRef.current) { const tempSpan = contentRef.current.querySelector(`span[data-ai-temp-id="${aiTemporaryMarkerId}"]`); if (tempSpan) { tempSpan.replaceWith(...tempSpan.childNodes); const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); } }
        // setIsLinkerSidebarOpen(false); // Ja no es tanca
        setSelectedExcelHeader(null);
        setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt('');
        setSaveStatus('idle'); setSaveMessage(null);
        // Hauríem de tenir un botó per "Reset/Tancar Sessió" potser? O es gestiona amb F5?
        alert("Funcionalitat de tancar sidebar eliminada de moment.");
    };

    // Funció per Guardar Instrucció IA
    const handleSaveAiInstruction = () => { /* ... (sense canvis) ... */
        if (!aiUserPrompt.trim() || !aiTemporaryMarkerId || !contentRef.current) { alert("Escriu instrucció."); return; } const tempSpan = contentRef.current.querySelector<HTMLElement>(`span[data-ai-temp-id="${aiTemporaryMarkerId}"]`); if (tempSpan) { const instructionId = `ai-instr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`; const originalText = aiSelectedText; tempSpan.removeAttribute('data-ai-temp-id'); tempSpan.setAttribute('data-ai-instruction-id', instructionId); tempSpan.className = 'ai-prompt-target'; const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); setAiInstructions(prev => [...prev, { id: instructionId, prompt: aiUserPrompt, originalText: originalText || undefined }]); console.log("Instrucció IA guardada:", { id: instructionId, prompt: aiUserPrompt }); setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt(''); } else { console.error("No marcador temporal IA."); alert("Error guardant instrucció."); setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt(''); }
    };

    // Funció per al botó Guardar Configuració
    const handleSaveConfiguration = async () => { /* ... (sense canvis) ... */
        console.log("Intentant desar configuració..."); setSaveStatus('saving'); setSaveMessage(null); if (!contentRef.current) { setSaveMessage("Error: No HTML."); setSaveStatus('error'); return; } let finalHtml = contentRef.current.innerHTML; if (aiTemporaryMarkerId) { const tSR = new RegExp(`<span data-ai-temp-id="${aiTemporaryMarkerId}">(.*?)</span>`, 'g'); finalHtml = finalHtml.replace(tSR, '$1'); setConvertedHtml(finalHtml); setAiSelectedText(null); setAiTemporaryMarkerId(null); } const configuration = { baseDocxName: selectedFileName, excelInfo: { fileName: selectedExcelFileName, headers: excelHeaders, }, linkMappings: links, aiInstructions: aiInstructions, finalHtml: finalHtml }; console.log("Configuració a desar:", configuration); try { await new Promise(resolve => setTimeout(resolve, 1000)); console.log("Configuració guardada (simulat)."); setSaveMessage("Configuració guardada amb èxit!"); setSaveStatus('success'); } catch (error) { console.error("Error desant:", error); setSaveMessage(`Error: ${error instanceof Error ? error.message : 'Error desconegut'}`); setSaveStatus('error'); }
    };


    // --- JSX ---
    return (
        <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">

            {/* Capçalera WEB (Ara no conté inputs) */}
            <div className="web-header w-full max-w-4xl mx-auto flex items-center justify-between mb-4 sm:mb-6 px-1">
                <h2 className="text-lg font-semibold text-gray-700">
                    Configurador Plantilles DOCX
                </h2>
                {/* Podríem afegir aquí un títol del document carregat si volem */}
                {selectedFileName && (
                    <span className="text-sm text-gray-500 italic hidden sm:block">
                       Editant: {selectedFileName} {selectedExcelFileName ? ` amb ${selectedExcelFileName}` : ''}
                    </span>
                )}
            </div>

            {/* Capçalera/Peu Impressió */}
            {/* ... (sense canvis) ... */}
             <div id="print-header" className="hidden print:block ...">Configuració Plantilla - {new Date().toLocaleDateString()}</div> <div id="print-footer" className="hidden print:block ..."></div>

            {/* Errors Globals (DOCX o Excel) */}
            {(docxError || excelError) && (
                <div className="web-errors w-full max-w-6xl mx-auto text-sm text-red-600 text-center mb-2 -mt-2 px-1">
                   {docxError && <p>Error DOCX: {docxError}</p>}
                   {excelError && <p>Error Excel: {excelError}</p>}
                </div>
            )}

            {/* Contenidor Principal (Flexbox per Foli + Sidebar) */}
            <div className="flex w-full max-w-6xl gap-x-6 px-1">

                {/* Columna Esquerra: Foli Blanc DOCX */}
                <div className="flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-0"> {/* Reduït my-4 a my-0 */}
                    {isLoadingDocx && (<div className="text-center my-6"><p className="text-blue-600 animate-pulse">Processant DOCX...</p></div>)}
                    {/* Contingut DOCX */}
                    <div className="mt-1" ref={contentRef} onMouseUp={handleTextSelection} >
                        {isMounted && convertedHtml ? (
                            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: convertedHtml }} />
                        ) : (
                            !isLoadingDocx && !docxError && <p className="text-gray-400 italic text-center py-10">Comença seleccionant un fitxer DOCX al panell lateral.</p>
                        )}
                    </div>
                    {/* Missatges Mammoth */}
                    {mammothMessages && mammothMessages.length > 0 && ( <div className="mt-6 border-t pt-6">...</div> )}
                    {/* Debug: Vincles i Instruccions */}
                    {(links.length > 0 || aiInstructions.length > 0) && ( <div className="mt-6 border-t pt-4 space-y-4 text-xs">...</div> )}
                </div> {/* Fi Foli */}


                {/* === Columna Dreta: Sidebar (SEMPRE VISIBLE) === */}
                <aside className="w-80 flex-shrink-0 my-0 relative"> {/* Reduït my-4 a my-0 */}
                    <div className="sticky top-4 p-4 bg-white rounded shadow-lg border max-h-[calc(100vh-2rem)] overflow-y-auto flex flex-col">
                        {/* Capçalera Sidebar */}
                        <div className="flex justify-between items-center mb-3 pb-2 border-b flex-shrink-0">
                            <h3 className="text-md font-semibold text-blue-700">Configuració</h3>
                            {/* Eliminat botó de tancar sidebar */}
                        </div>

                        {/* Contingut principal del Sidebar */}
                        <div className="flex-grow overflow-y-auto space-y-4 pr-1 mb-4">

                            {/* === Pas 1: Carregar DOCX (si no hi ha HTML) === */}
                            {!convertedHtml && !isLoadingDocx && (
                                <div className="p-3 border border-dashed rounded">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Pas 1: Carregar Plantilla DOCX</p>
                                    <div className="flex flex-col items-start gap-2">
                                        <label htmlFor="docxInputSidebar" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer`}>
                                            Selecciona DOCX
                                        </label>
                                        <input type="file" id="docxInputSidebar" onChange={handleFileChange} accept=".docx" className="hidden" />
                                        {selectedFileName && (<span className="text-xs text-gray-500 italic">({selectedFileName})</span>)}
                                    </div>
                                     {docxError && (<p className="text-xs text-red-600 mt-2">{docxError}</p>)}
                                </div>
                            )}

                             {/* === Pas 2: Carregar Excel (si hi ha DOCX però no Excel) === */}
                             {convertedHtml && excelHeaders.length === 0 && (
                                 <div className="p-3 border border-dashed rounded">
                                    <p className="text-sm font-medium text-gray-700 mb-2">Pas 2: Carregar Excel (Opcional)</p>
                                    <div className="flex flex-col items-start gap-2">
                                        <label htmlFor="excelInputSidebar" className={`... ${isParsingExcel ? 'bg-gray-400':'bg-green-600 hover:bg-green-700'} ...`}> {isParsingExcel ? 'Processant...' : (selectedExcelFileName ? 'Canvia Fitxer' : 'Selecciona Excel')} </label>
                                        <input type="file" id="excelInputSidebar" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel} />
                                        {selectedExcelFileName && !isParsingExcel && (<span className="text-xs italic">({selectedExcelFileName})</span>)}
                                    </div>
                                    {isParsingExcel && (<div className="mt-2"><p className="text-green-600 animate-pulse text-xs">...</p></div>)}
                                    {excelError && (<p className="text-xs text-red-600 mt-2">{excelError}</p>)}
                                    {!selectedExcelFileName && !isParsingExcel && !excelError && (<p className="text-xs text-gray-400 mt-2 italic">...</p>)}
                                 </div>
                             )}

                            {/* === Pas 3: Vincular / IA (si hi ha DOCX i Excel) === */}
                            {convertedHtml && excelHeaders.length > 0 && (
                                <div className="space-y-4">
                                    {/* Secció Vincular Excel */}
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 mb-1">Vincular amb Excel</p>
                                        <p className="text-xs text-gray-600 mb-2">1. Clica capçalera:</p>
                                        {/* ... Llista Capçaleres ... */}
                                        <div className="flex flex-col gap-1 mb-2 max-h-40 overflow-y-auto pr-1 border rounded p-2 bg-gray-50"> {excelHeaders.map(h => { const c=linkCounts[h]||0; const iL=c>0; return ( <button key={h} onClick={()=>handleSelectHeader(h)} className={`... ${ selectedExcelHeader === h ? 'bg-blue-500 ...' : iL ? 'bg-green-50 ...' : 'bg-white ...' }`}> <span>{h}</span> {c > 0 && (<span className={`...`}>({c})</span>)} </button> ); })} </div>
                                        {selectedExcelHeader && (<p className="text-xs bg-blue-50 p-2 rounded border"> <strong className="block mb-1">2.</strong> Selecciona text al document per <strong className='text-red-600'>REEMPLAÇAR</strong> per: <span className="font-semibold italic">{selectedExcelHeader}</span> </p>)}
                                        {/* ... Canviar fitxer Excel ... */}
                                        <div className="mt-2 text-center text-xs"> <label htmlFor="excelInputSidebarChange" className="text-blue-600 hover:text-blue-800 underline cursor-pointer"> Canviar Excel ({selectedExcelFileName || 'cap'}) </label> <input type="file" id="excelInputSidebarChange" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel}/> </div>
                                    </div>

                                    {/* Secció Instruccions IA */}
                                    <div className="pt-3 border-t">
                                         <p className="text-sm font-medium text-gray-700 mb-1">Instruccions IA</p>
                                         <p className="text-xs text-gray-600 mb-2">Selecciona text al document (sense capçalera Excel activa) i escriu la instrucció:</p>
                                         {/* UI per afegir instrucció IA (visible si aiSelectedText té valor) */}
                                         {aiSelectedText && aiTemporaryMarkerId && (
                                             <div className='p-3 border rounded bg-indigo-50 space-y-3 border-indigo-200'>
                                                 <div>
                                                     <label className='block text-xs font-medium text-gray-600 mb-1'>Text Seleccionat:</label>
                                                     <p className="text-xs bg-white p-2 border rounded max-h-20 overflow-y-auto" title={aiSelectedText}>{aiSelectedText.substring(0, 100)}{aiSelectedText.length > 100 ? '...' : ''}</p>
                                                 </div>
                                                 <div>
                                                     <label htmlFor="aiPrompt" className='block text-xs font-medium text-gray-600 mb-1'>Instrucció per la IA:</label>
                                                     <textarea id="aiPrompt" rows={4} value={aiUserPrompt} onChange={(e) => setAiUserPrompt(e.target.value)} placeholder="Ex: Resumeix, Fes més formal..." className="w-full p-2 border rounded text-xs" />
                                                 </div>
                                                 <button
                                                     onClick={handleSaveAiInstruction}
                                                     disabled={!aiUserPrompt.trim()}
                                                     className={`w-full px-3 py-1.5 text-xs font-medium rounded shadow-sm text-white transition ... ${!aiUserPrompt.trim() ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                                                 >
                                                     Guardar Instrucció IA
                                                 </button>
                                             </div>
                                         )}
                                         {/* Missatge si no hi ha text seleccionat per IA */}
                                         {!aiSelectedText && (
                                             <p className="text-xs text-gray-400 italic p-2 text-center">Selecciona text al document per afegir una instrucció IA.</p>
                                         )}

                                          {/* Historial d'Instruccions IA Guardades */}
                                          {aiInstructions.length > 0 && (
                                                <div className="mt-4 pt-4 border-t">
                                                    <h4 className="text-sm font-medium text-indigo-700 mb-2">Instruccions IA Guardades:</h4>
                                                    <ul className="space-y-2 text-xs">
                                                        {aiInstructions.map(instr => (
                                                            <li key={instr.id} className="p-2 border rounded bg-indigo-50 text-gray-700" title={`Text Original: ${instr.originalText || 'N/A'}`}>
                                                                <span className="block font-medium text-indigo-800">ID: {instr.id.substring(0,12)}...</span>
                                                                <span className="block italic">"{instr.prompt}"</span>
                                                                {/* TODO: Afegir botó per editar/eliminar instrucció? */}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                          )}

                                    </div>
                                </div>
                            )}

                        </div> {/* Fi Contingut Scrollable Sidebar */}

                        {/* Botó Guardar Configuració Final */}
                        <div className="mt-auto pt-4 border-t flex-shrink-0 space-y-2">
                            <button
                                onClick={handleSaveConfiguration}
                                disabled={saveStatus === 'saving' || (!convertedHtml)} // Desactivat si no hi ha docx carregat
                                className={`w-full px-4 py-2 text-sm font-medium rounded shadow-sm transition ... ${saveStatus === 'saving' || !convertedHtml ? 'bg-gray-300 ... cursor-not-allowed' : 'bg-purple-600 ...'}`}
                            >
                                {saveStatus === 'saving' ? 'Guardant...' : 'Guardar Configuració'}
                            </button>
                            {saveMessage && ( <p className={`text-xs text-center ${saveStatus === 'error' ? 'text-red-600' : 'text-green-600'}`}> {saveMessage} </p> )}
                        </div>
                    </div>
                </aside>
                {/* Fi Sidebar */}

            </div> {/* Fi Contenidor Principal Flex */}

        </main>
    );
} // <<< Fi component Home