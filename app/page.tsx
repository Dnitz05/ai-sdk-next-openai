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
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null);
    const [links, setLinks] = useState<Link[]>([]);
    const [aiTargetParagraphId, setAiTargetParagraphId] = useState<string | null>(null);
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

    // useEffect per obrir el sidebar automàticament (sense canvis)
    useEffect(() => {
        if (prevIsLoadingDocx.current && !isLoadingDocx && isMounted && convertedHtml && !docxError) {
            // setIsLinkerSidebarOpen(true); // Ja no cal
            setAiTargetParagraphId(null); setAiUserPrompt(''); // Reseteja IA en carregar nou DOCX
            setSaveStatus('idle'); setSaveMessage(null);
        }
        prevIsLoadingDocx.current = isLoadingDocx;
    }, [isLoadingDocx, convertedHtml, docxError, isMounted]);

    // Càlcul recomptes vincles Excel
    const linkCounts = useMemo(() => {
        const counts: { [key: string]: number } = {}; for (const link of links) { counts[link.excelHeader] = (counts[link.excelHeader] || 0) + 1; } return counts;
    }, [links]);

    // --- Funcions DOCX ---
    const triggerUpload = async (file: File) => {
        setIsLoadingDocx(true); setDocxError(null); setConvertedHtml(null); setMammothMessages([]); setSelectedExcelFileName(null); setExcelData(null); setExcelError(null); setExcelHeaders([]); setSelectedExcelHeader(null); /*Sidebar obert*/ setLinks([]); setAiTargetParagraphId(null); setAiUserPrompt(''); setAiInstructions([]); setSaveStatus('idle'); setSaveMessage(null); const formData = new FormData(); formData.append('file', file); try { const r=await fetch('/api/process-document',{method:'POST',body:formData});const ct=r.headers.get("content-type");if(!r.ok){let e:any={error:`E: ${r.status}`};try{e=await r.json();}catch{}throw new Error(e.error||`E ${r.status}`);}if(ct?.includes("application/json")){const d=await r.json(); setConvertedHtml(d.html); setMammothMessages(d.messages||[]);}else{throw new Error("Format resposta inesperat.");}}catch(err){console.error("E DOCX:",err);setDocxError(err instanceof Error?err.message:'Error');setConvertedHtml(null);}finally{setIsLoadingDocx(false);}
    };
    const handleDocxFileChange = (event: ChangeEvent<HTMLInputElement>) => {
         if (event.target.files && event.target.files[0]) { const f=event.target.files[0]; const vT=f.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'||f.name.toLowerCase().endsWith('.docx'); if(vT){ setSelectedFileName(f.name); setDocxError(null); triggerUpload(f); } else { setDocxError('Selecciona .docx'); setConvertedHtml(null); setMammothMessages([]); setSelectedFileName(''); setSelectedExcelFileName(null); setExcelData(null); setExcelError(null); setExcelHeaders([]); setSelectedExcelHeader(null); setLinks([]); setAiTargetParagraphId(null); setAiUserPrompt(''); setAiInstructions([]); setSaveStatus('idle'); setSaveMessage(null); } } else { } if (event.target) event.target.value = '';
    };

    // --- Funcions EXCEL ---
    const handleExcelFileChange = (event: ChangeEvent<HTMLInputElement>) => {
         if (event.target.files && event.target.files[0]) { const f=event.target.files[0];setSelectedExcelFileName(f.name);setExcelError(null);setExcelData(null);setSelectedExcelHeader(null);setExcelHeaders([]);setAiTargetParagraphId(null);setAiUserPrompt('');/* NO reset aiInstructions */setSaveStatus('idle');setSaveMessage(null);const vMT=['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];const vT=vMT.includes(f.type)||f.name.toLowerCase().endsWith('.xlsx')||f.name.toLowerCase().endsWith('.xls');if(vT){setIsParsingExcel(true);const r=new FileReader();r.onload=(e)=>{try{const a=e.target?.result;if(a){const w=XLSX.read(a,{type:'buffer'});const sN=w.SheetNames[0];const wS=w.Sheets[sN];const jD=XLSX.utils.sheet_to_json(wS);if(jD.length>0){const fR=jD[0];if(fR&&typeof fR==='object'){setExcelHeaders(Object.keys(fR));}else{setExcelHeaders([]);setExcelError("Format fila Excel invàlid.");}}else{setExcelHeaders([]);setExcelError("Excel buit.");}setExcelData(jD);}else{throw new Error("Error llegint");}}catch(err){setExcelError(err instanceof Error?err.message:'Error');setExcelData(null);setExcelHeaders([]);}finally{setIsParsingExcel(false);}};r.onerror=(e)=>{setExcelError("Error llegint fitxer.");setIsParsingExcel(false);setExcelData(null);setExcelHeaders([]);};r.readAsArrayBuffer(f);}else{setExcelError('Selecciona .xlsx/.xls');setSelectedExcelFileName(null);setExcelData(null);setExcelHeaders([]);}}else{}if(event.target){event.target.value='';}
    };

    // --- Funcions per Vinculació Excel i Selecció IA ---
    const handleSelectHeader = (header: string) => {
        setAiTargetParagraphId(null); setAiUserPrompt(''); // Desactiva IA
        setSelectedExcelHeader(header); // Activa vincular Excel
    };

    const handleTextSelection = () => {
        if (!convertedHtml || isLoadingDocx || !selectedExcelHeader) return; // Només si hi ha capçalera activa
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
            const originalSelectedText = selection.toString(); if (!originalSelectedText.trim()) { selection.removeAllRanges(); return; } const range = selection.getRangeAt(0); const linkId = `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`; if (!contentRef.current.contains(range.commonAncestorContainer)) { selection.removeAllRanges(); setSelectedExcelHeader(null); return; } const span = document.createElement('span'); span.className = 'linked-placeholder'; span.dataset.excelHeader = selectedExcelHeader; span.dataset.linkId = linkId; span.textContent = selectedExcelHeader; try { range.deleteContents(); range.insertNode(span); const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); setLinks(prevLinks => [...prevLinks, { id: linkId, excelHeader: selectedExcelHeader!, selectedText: selectedExcelHeader! }]); } catch (error) { console.error("Error DOM (link):", error); alert("Error vinculant."); } finally { selection.removeAllRanges(); setSelectedExcelHeader(null); } // Neteja IA per si de cas
            setAiTargetParagraphId(null); setAiUserPrompt('');
        }
    };

    const handleContentClick = (event: MouseEvent<HTMLDivElement>) => {
        if (!convertedHtml || isLoadingDocx || selectedExcelHeader) return; // No fer res si estem vinculant Excel
        const target = event.target as HTMLElement;
        const targetParagraph = target.closest('p');
        if (targetParagraph) {
            let paragraphId = targetParagraph.dataset.paragraphId;
            let htmlNeedsUpdate = false;
            if (!paragraphId) {
                paragraphId = `p-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                targetParagraph.dataset.paragraphId = paragraphId;
                htmlNeedsUpdate = true;
            }
            if (htmlNeedsUpdate && contentRef.current) { setConvertedHtml(contentRef.current.innerHTML); }
            const existingInstruction = aiInstructions.find(instr => instr.id === paragraphId);
            setAiTargetParagraphId(paragraphId);
            setAiUserPrompt(existingInstruction?.prompt || '');
            console.log("Paràgraf seleccionat per IA:", paragraphId);
        } else { if (aiTargetParagraphId) { setAiTargetParagraphId(null); setAiUserPrompt(''); } }
    };

    // Funció per cancel·lar edició IA (si cliquem Cancel·lar al sidebar)
    const handleCancelAiInstruction = () => {
        setAiTargetParagraphId(null); setAiUserPrompt('');
    };

    // Funció per Guardar Instrucció IA
    const handleSaveAiInstruction = () => {
        if (!aiUserPrompt.trim() || !aiTargetParagraphId || !contentRef.current) { alert("Selecciona paràgraf i escriu instrucció."); return; } const targetParagraph = contentRef.current.querySelector<HTMLParagraphElement>(`p[data-paragraph-id="${aiTargetParagraphId}"]`); if (targetParagraph) { setAiInstructions(prev => { const index = prev.findIndex(i => i.id === aiTargetParagraphId); if (index > -1) { const updated = [...prev]; updated[index] = { id: aiTargetParagraphId, prompt: aiUserPrompt }; return updated; } else { return [...prev, { id: aiTargetParagraphId, prompt: aiUserPrompt }]; } }); targetParagraph.classList.add('ai-prompt-target'); const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); console.log(`Instrucció IA guardada per ${aiTargetParagraphId}: "${aiUserPrompt}"`); setAiTargetParagraphId(null); setAiUserPrompt(''); } else { console.error("No trobat paràgraf per guardar IA."); alert("Error guardant."); setAiTargetParagraphId(null); setAiUserPrompt(''); }
    };

    // Funció per al botó Guardar Configuració
    const handleSaveConfiguration = async () => {
        console.log("Intentant desar configuració..."); setSaveStatus('saving'); setSaveMessage(null); if (!contentRef.current) { setSaveMessage("Error: No HTML."); setSaveStatus('error'); return; } let finalHtml = contentRef.current.innerHTML; /* Neteja de temp spans ja no cal */ const configuration = { baseDocxName: selectedFileName, excelInfo: { fileName: selectedExcelFileName, headers: excelHeaders, }, linkMappings: links, aiInstructions: aiInstructions, finalHtml: finalHtml }; console.log("Configuració a desar:", configuration); try { await new Promise(resolve => setTimeout(resolve, 1000)); console.log("Guardat (simulat)."); setSaveMessage("Guardat amb èxit!"); setSaveStatus('success'); } catch (error) { console.error("Error desant:", error); setSaveMessage(`Error: ${error instanceof Error ? error.message : 'Error'}`); setSaveStatus('error'); }
    };


    // --- JSX ---
    return (
        <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">

            {/* Capçalera WEB */}
             <div className="web-header w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 px-1 gap-4"><h2 className="text-lg font-semibold text-gray-700">Configurador Plantilles DOCX</h2>{selectedFileName && (<span className="text-sm text-gray-500 italic hidden sm:block"> Editant: {selectedFileName} {selectedExcelFileName ? ` amb ${selectedExcelFileName}` : ''}</span>)}</div>


            {/* Capçalera/Peu Impressió */}
            <div id="print-header" className="hidden print:block ...">...</div>
            <div id="print-footer" className="hidden print:block ...">...</div>

            {/* Errors Globals */}
            {(docxError || excelError) && (<div className="web-errors ...">...</div>)}

            {/* Contenidor Principal */}
            <div className="flex w-full max-w-6xl gap-x-6 px-1">

                {/* Columna Esquerra: Foli Blanc DOCX */}
                {/* Afegim mx-auto per centrar si no hi ha sidebar, i ajustem padding/width */}
                <div className={`flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-0 ${!isMounted ? 'mx-auto max-w-2xl' : ''}`}> {/* Centrat inicialment */}
                    {isLoadingDocx && (<div className="text-center my-6">...</div>)}
                    {/* Contingut DOCX */}
                    <div className="mt-1" ref={contentRef} onClick={handleContentClick} onMouseUp={handleTextSelection} >
                        {isMounted && convertedHtml ? (
                             // === CANVI: Aplicar max-w aquí per limitar amplada text ===
                             <div className="prose max-w-3xl mx-auto" dangerouslySetInnerHTML={{ __html: convertedHtml }} />
                             // ============================================================
                         ) : ( !isLoadingDocx && !docxError && <p className="text-gray-400 italic text-center py-10">...</p> )}
                    </div>
                    {/* Missatges Mammoth */}
                    {mammothMessages && mammothMessages.length > 0 && ( <div className="mt-6 border-t pt-6 max-w-3xl mx-auto"> {/* Limitem amplada també */} {/* ... */} </div> )}
                    {/* Debug: Vincles i Instruccions */}
                    {(links.length > 0 || aiInstructions.length > 0) && ( <div className="mt-6 border-t pt-4 space-y-4 text-xs max-w-3xl mx-auto"> {/* Limitem amplada també */} {/* ... */} </div> )}

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
                                <div className={`p-3 border rounded ${convertedHtml ? 'border-green-300 bg-green-50' : 'border-dashed border-gray-300'}`}> <p className={`text-sm font-medium mb-2 ${convertedHtml ? 'text-green-700' : 'text-gray-700'}`}>Pas 1: Plantilla DOCX</p> <div className="flex flex-col items-start gap-2"> <label htmlFor="docxInputSidebar" className={`... ${isLoadingDocx ? 'bg-gray-400 ...' : 'bg-blue-600 hover:bg-blue-700 ...'}`}> {isLoadingDocx ? 'Processant...' : (selectedFileName ? 'Canvia DOCX' : 'Selecciona DOCX')} </label> <input type="file" id="docxInputSidebar" onChange={handleDocxFileChange} accept=".docx" className="hidden" disabled={isLoadingDocx}/> {selectedFileName && !isLoadingDocx && (<span className="text-xs italic">({selectedFileName})</span>)} </div> {docxError && (<p className="text-xs text-red-600 mt-2">{docxError}</p>)} </div>

                                {/* Pas 2: Carregar Excel */}
                                {convertedHtml && !isLoadingDocx && !docxError && ( <div className={`p-3 border rounded ${excelHeaders.length > 0 ? 'border-green-300 bg-green-50' : 'border-dashed border-gray-300'}`}> <p className={`text-sm font-medium mb-2 ${excelHeaders.length > 0 ? 'text-green-700' : 'text-gray-700'}`}>Pas 2: Dades Excel (Opcional)</p> <div className="flex flex-col items-start gap-2"> <label htmlFor="excelInputSidebar" className={`... ${isParsingExcel ? 'bg-gray-400 ...':'bg-green-600 ...'} ...`}> {isParsingExcel ? 'Processant...' : (selectedExcelFileName ? 'Canvia' : 'Selecciona')+' Excel'} </label> <input type="file" id="excelInputSidebar" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel} /> {selectedExcelFileName && !isParsingExcel && (<span className="text-xs italic">({selectedExcelFileName})</span>)} </div> {isParsingExcel && (<div className="mt-2"><p className="text-green-600 ...">...</p></div>)} {excelError && (<p className="text-xs text-red-600 mt-2">{excelError}</p>)} </div> )}

                                {/* Pas 3: Vincular Excel */}
                                {convertedHtml && excelHeaders.length > 0 && !isLoadingDocx && !isParsingExcel && !docxError && !excelError && ( <div className="p-3 border rounded border-gray-200"> <p className="text-sm font-medium ...">Vincular amb Excel</p> {/* ... (Llista Capçaleres) ... */} <div className="flex flex-col gap-1 mb-2 max-h-40 ..."> {excelHeaders.map(h => { const c=linkCounts[h]||0; const iL=c>0; return ( <button key={h} onClick={()=>handleSelectHeader(h)} className={`... ${ selectedExcelHeader === h ? 'bg-blue-500 ...' : iL ? 'bg-green-50 ...' : 'bg-white ...' }`}> <span>{h}</span> {c > 0 && (<span className={`...`}>({c})</span>)} </button> ); })} </div> {selectedExcelHeader && (<p className="text-xs bg-blue-50 p-2 ...">...</p>)} {!selectedExcelHeader && (<p className="text-xs text-gray-500 p-2">...</p>)} <div className="mt-2 text-center text-xs"> <label htmlFor="excelInputSidebarChange" className="..."> Canviar Excel ...</label> <input type="file" id="excelInputSidebarChange" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel}/> </div> </div> )}

                                {/* Pas 4: Instruccions IA */}
                                {convertedHtml && !isLoadingDocx && !docxError && ( <div className="p-3 border rounded border-gray-200"> <p className="text-sm font-medium ...">Instruccions IA</p> <p className="text-xs text-gray-600 mb-2">Clica un paràgraf al document per afegir/editar instrucció:</p> {/* UI per afegir/editar instrucció IA */} {aiTargetParagraphId && ( <div className='mt-2 pt-3 border-t border-indigo-200 space-y-3'> <p className='text-xs font-medium text-indigo-700'>Editant paràgraf ID: <code className='text-xs'>{aiTargetParagraphId.substring(2,8)}...</code></p> <div> <label htmlFor="aiPrompt" className='block text-xs ...'>Instrucció per la IA:</label> <textarea id="aiPrompt" rows={4} value={aiUserPrompt} onChange={(e) => setAiUserPrompt(e.target.value)} placeholder="Ex: Resumeix..." className="w-full p-2 border rounded text-xs" /> </div> <div className="flex gap-2"> <button onClick={handleSaveAiInstruction} disabled={!aiUserPrompt.trim() && !(aiInstructions.find(i => i.id === aiTargetParagraphId)?.prompt)} className={`flex-grow ... ${(!aiUserPrompt.trim() && !(aiInstructions.find(i => i.id === aiTargetParagraphId)?.prompt)) ? 'bg-gray-400 ...' : 'bg-indigo-600 hover:bg-indigo-700'}`} > {aiInstructions.find(i => i.id === aiTargetParagraphId)?.prompt ? 'Actualitzar' : 'Guardar'} </button> <button onClick={handleCancelAiInstruction} className='px-3 py-1.5 text-xs ...'>Cancel·lar</button> </div> </div> )} {/* Missatge si no hi ha paràgraf seleccionat */} {!aiTargetParagraphId && ( <p className="text-xs text-gray-400 italic p-2 text-center">Clica un paràgraf al document...</p> )} {/* Historial Instruccions */} {aiInstructions.length > 0 && ( <div className="mt-4 pt-4 border-t"> <h4 className="text-sm font-medium ...">Instruccions Guardades:</h4> <ul className="space-y-2 text-xs ..."> {aiInstructions.map((instr, index) => ( <li key={instr.id} className="p-2 border rounded ... hover:bg-indigo-100 cursor-pointer" onClick={() => {setAiTargetParagraphId(instr.id); setAiUserPrompt(instr.prompt)}}> <span className="block font-medium ...">Instrucció {index + 1}</span> <span className='block ...'>(Pàrr. ID: {instr.id.substring(2,8)}...)</span> <i className='block ...'>{instr.prompt}</i> </li> ))} </ul> </div> )} </div> )}

                            </div> {/* Fi Contingut Scrollable Sidebar */}

                            {/* Botó Guardar Configuració Final */}
                            <div className="mt-auto pt-4 border-t flex-shrink-0 space-y-2">
                                <button onClick={handleSaveConfiguration} disabled={saveStatus === 'saving' || (!convertedHtml)} className={`w-full ... ${saveStatus === 'saving' || !convertedHtml ? 'bg-gray-300 ...' : 'bg-purple-600 ...'}`} > {saveStatus === 'saving' ? 'Guardant...' : 'Guardar Configuració'} </button>
                                {saveMessage && ( <p className={`text-xs text-center ${saveStatus === 'error' ? 'text-red-600' : 'text-green-600'}`}> {saveMessage} </p> )}
                            </div>
                        </div>
                    </aside>
                 )} {/* Fi Sidebar */}

            </div> {/* Fi Contenidor Principal Flex */}

        </main>
    );
} // <<< Fi component Home