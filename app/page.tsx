// app/page.tsx
'use client';

import React, { useState, ChangeEvent, useEffect, useRef, MouseEvent, useMemo } from 'react';
import * as XLSX from 'xlsx';

// Interfícies
interface Link { id: string; excelHeader: string; selectedText: string; } // Per vincles Excel
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

    // S'activa quan es clica una capçalera al sidebar
    const handleSelectHeader = (header: string) => {
        setAiTargetParagraphId(null); // Desactiva mode IA si estava actiu
        setAiUserPrompt('');
        setSelectedExcelHeader(header); // Activa per vincular Excel
    };

    // S'activa en deixar anar el ratolí sobre el contingut DOCX -> Només per vincular Excel
    const handleTextSelection = () => {
        // Només actuar si estem en mode vincular Excel
        if (!selectedExcelHeader) return;

        const selection = window.getSelection();
        if (selectedExcelHeader && selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
            const originalSelectedText = selection.toString(); if (!originalSelectedText.trim()) { selection.removeAllRanges(); return; } const range = selection.getRangeAt(0); const linkId = `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`; if (!contentRef.current.contains(range.commonAncestorContainer)) { console.warn("Ignorant selecció (link): Fora de l'àrea."); selection.removeAllRanges(); setSelectedExcelHeader(null); return; } const span = document.createElement('span'); span.className = 'linked-placeholder'; span.dataset.excelHeader = selectedExcelHeader; span.dataset.linkId = linkId; span.textContent = selectedExcelHeader; try { range.deleteContents(); range.insertNode(span); const updatedHtml = contentRef.current.innerHTML; setConvertedHtml(updatedHtml); setLinks(prevLinks => [...prevLinks, { id: linkId, excelHeader: selectedExcelHeader!, selectedText: selectedExcelHeader! }]); } catch (error) { console.error("Error DOM (link):", error); alert("Error vinculant."); } finally { selection.removeAllRanges(); setSelectedExcelHeader(null); }
            // Neteja target IA per si de cas
             setAiTargetParagraphId(null); setAiUserPrompt('');
        }
    };

    // S'activa en fer clic dins del contingut DOCX -> Per seleccionar paràgraf per IA
    const handleContentClick = (event: MouseEvent<HTMLDivElement>) => {
        // No actuar si no hi ha contingut o si estem activament vinculant Excel
        if (!convertedHtml || !contentRef.current || selectedExcelHeader) return;

        const target = event.target as HTMLElement;
        const targetParagraph = target.closest('p'); // Busquem el paràgraf clicat

        if (targetParagraph) {
            let paragraphId = targetParagraph.dataset.paragraphId;
            let htmlNeedsUpdate = false;

            // Assigna ID si no en té
            if (!paragraphId) {
                paragraphId = `p-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                targetParagraph.dataset.paragraphId = paragraphId;
                htmlNeedsUpdate = true;
            }

            // Actualitzem l'estat de React si hem modificat el DOM
            if (htmlNeedsUpdate) {
                setConvertedHtml(contentRef.current.innerHTML);
            }

            const existingInstruction = aiInstructions.find(instr => instr.id === paragraphId);
            setAiTargetParagraphId(paragraphId); // Marquem aquest paràgraf per edició IA
            setAiUserPrompt(existingInstruction?.prompt || ''); // Omplim prompt existent

            console.log("Paràgraf seleccionat per IA:", paragraphId);

        } else {
            // Si cliquem fora d'un paràgraf, desactivem el mode IA
             if (aiTargetParagraphId) { // Només neteja si hi havia un target actiu
                setAiTargetParagraphId(null);
                setAiUserPrompt('');
            }
        }
    };

    // Funció per Guardar Instrucció IA associada a un paràgraf
    const handleSaveAiInstruction = () => {
        if (!aiUserPrompt.trim() || !aiTargetParagraphId || !contentRef.current) {
            alert("Selecciona un paràgraf i escriu una instrucció.");
            return;
        }

        const targetParagraph = contentRef.current.querySelector<HTMLParagraphElement>(`p[data-paragraph-id="${aiTargetParagraphId}"]`);

        if (targetParagraph) {
            // Actualitza o afegeix la instrucció a l'estat aiInstructions
            setAiInstructions(prevInstructions => {
                const existingIndex = prevInstructions.findIndex(instr => instr.id === aiTargetParagraphId);
                const newInstruction = { id: aiTargetParagraphId!, prompt: aiUserPrompt };
                if (existingIndex > -1) {
                    const updatedInstructions = [...prevInstructions];
                    updatedInstructions[existingIndex] = newInstruction; return updatedInstructions;
                } else { return [...prevInstructions, newInstruction]; }
            });
            // Marca visualment el paràgraf
            targetParagraph.classList.add('ai-prompt-target');
            // Actualitza l'estat React amb l'HTML modificat
            const updatedHtml = contentRef.current.innerHTML;
            setConvertedHtml(updatedHtml);
            console.log(`Instrucció IA guardada per al paràgraf ${aiTargetParagraphId}: "${aiUserPrompt}"`);
            // Neteja UI IA (podem deixar el target ID si volem seguir editant, però millor netejar)
            setAiTargetParagraphId(null); setAiUserPrompt('');
        } else {
            console.error("No s'ha trobat el paràgraf per guardar la instrucció IA."); alert("Error: No s'ha pogut guardar la instrucció.");
            setAiTargetParagraphId(null); setAiUserPrompt('');
        }
    };

     // Funció per cancel·lar l'edició d'un prompt IA (si es clica "Cancel·lar")
     const handleCancelAiInstruction = () => {
        setAiTargetParagraphId(null);
        setAiUserPrompt('');
    };


    // Funció per al botó Guardar Configuració (envia aiInstructions)
    const handleSaveConfiguration = async () => {
        console.log("Intentant desar configuració..."); setSaveStatus('saving'); setSaveMessage(null); if (!contentRef.current) { setSaveMessage("Error: No HTML."); setSaveStatus('error'); return; }
        const finalHtml = contentRef.current.innerHTML; // HTML amb IDs i classes
        const configuration = { baseDocxName: selectedFileName, excelInfo: { fileName: selectedExcelFileName, headers: excelHeaders, }, linkMappings: links, aiInstructions: aiInstructions, finalHtml: finalHtml };
        console.log("Configuració a desar:", configuration);
        try { // --- TODO: Crida API real ---
            await new Promise(resolve => setTimeout(resolve, 1000)); console.log("Guardat (simulat)."); setSaveMessage("Guardat amb èxit!"); setSaveStatus('success');
        } catch (error) { console.error("Error desant:", error); setSaveMessage(`Error: ${error instanceof Error ? error.message : 'Error'}`); setSaveStatus('error'); }
    };


    // --- JSX ---
    return (
        <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">

            {/* Capçalera WEB */}
            <div className="web-header w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 px-1 gap-4"> <h2 className="text-lg font-semibold text-gray-700">Configurador Plantilles DOCX</h2> {selectedFileName && (<span className="text-sm text-gray-500 italic hidden sm:block"> Editant: {selectedFileName} {selectedExcelFileName ? ` amb ${selectedExcelFileName}` : ''}</span>)} </div>

            {/* Capçalera/Peu Impressió */}
            <div id="print-header" className="hidden print:block ...">...</div>
            <div id="print-footer" className="hidden print:block ...">...</div>

            {/* Errors Globals */}
            {(docxError || excelError) && (<div className="web-errors w-full max-w-6xl ...">{docxError && <p>...</p>}{excelError && <p>...</p>}</div>)}

            {/* Contenidor Principal */}
            <div className="flex w-full max-w-6xl gap-x-6 px-1">

                {/* Columna Esquerra: Foli Blanc DOCX */}
                <div className="flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-0">
                    {isLoadingDocx && (<div className="text-center my-6">...</div>)}
                    {/* Contingut DOCX amb Ref, onMouseUp (per Excel link), onClick (per IA) */}
                    <div className="mt-1"
                         ref={contentRef}
                         onMouseUp={handleTextSelection} // Per vincular Excel
                         onClick={handleContentClick}    // Per seleccionar paràgraf per IA
                    >
                        {isMounted && convertedHtml ? ( <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: convertedHtml }} /> ) : ( !isLoadingDocx && !docxError && <p className="text-gray-400 italic text-center py-10">Comença seleccionant un fitxer DOCX al panell lateral.</p> )}
                    </div>
                    {/* Missatges Mammoth */}
                    {mammothMessages && mammothMessages.length > 0 && ( <div className="mt-6 border-t pt-6"> {/* ... */} </div> )}
                    {/* Debug: Mostrar Vincles Excel i Instruccions IA */}
                    {(links.length > 0 || aiInstructions.length > 0) && ( <div className="mt-6 border-t pt-4 space-y-4 text-xs"> {links.length > 0 && <div> <h3 className="text-sm font-semibold text-purple-600 mb-1">Placeholders Excel:</h3> <ul className="list-disc list-inside text-gray-600"> {links.map(l => (<li key={l.id} className='mb-1'><code>{l.selectedText}</code> <span className='text-gray-500'>=&gt;</span> <strong>{l.excelHeader}</strong></li>))} </ul> </div>} {aiInstructions.length > 0 && <div> <h3 className="text-sm font-semibold text-indigo-600 mb-1">Instruccions IA:</h3> <ul className="list-decimal list-inside text-gray-600 space-y-1"> {aiInstructions.map((instr, index) => (<li key={instr.id} className='mb-1 border-b pb-1'> <span className="font-medium text-indigo-800">Inst. {index + 1}</span> <span className='text-gray-500'>(Pàrr. ID: {instr.id.substring(2,8)}...)</span> <i className='block bg-indigo-50 px-1 rounded text-xs'>{instr.prompt}</i> </li>))} </ul> </div>} </div> )}

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

                                {/* Pas 3: Vincular Excel (si hi ha capçaleres) */}
                                {convertedHtml && excelHeaders.length > 0 && ( <div className="p-3 border rounded border-gray-200"> <p className="text-sm font-medium ...">Vincular amb Excel</p> {/* ... (Llista Capçaleres i instruccions) ... */} <p className="text-xs ...">1. Clica capçalera:</p> <div className="flex flex-col gap-1 mb-2 max-h-40 ..."> {excelHeaders.map(h => { const c=linkCounts[h]||0; const iL=c>0; return ( <button key={h} onClick={()=>handleSelectHeader(h)} className={`... ${ selectedExcelHeader === h ? 'bg-blue-500 ...' : iL ? 'bg-green-50 ...' : 'bg-white ...' }`}> <span>{h}</span> {c > 0 && (<span className={`...`}>({c})</span>)} </button> ); })} </div> {selectedExcelHeader && (<p className="text-xs bg-blue-50 p-2 ..."> ... </p>)} {!selectedExcelHeader && (<p className="text-xs text-gray-500 p-2"> ... </p>)} <div className="mt-2 text-center text-xs"> <label htmlFor="excelInputSidebarChange" className="..."> Canviar Excel ...</label> <input type="file" id="excelInputSidebarChange" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel}/> </div> </div> )}

                                {/* Pas 4: Instruccions IA */}
                                {convertedHtml && (
                                     <div className="p-3 border rounded border-gray-200">
                                        <p className="text-sm font-medium text-gray-700 mb-1">Instruccions IA</p>
                                        <p className="text-xs text-gray-600 mb-2">Clica un paràgraf al document per afegir/editar una instrucció:</p>

                                        {/* UI per afegir/editar instrucció IA */}
                                        {aiTargetParagraphId && ( // << Es mostra si hem clicat un paràgraf
                                            <div className='mt-2 pt-3 border-t border-indigo-200 space-y-3'>
                                                <p className='text-xs font-medium text-indigo-700'>Editant paràgraf ID: <code className='text-xs'>{aiTargetParagraphId.substring(2,8)}...</code></p>
                                                <div>
                                                    <label htmlFor="aiPrompt" className='block text-xs font-medium text-gray-600 mb-1'>Instrucció per la IA:</label>
                                                    <textarea id="aiPrompt" rows={4} value={aiUserPrompt} onChange={(e) => setAiUserPrompt(e.target.value)} placeholder="Ex: Resumeix aquest paràgraf" className="w-full p-2 border rounded text-xs" />
                                                </div>
                                                <div className="flex gap-2">
                                                     <button onClick={handleSaveAiInstruction} disabled={!aiUserPrompt.trim() && !(aiInstructions.find(i => i.id === aiTargetParagraphId)?.prompt)} className={`flex-grow px-3 py-1.5 text-xs font-medium rounded shadow-sm text-white transition ... ${(!aiUserPrompt.trim() && !(aiInstructions.find(i => i.id === aiTargetParagraphId)?.prompt)) ? 'bg-gray-400 ...' : 'bg-indigo-600 hover:bg-indigo-700'}`} >
                                                        {aiInstructions.find(i => i.id === aiTargetParagraphId)?.prompt ? 'Actualitzar' : 'Guardar'} Instrucció
                                                     </button>
                                                     <button onClick={handleCancelAiInstruction} className='px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 border rounded'>Cancel·lar</button>
                                                </div>
                                            </div>
                                        )}
                                        {/* Missatge si no hi ha paràgraf seleccionat per IA */}
                                        {!aiTargetParagraphId && (
                                            <p className="text-xs text-gray-400 italic p-2 text-center">Clica un paràgraf al document...</p>
                                         )}

                                        {/* Historial Instruccions IA Guardades */}
                                        {aiInstructions.length > 0 && (
                                            <div className="mt-4 pt-4 border-t">
                                                <h4 className="text-sm font-medium text-indigo-700 mb-2">Instruccions Guardades:</h4>
                                                <ul className="space-y-2 text-xs max-h-32 overflow-y-auto pr-1">
                                                     {aiInstructions.map((instr, index) => ( <li key={instr.id} className="p-2 border rounded bg-indigo-50 text-gray-700 hover:bg-indigo-100 cursor-pointer" onClick={() => {setAiTargetParagraphId(instr.id); setAiUserPrompt(instr.prompt)}}> <span className="block font-medium text-indigo-800">Instrucció {index + 1}</span> <span className='block text-gray-500 text-[10px]'>(Paràgraf ID: {instr.id.substring(2,8)}...)</span> <i className='block mt-1'>{instr.prompt}</i> </li> ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}

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