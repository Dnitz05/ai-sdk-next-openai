// app/page.tsx
'use client';

import React, { useState, ChangeEvent, useEffect, useRef, MouseEvent, useMemo } from 'react';
import * as XLSX from 'xlsx';

// Interfícies
interface Link { id: string; excelHeader: string; selectedText: string; }
interface AiInstruction { id: string; prompt: string; } // ID és el data-paragraph-id del <p>

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
    const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null); // Per vincular Excel
    const [links, setLinks] = useState<Link[]>([]); // Vincles Excel
    // Estats IA enfocats a paràgrafs
    const [aiTargetParagraphId, setAiTargetParagraphId] = useState<string | null>(null); // ID del <p> seleccionat
    const [aiUserPrompt, setAiUserPrompt] = useState<string>(''); // Prompt de l'usuari per al paràgraf
    const [aiInstructions, setAiInstructions] = useState<AiInstruction[]>([]); // Llista d'instruccions IA guardades
    // Estats Guardar
    type SaveStatus = 'idle' | 'saving' | 'success' | 'error';
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    // --- Refs ---
    const contentRef = useRef<HTMLDivElement>(null);

    // Estat per renderitzat client
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    // Càlcul dels recomptes de vincles Excel
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
        setAiTargetParagraphId(null); setAiUserPrompt(''); // Desactiva mode IA
        setSelectedExcelHeader(header); // Activa vincular Excel
    };

    const handleTextSelection = () => {
        if (!convertedHtml || isLoadingDocx || !selectedExcelHeader) return;
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
            const originalSelectedText = selection.toString(); if (!originalSelectedText.trim()) { selection.removeAllRanges(); return; } const range = selection.getRangeAt(0); const linkId = `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`; if (!contentRef.current.contains(range.commonAncestorContainer)) { console.warn("Ignorant selecció (link): Fora de l'àrea."); selection.removeAllRanges(); setSelectedExcelHeader(null); return; } const span = document.createElement('span'); span.className = 'linked-placeholder'; span.dataset.excelHeader = selectedExcelHeader; span.dataset.linkId = linkId; span.textContent = selectedExcelHeader; try { range.deleteContents(); range.insertNode(span); const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); setLinks(prevLinks => [...prevLinks, { id: linkId, excelHeader: selectedExcelHeader!, selectedText: selectedExcelHeader! }]); } catch (error) { console.error("Error DOM (link):", error); alert("Error vinculant."); } finally { selection.removeAllRanges(); setSelectedExcelHeader(null); }
             setAiTargetParagraphId(null); setAiUserPrompt(''); // Neteja target IA
        }
    };

    const handleContentClick = (event: MouseEvent<HTMLDivElement>) => {
        if (!convertedHtml || isLoadingDocx || selectedExcelHeader) return;
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

    const handleCancelAiInstruction = () => {
        setAiTargetParagraphId(null); setAiUserPrompt('');
    };

    const handleSaveAiInstruction = () => {
        if (!aiUserPrompt.trim() || !aiTargetParagraphId || !contentRef.current) { alert("Selecciona paràgraf i escriu instrucció."); return; } const targetParagraph = contentRef.current.querySelector<HTMLParagraphElement>(`p[data-paragraph-id="${aiTargetParagraphId}"]`); if (targetParagraph) { setAiInstructions(prev => { const index = prev.findIndex(i => i.id === aiTargetParagraphId); if (index > -1) { const updated = [...prev]; updated[index] = { id: aiTargetParagraphId, prompt: aiUserPrompt }; return updated; } else { return [...prev, { id: aiTargetParagraphId, prompt: aiUserPrompt }]; } }); targetParagraph.classList.add('ai-prompt-target'); const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); console.log(`Instrucció IA guardada per ${aiTargetParagraphId}: "${aiUserPrompt}"`); setAiTargetParagraphId(null); setAiUserPrompt(''); } else { console.error("No trobat paràgraf per guardar IA."); alert("Error guardant."); setAiTargetParagraphId(null); setAiUserPrompt(''); }
    };

    // --- Funció per al botó Guardar Configuració (AMB FETCH) ---
    const handleSaveConfiguration = async () => {
        console.log("Intentant desar configuració (amb fetch)...");
        setSaveStatus('saving'); setSaveMessage(null);
        if (!contentRef.current) { setSaveMessage("Error Crític: No es pot accedir al contingut HTML final."); setSaveStatus('error'); return; }

        // Assegura neteja de marcadors temporals (encara que no haurien d'existir en aquest model)
        let finalHtml = contentRef.current.innerHTML;

        const configuration = {
            baseDocxName: selectedFileName,
            excelInfo: { fileName: selectedExcelFileName, headers: excelHeaders, },
            linkMappings: links,
            aiInstructions: aiInstructions,
            finalHtml: finalHtml // HTML amb IDs i classes
        };
        console.log("Configuració a enviar al backend:", configuration);

        try {
            // === TRUCADA FETCH REAL ===
            const response = await fetch('/api/save-configuration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(configuration),
            });
            // =========================

            // === GESTIÓ RESPOSTA ===
            if (response.ok) { // Status 2xx (esperem 201)
                const result = await response.json();
                console.log("Configuració guardada amb èxit (resposta API):", result);
                setSaveMessage(result.message || "Configuració guardada amb èxit!");
                setSaveStatus('success');
                // TODO: Potser fer alguna cosa amb result.configId?
            } else {
                // Error 4xx o 5xx
                let errorMsg = `Error ${response.status} del servidor.`;
                try {
                     const errorResult = await response.json();
                     errorMsg = errorResult.error || errorResult.details || errorMsg;
                } catch (e) { /* Ignora error de parseig JSON d'error */ }
                console.error("Error desant configuració (resposta API):", errorMsg);
                setSaveMessage(errorMsg);
                setSaveStatus('error');
            }
            // =======================

        } catch (error) {
            // Error de xarxa, DNS, etc.
            console.error("Error de xarxa o fetch desant configuració:", error);
            setSaveMessage(`Error de connexió: ${error instanceof Error ? error.message : 'Error desconegut'}`);
            setSaveStatus('error');
        }
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
                 <div className={`flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-0 ${!isMounted ? 'mx-auto max-w-3xl' : ''}`}>
                    {isLoadingDocx && (<div className="text-center my-6">...</div>)}
                    {/* Contingut DOCX */}
                    <div className="mt-1" ref={contentRef} onClick={handleContentClick} onMouseUp={handleTextSelection} >
                        {isMounted && convertedHtml ? (
                             <div className="prose max-w-5xl mx-auto" dangerouslySetInnerHTML={{ __html: convertedHtml }} />
                         ) : ( !isLoadingDocx && !docxError && <p className="text-gray-400 italic text-center py-10">...</p> )}
                    </div>
                    {/* Missatges Mammoth */}
                    {mammothMessages && mammothMessages.length > 0 && ( <div className="mt-6 border-t pt-6 max-w-5xl mx-auto"> ... </div> )}
                    {/* Debug: Vincles i Instruccions */}
                    {(links.length > 0 || aiInstructions.length > 0) && ( <div className="mt-6 border-t border-gray-200 pt-4 space-y-4 text-xs max-w-5xl mx-auto"> ... </div> )}
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
                                {!convertedHtml && !isLoadingDocx && ( /* ... (Input DOCX) ... */ )}

                                {/* Pas 2: Carregar Excel */}
                                {convertedHtml && excelHeaders.length === 0 && ( /* ... (Input Excel) ... */ )}

                                {/* Pas 3: Vincular Excel */}
                                {convertedHtml && excelHeaders.length > 0 && !isLoadingDocx && !isParsingExcel && !docxError && !excelError && ( /* ... (Llista Headers + Instruccions) ... */ )}

                                {/* Pas 4: Instruccions IA */}
                                {convertedHtml && ( <div className="p-3 border rounded border-gray-200"> <p className="text-sm font-medium ...">Instruccions IA</p> <p className="text-xs text-gray-600 mb-2">Clica un paràgraf...</p> {/* UI Edició IA */} {aiTargetParagraphId && ( <div className='mt-2 pt-3 border-t ...'> <p className='text-xs font-medium ...'>Editant paràgraf ID: <code className='text-xs'>{aiTargetParagraphId.substring(2,8)}...</code></p> <div> <label htmlFor="aiPrompt" className='block text-xs ...'>Instrucció:</label> <textarea id="aiPrompt" rows={4} value={aiUserPrompt} onChange={(e) => setAiUserPrompt(e.target.value)} placeholder="Ex: Resumeix..." className="w-full ..." /> </div> <div className="flex gap-2"> <button onClick={handleSaveAiInstruction} disabled={!aiUserPrompt.trim() && !(aiInstructions.find(i => i.id === aiTargetParagraphId)?.prompt)} className={`flex-grow ... ${(!aiUserPrompt.trim() && !(aiInstructions.find(i => i.id === aiTargetParagraphId)?.prompt)) ? 'bg-gray-400 ...' : 'bg-indigo-600 ...'}`} > {aiInstructions.find(i => i.id === aiTargetParagraphId)?.prompt ? 'Actualitzar' : 'Guardar'} </button> <button onClick={handleCancelAiInstruction} className='px-3 py-1.5 text-xs ...'>Cancel·lar</button> </div> </div> )} {/* Missatge si no hi ha paràgraf */} {!aiTargetParagraphId && ( <p className="text-xs text-gray-400 italic p-2 text-center">Clica un paràgraf...</p> )} {/* Historial */} {aiInstructions.length > 0 && ( <div className="mt-4 pt-4 border-t"> <h4 className="text-sm font-medium ...">Instruccions Guardades:</h4> <ul className="space-y-2 text-xs ..."> {aiInstructions.map((instr, index) => ( <li key={instr.id} className="p-2 border rounded ... hover:bg-indigo-100 cursor-pointer" onClick={() => {setAiTargetParagraphId(instr.id); setAiUserPrompt(instr.prompt)}}> <span className="block font-medium ...">Inst. {index + 1}</span> <span className='block ...'>(Pàrr. ID: {instr.id.substring(2,8)}...)</span> <i className='block ...'>{instr.prompt}</i> </li> ))} </ul> </div> )} </div> )}

                            </div> {/* Fi Contingut Scrollable Sidebar */}

                            {/* Botó Guardar Configuració Final */}
                            <div className="mt-auto pt-4 border-t flex-shrink-0 space-y-2">
                                 <button onClick={handleSaveConfiguration} disabled={saveStatus === 'saving' || (!convertedHtml)} className={`w-full ... ${saveStatus === 'saving' || !convertedHtml ? 'bg-gray-300 ...' : 'bg-purple-600 ...'}`} > {saveStatus === 'saving' ? 'Guardant...' : 'Guardar Configuració'} </button> {saveMessage && ( <p className={`text-xs text-center ${saveStatus === 'error' ? 'text-red-600' : 'text-green-600'}`}> {saveMessage} </p> )}
                            </div>
                        </div>
                    </aside>
                 )} {/* Fi Sidebar */}

            </div> {/* Fi Contenidor Principal Flex */}

        </main>
    );
} // <<< Fi component Home