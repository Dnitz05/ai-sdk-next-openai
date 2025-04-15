// app/page.tsx
'use client';

import React, { useState, ChangeEvent, useEffect, useRef, MouseEvent, useMemo } from 'react';
import * as XLSX from 'xlsx';

// Interfícies
interface Link { id: string; excelHeader: string; selectedText: string; }
interface AiInstruction { id: string; prompt: string; originalText?: string; }


export default function Home() {
    // --- Estats ---
    const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
    const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
    const [isLoadingDocx, setIsLoadingDocx] = useState<boolean>(false);
    const [docxError, setDocxError] = useState<string | null>(null);
    const [mammothMessages, setMammothMessages] = useState<any[]>([]);
    const [selectedExcelFileName, setSelectedExcelFileName] = useState<string | null>(null);
    const [excelData, setExcelData] = useState<any[] | null>(null);
    const [isParsingExcel, setIsParsingExcel] = useState<boolean>(false);
    const [excelError, setExcelError] = useState<string | null>(null);
    // Sidebar sempre visible
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
    const prevIsLoadingDocx = useRef<boolean>(isLoadingDocx);

    // Estat per renderitzat client
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    // useEffect per obrir el sidebar automàticament (CORREGIT)
    useEffect(() => {
        if (prevIsLoadingDocx.current && !isLoadingDocx && isMounted && convertedHtml && !docxError) {
            //setIsLinkerSidebarOpen(true); // Ja no cal, sempre hi és
            setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt('');
            setSaveStatus('idle'); setSaveMessage(null);
        }
        prevIsLoadingDocx.current = isLoadingDocx;
    }, [isLoadingDocx, convertedHtml, docxError, isMounted]);

    // Càlcul dels recomptes de vincles Excel
    const linkCounts = useMemo(() => {
        const counts: { [key: string]: number } = {}; for (const link of links) { counts[link.excelHeader] = (counts[link.excelHeader] || 0) + 1; } return counts;
    }, [links]);

    // --- Funcions DOCX ---
    const triggerUpload = async (file: File) => {
        setIsLoadingDocx(true); setDocxError(null); setConvertedHtml(null); setMammothMessages([]); setSelectedExcelFileName(null); setExcelData(null); setExcelError(null); setExcelHeaders([]); setSelectedExcelHeader(null); /*No sidebar state*/ setLinks([]); setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt(''); setAiInstructions([]); setSaveStatus('idle'); setSaveMessage(null); const formData = new FormData(); formData.append('file', file); try { const r=await fetch('/api/process-document',{method:'POST',body:formData});const ct=r.headers.get("content-type");if(!r.ok){let e:any={error:`E: ${r.status}`};try{e=await r.json();}catch{}throw new Error(e.error||`E ${r.status}`);}if(ct?.includes("application/json")){const d=await r.json();setConvertedHtml(d.html);setMammothMessages(d.messages||[]);}else{throw new Error("Format resposta inesperat.");}}catch(err){console.error("E DOCX:",err);setDocxError(err instanceof Error?err.message:'Error');setConvertedHtml(null);}finally{setIsLoadingDocx(false);}
    };
    const handleDocxFileChange = (event: ChangeEvent<HTMLInputElement>) => {
         if (event.target.files && event.target.files[0]) { const f=event.target.files[0]; const vT=f.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'||f.name.toLowerCase().endsWith('.docx'); if(vT){ setSelectedFileName(f.name); setDocxError(null); triggerUpload(f); } else { setDocxError('Selecciona .docx'); setConvertedHtml(null); setMammothMessages([]); setSelectedFileName(''); setSelectedExcelFileName(null); setExcelData(null); setExcelError(null); setExcelHeaders([]); setSelectedExcelHeader(null); setLinks([]); setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt(''); setAiInstructions([]); setSaveStatus('idle'); setSaveMessage(null); } } else { } if (event.target) event.target.value = '';
    };

    // --- Funcions EXCEL ---
    const handleExcelFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) { const f=event.target.files[0];setSelectedExcelFileName(f.name);setExcelError(null);setExcelData(null);setSelectedExcelHeader(null);setExcelHeaders([]);setAiSelectedText(null);setAiTemporaryMarkerId(null);setAiUserPrompt('');/* NO reset aiInstructions */setSaveStatus('idle');setSaveMessage(null);const vMT=['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];const vT=vMT.includes(f.type)||f.name.toLowerCase().endsWith('.xlsx')||f.name.toLowerCase().endsWith('.xls');if(vT){setIsParsingExcel(true);const r=new FileReader();r.onload=(e)=>{try{const a=e.target?.result;if(a){const w=XLSX.read(a,{type:'buffer'});const sN=w.SheetNames[0];const wS=w.Sheets[sN];const jD=XLSX.utils.sheet_to_json(wS);if(jD.length>0){const fR=jD[0];if(fR&&typeof fR==='object'){setExcelHeaders(Object.keys(fR));}else{setExcelHeaders([]);setExcelError("Format fila Excel invàlid.");}}else{setExcelHeaders([]);setExcelError("Excel buit.");}setExcelData(jD);}else{throw new Error("Error llegint");}}catch(err){setExcelError(err instanceof Error?err.message:'Error');setExcelData(null);setExcelHeaders([]);}finally{setIsParsingExcel(false);}};r.onerror=(e)=>{setExcelError("Error llegint fitxer.");setIsParsingExcel(false);setExcelData(null);setExcelHeaders([]);};r.readAsArrayBuffer(f);}else{setExcelError('Selecciona .xlsx/.xls');setSelectedExcelFileName(null);setExcelData(null);setExcelHeaders([]);}}else{}if(event.target){event.target.value='';}
    };

    // --- Funcions per Vinculació Excel i Selecció IA ---
    // Funció auxiliar per desembolcallar un span temporal IA
    const unwrapTemporaryAiSpan = (tempId: string | null): boolean => {
        if (tempId && contentRef.current) { const tempSpan = contentRef.current.querySelector<HTMLElement>(`span[data-ai-temp-id="${tempId}"]`); if (tempSpan) { try { const childNodesArray = Array.from(tempSpan.childNodes); tempSpan.replaceWith(...childNodesArray); return true; } catch (error) { console.error("Error desembolcallant span temporal:", error); } } } return false;
    };

    const handleSelectHeader = (header: string) => {
        const htmlChanged = unwrapTemporaryAiSpan(aiTemporaryMarkerId);
        if (htmlChanged && contentRef.current) { setConvertedHtml(contentRef.current.innerHTML); }
        setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt('');
        setSelectedExcelHeader(header);
    };

    const handleTextSelection = () => {
        if (!convertedHtml || isLoadingDocx) return; // Check if sidebar is active implicitly
        const selection = window.getSelection();

        // Cas 1: Vincular Excel
        if (selectedExcelHeader && selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
            const originalSelectedText = selection.toString(); if (!originalSelectedText.trim()) { selection.removeAllRanges(); return; } const range = selection.getRangeAt(0); const linkId = `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`; if (!contentRef.current.contains(range.commonAncestorContainer)) { console.warn("Ignorant selecció (link): Fora de l'àrea."); selection.removeAllRanges(); setSelectedExcelHeader(null); return; } const span = document.createElement('span'); span.className = 'linked-placeholder'; span.dataset.excelHeader = selectedExcelHeader; span.dataset.linkId = linkId; span.textContent = selectedExcelHeader; try { range.deleteContents(); range.insertNode(span); const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); setLinks(prevLinks => [...prevLinks, { id: linkId, excelHeader: selectedExcelHeader!, selectedText: selectedExcelHeader! }]); } catch (error) { console.error("Error DOM (link):", error); alert("Error vinculant."); } finally { selection.removeAllRanges(); setSelectedExcelHeader(null); }
             const changed = unwrapTemporaryAiSpan(aiTemporaryMarkerId); if(changed && contentRef.current) setConvertedHtml(contentRef.current.innerHTML); setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt('');
        }
        // Cas 2: Preparar per Instrucció IA
        else if (!selectedExcelHeader && selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
            const currentSelectedText = selection.toString();
            if (!currentSelectedText.trim()) { selection.removeAllRanges(); return; }
            const range = selection.getRangeAt(0);
            if (!contentRef.current.contains(range.commonAncestorContainer)) { console.warn("Ignorant selecció (IA): Fora de l'àrea."); selection.removeAllRanges(); return; }

            const changedHtml = unwrapTemporaryAiSpan(aiTemporaryMarkerId); // Neteja anterior
            if(changedHtml && contentRef.current) setConvertedHtml(contentRef.current.innerHTML); // Actualitza si netejat

            const tempId = `temp-ai-${Date.now()}`;
            const tempSpan = document.createElement('span');
            tempSpan.dataset.aiTempId = tempId;
            try {
                const fragment = range.extractContents();
                tempSpan.appendChild(fragment);
                range.insertNode(tempSpan);
                const updatedHtmlWithTempSpan = contentRef.current.innerHTML;
                setConvertedHtml(updatedHtmlWithTempSpan); // Actualitza HTML amb marcador temporal

                setAiSelectedText(currentSelectedText);
                setAiTemporaryMarkerId(tempId);
                setAiUserPrompt('');

            } catch (error) {
                console.error("Error embolcallant text per IA:", error);
                // === LÍNIA PROBLEMÀTICA ELIMINADA ===
                // if(changedHtml && baseHtml) setConvertedHtml(baseHtml); // <<-- Aquesta línia ja no hi és
                setAiSelectedText(null); setAiTemporaryMarkerId(null);
            } finally { selection.removeAllRanges(); }
        }
    };

    // Funció per tancar/resetejar el sidebar (si tingués botó)
    const handleResetSidebar = () => {
         const changed = unwrapTemporaryAiSpan(aiTemporaryMarkerId);
         if(changed && contentRef.current) setConvertedHtml(contentRef.current.innerHTML);
        setSelectedExcelHeader(null);
        setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt('');
        setSaveStatus('idle'); setSaveMessage(null);
    };

    // Funció per Guardar Instrucció IA
    const handleSaveAiInstruction = () => {
        if (!aiUserPrompt.trim() || !aiTemporaryMarkerId || !contentRef.current) { alert("Escriu instrucció."); return; } const tempSpan = contentRef.current.querySelector<HTMLElement>(`span[data-ai-temp-id="${aiTemporaryMarkerId}"]`); if (tempSpan) { const instructionId = `ai-instr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`; const originalText = aiSelectedText; tempSpan.removeAttribute('data-ai-temp-id'); tempSpan.setAttribute('data-ai-instruction-id', instructionId); tempSpan.className = 'ai-prompt-target'; const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); setAiInstructions(prev => [...prev, { id: instructionId, prompt: aiUserPrompt, originalText: originalText || undefined }]); console.log("Instrucció IA guardada:", { id: instructionId, prompt: aiUserPrompt }); setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt(''); } else { console.error("No marcador temporal IA."); alert("Error guardant instrucció."); setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt(''); }
    };

    // Funció per al botó Guardar Configuració
    const handleSaveConfiguration = async () => {
        console.log("Intentant desar configuració..."); setSaveStatus('saving'); setSaveMessage(null); if (!contentRef.current) { setSaveMessage("Error: No HTML."); setSaveStatus('error'); return; } let finalHtml = contentRef.current.innerHTML; const changed = unwrapTemporaryAiSpan(aiTemporaryMarkerId); if(changed){ console.warn("S'ha eliminat marcador temporal IA sense desar abans de guardar."); finalHtml = contentRef.current.innerHTML; setConvertedHtml(finalHtml); setAiSelectedText(null); setAiTemporaryMarkerId(null); } const configuration = { baseDocxName: selectedFileName, excelInfo: { fileName: selectedExcelFileName, headers: excelHeaders, }, linkMappings: links, aiInstructions: aiInstructions, finalHtml: finalHtml }; console.log("Configuració a desar:", configuration); try { await new Promise(resolve => setTimeout(resolve, 1000)); console.log("Configuració guardada (simulat)."); setSaveMessage("Configuració guardada amb èxit!"); setSaveStatus('success'); } catch (error) { console.error("Error desant:", error); setSaveMessage(`Error: ${error instanceof Error ? error.message : 'Error desconegut'}`); setSaveStatus('error'); }
    };


    // --- JSX ---
    return (
        <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">

            {/* Capçalera WEB */}
             <div className="web-header w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 px-1 gap-4"><h2 className="text-lg font-semibold text-gray-700">Configurador Plantilles DOCX</h2>{selectedFileName && (<span className="text-sm text-gray-500 italic hidden sm:block"> Editant: {selectedFileName} {selectedExcelFileName ? ` amb ${selectedExcelFileName}` : ''}</span>)}</div>


            {/* Capçalera/Peu Impressió */}
            <div id="print-header" className="hidden print:block w-full max-w-4xl mx-auto mb-4 text-center text-xs text-gray-500">Configuració Plantilla - {new Date().toLocaleDateString()}</div>
            <div id="print-footer" className="hidden print:block w-full max-w-4xl mx-auto mt-8 text-center text-xs text-gray-500"></div>

            {/* Errors Globals */}
            {(docxError || excelError) && (<div className="web-errors w-full max-w-6xl mx-auto text-sm text-red-600 text-center mb-2 -mt-2 px-1">{docxError && <p>Error DOCX: {docxError}</p>}{excelError && <p>Error Excel: {excelError}</p>}</div>)}

            {/* Contenidor Principal */}
            <div className="flex w-full max-w-6xl gap-x-6 px-1">

                {/* Columna Esquerra: Foli Blanc DOCX */}
                <div className="flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-0">
                    {/* ... (Contingut DOCX, Missatges, Debug Vincles/Instruccions sense canvis) ... */}
                    {isLoadingDocx && (<div className="text-center my-6"><p className="text-blue-600 animate-pulse">Processant DOCX...</p></div>)}
                    <div className="mt-1" ref={contentRef} onMouseUp={handleTextSelection} > {isMounted && convertedHtml ? ( <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: convertedHtml }} /> ) : ( !isLoadingDocx && !docxError && <p className="text-gray-400 italic text-center py-10">Comença seleccionant un fitxer DOCX al panell lateral.</p> )} </div>
                    {mammothMessages && mammothMessages.length > 0 && ( <div className="mt-6 border-t pt-6"> <h3 className="text-lg font-semibold text-orange-600 mb-2">Missatges Conversió:</h3> <ul className="list-disc list-inside text-sm text-orange-700 bg-orange-50 p-4 rounded-md"> {mammothMessages.map((msg, index) => (<li key={index}><strong>{msg.type}:</strong> {msg.message}</li>))} </ul> </div> )}
                    {(links.length > 0 || aiInstructions.length > 0) && ( <div className="mt-6 border-t border-gray-200 pt-4 space-y-4 text-xs"> {links.length > 0 && <div> <h3 className="text-sm font-semibold text-purple-600 mb-1">Placeholders Excel:</h3> <ul className="list-disc list-inside text-gray-600"> {links.map(l => (<li key={l.id} className='mb-1'><code>{l.selectedText}</code> <span className='text-gray-500'>=&gt;</span> <strong>{l.excelHeader}</strong></li>))} </ul> </div>} {aiInstructions.length > 0 && <div> <h3 className="text-sm font-semibold text-indigo-600 mb-1">Instruccions IA Guardades:</h3> <ul className="list-decimal list-inside text-gray-600 space-y-1"> {aiInstructions.map((instr, index) => (<li key={instr.id} className='mb-1 border-b border-indigo-100 pb-1' title={`Text Original Marcado: ${instr.originalText || 'N/A'}`}> <span className="font-medium text-indigo-800">Instrucció {index + 1}</span> <i className='block bg-indigo-50 px-1 rounded text-xs'>{instr.prompt}</i> </li>))} </ul> </div>} </div> )}

                </div> {/* Fi Foli */}


                {/* Columna Dreta: Sidebar */}
                {isMounted && (
                    <aside className="w-80 flex-shrink-0 my-0 relative">
                        <div className="sticky top-4 p-4 bg-white rounded shadow-lg border max-h-[calc(100vh-2rem)] overflow-y-auto flex flex-col">
                            {/* Capçalera Sidebar */}
                             <div className="flex justify-between items-center mb-3 pb-2 border-b flex-shrink-0"> <h3 className="text-md font-semibold text-blue-700">Configuració</h3> </div>

                            {/* Contingut Sidebar */}
                            <div className="flex-grow overflow-y-auto space-y-4 pr-1 mb-4">

                                {/* Pas 1: Carregar DOCX */}
                                {!convertedHtml && !isLoadingDocx && ( /* ... (Input DOCX) ... */ <div className="p-3 border border-dashed rounded"><p className="text-sm font-medium ...">Pas 1: Carregar DOCX</p><div className="flex flex-col ..."> <label htmlFor="docxInputSidebar" className={`... bg-blue-600 ...`}> Selecciona DOCX </label> <input type="file" id="docxInputSidebar" onChange={handleDocxFileChange} accept=".docx" className="hidden" /> {selectedFileName && (<span className="text-xs italic">({selectedFileName})</span>)} </div> {docxError && (<p className="text-xs text-red-600 mt-2">{docxError}</p>)} </div> )}

                                {/* Pas 2: Carregar Excel */}
                                {convertedHtml && excelHeaders.length === 0 && ( /* ... (Input Excel) ... */ <div className="p-3 border border-dashed rounded"> <p className="text-sm font-medium ...">Pas 2: Carregar Excel (Opcional)</p> <div className="flex flex-col ..."> <label htmlFor="excelInputSidebar" className={`... ${isParsingExcel ? 'bg-gray-400':'bg-green-600 ...'} ...`}> {isParsingExcel ? 'Processant...' : (selectedExcelFileName ? 'Canvia' : 'Selecciona')+' Excel'} </label> <input type="file" id="excelInputSidebar" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel} /> {selectedExcelFileName && !isParsingExcel && (<span className="text-xs italic">({selectedExcelFileName})</span>)} </div> {isParsingExcel && (<div className="mt-2"><p className="text-green-600 ...">...</p></div>)} {excelError && (<p className="text-xs text-red-600 mt-2">{excelError}</p>)} </div> )}

                                {/* Pas 3: Vincular Excel */}
                                {convertedHtml && excelHeaders.length > 0 && ( <div className="p-3 border rounded border-gray-200"> <p className="text-sm font-medium ...">Vincular amb Excel</p> {/* ... (Llista Capçaleres, etc.) ... */} <p className="text-xs ...">1. Clica capçalera:</p> <div className="flex flex-col gap-1 mb-2 max-h-40 ..."> {excelHeaders.map(h => { const c=linkCounts[h]||0; const iL=c>0; return ( <button key={h} onClick={()=>handleSelectHeader(h)} className={`... ${ selectedExcelHeader === h ? 'bg-blue-500 ...' : iL ? 'bg-green-50 ...' : 'bg-white ...' }`}> <span>{h}</span> {c > 0 && (<span className={`...`}>({c})</span>)} </button> ); })} </div> {selectedExcelHeader && (<p className="text-xs bg-blue-50 p-2 ...">...</p>)} {!selectedExcelHeader && (<p className="text-xs text-gray-500 p-2">...</p>)} <div className="mt-2 text-center text-xs"> <label htmlFor="excelInputSidebarChange" className="..."> Canviar Excel ...</label> <input type="file" id="excelInputSidebarChange" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel}/> </div> </div> )}

                                {/* Pas 4: Instruccions IA */}
                                {convertedHtml && ( <div className="p-3 border rounded border-gray-200"> <p className="text-sm font-medium ...">Instruccions IA</p> {/* UI per afegir instrucció IA */} {aiSelectedText && aiTemporaryMarkerId && ( <div className='mt-2 pt-3 border-t border-indigo-200 space-y-3'> {/* ... (UI IA: text, prompt, botó guardar) ... */} <div><label className='block text-xs ...'>Al text seleccionat:</label> <p className="text-xs bg-white p-2 border rounded max-h-20 ..." title={aiSelectedText}>{aiSelectedText.substring(0, 100)}{aiSelectedText.length > 100 ? '...' : ''}</p></div> <div> <label htmlFor="aiPrompt" className='block text-xs ...'>Instrucció per la IA:</label> <textarea id="aiPrompt" rows={4} value={aiUserPrompt} onChange={(e) => setAiUserPrompt(e.target.value)} placeholder="Ex: Resumeix..." className="w-full p-2 border rounded text-xs" /> </div> <button onClick={handleSaveAiInstruction} disabled={!aiUserPrompt.trim()} className={`w-full ... ${!aiUserPrompt.trim() ? 'bg-gray-400 ...' : 'bg-indigo-600 hover:bg-indigo-700'}`} > Guardar Instrucció IA </button> </div> )} {/* Missatge si no hi ha text seleccionat per IA */} {!aiSelectedText && ( <p className="text-xs text-gray-400 italic p-2 text-center">Selecciona text al document per afegir una instrucció IA.</p> )} {/* Historial Instruccions IA Guardades */} {aiInstructions.length > 0 && ( <div className="mt-4 pt-4 border-t"> <h4 className="text-sm font-medium ...">Instruccions Guardades:</h4> <ul className="space-y-2 text-xs ..."> {aiInstructions.map((instr, index) => ( <li key={instr.id} className="p-2 border rounded ..."> <span className="block font-medium ...">Instrucció {index + 1}</span> <i className='block ...'>{instr.prompt}</i> <span className='block ...'>(ID: {instr.id.substring(9,14)}...)</span> </li> ))} </ul> </div> )} </div> )}

                            </div> {/* Fi Contingut Scrollable Sidebar */}

                            {/* Botó Guardar Configuració Final */}
                            <div className="mt-auto pt-4 border-t flex-shrink-0 space-y-2">
                                {/* ... (botó i missatge sense canvis) ... */}
                                 <button onClick={handleSaveConfiguration} disabled={saveStatus === 'saving' || (!convertedHtml)} className={`w-full px-4 py-2 text-sm font-medium rounded shadow-sm transition ... ${saveStatus === 'saving' || !convertedHtml ? 'bg-gray-300 ... cursor-not-allowed' : 'bg-purple-600 ...'}`} > {saveStatus === 'saving' ? 'Guardant...' : 'Guardar Configuració'} </button> {saveMessage && ( <p className={`text-xs text-center ${saveStatus === 'error' ? 'text-red-600' : 'text-green-600'}`}> {saveMessage} </p> )}
                            </div>
                        </div>
                    </aside>
                 )} {/* Fi Sidebar */}

            </div> {/* Fi Contenidor Principal Flex */}

        </main>
    );
} // <<< Fi component Home