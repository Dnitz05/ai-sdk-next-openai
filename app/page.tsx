// app/page.tsx
'use client';

import React, { useState, ChangeEvent, useEffect, useRef, MouseEvent, useMemo } from 'react';
import * as XLSX from 'xlsx';

// Interfície per als vincles Excel
interface Link {
    id: string;
    excelHeader: string;
    selectedText: string; // Nom de la capçalera
    // aiPrompt?: string; // Ja no es guarda aquí
}

// Interfície per a les instruccions IA guardades
interface AiInstruction {
    id: string; // ID permanent de l'span marcador AI
    prompt: string;
    originalText?: string; // Text original marcat (opcional)
}


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

    // --- Estats per Vinculació Excel ---
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null); // Capçalera seleccionada per VINCULAR (1a capa)
    const [links, setLinks] = useState<Link[]>([]); // Vincles Excel creats

    // --- Estats per Instruccions IA ---
    const [aiSelectedText, setAiSelectedText] = useState<string | null>(null); // Text seleccionat temporalment per IA
    const [aiTemporaryMarkerId, setAiTemporaryMarkerId] = useState<string | null>(null); // ID de l'span temporal IA
    const [aiUserPrompt, setAiUserPrompt] = useState<string>(''); // Prompt de l'usuari per IA
    const [aiInstructions, setAiInstructions] = useState<AiInstruction[]>([]); // Llista d'instruccions IA guardades

    // --- Estat per Guardar Configuració ---
    type SaveStatus = 'idle' | 'saving' | 'success' | 'error';
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    // --- Refs ---
    const contentRef = useRef<HTMLDivElement>(null);
    // Ja no cal prevIsLoadingDocx amb el nou enfocament

    // Estat per renderitzat client
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    // Ja NO necessitem useEffect per obrir sidebar automàticament

    // Càlcul dels recomptes de vincles Excel
    const linkCounts = useMemo(() => {
        const counts: { [key: string]: number } = {};
        for (const link of links) {
            counts[link.excelHeader] = (counts[link.excelHeader] || 0) + 1;
        }
        return counts;
    }, [links]);

    // --- Funcions DOCX ---
    // Ara cridat des de l'input del SIDEBAR per al DOCX
    const handleDocxUpload = async (file: File | null) => {
        if (!file) return;

        setSelectedFileName(file.name); // Guardem nom abans de resetejar
        setIsLoadingDocx(true);
        setDocxError(null); setConvertedHtml(null); setMammothMessages([]);
        // Reset complet de la resta
        setSelectedExcelFileName(null); setExcelData(null); setExcelError(null);
        setExcelHeaders([]); setSelectedExcelHeader(null); setLinks([]);
        setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt(''); setAiInstructions([]);
        setSaveStatus('idle'); setSaveMessage(null);

        const formData = new FormData(); formData.append('file', file);
        try {
            const response = await fetch('/api/process-document', { method: 'POST', body: formData });
            const contentType = response.headers.get("content-type");
            if (!response.ok) {
                let errorPayload: any = { error: `Error del servidor: ${response.status} ${response.statusText}` };
                if (contentType && contentType.includes("application/json")) { try { errorPayload = await response.json(); } catch (e) { /* ignora */ } } else { try { const rawErrorText = await response.text(); errorPayload.details = rawErrorText || "Error inesperat."; } catch (e) { /* ignora */ } }
                throw new Error(errorPayload.error || JSON.stringify(errorPayload));
            }
            if (contentType && contentType.includes("application/json")) {
                const data = await response.json();
                setConvertedHtml(data.html);
                setMammothMessages(data.messages || []);
            } else { const rawText = await response.text(); console.warn("Resposta OK però no és JSON:", rawText); throw new Error("Format de resposta inesperat."); }
        } catch (err) {
            console.error("Error processant DOCX:", err);
            setDocxError(err instanceof Error ? err.message : 'Error desconegut');
            setConvertedHtml(null);
            setSelectedFileName(null); // Neteja nom si hi ha error
        } finally { setIsLoadingDocx(false); }
    };

    // Aquest gestiona el canvi a l'input del DOCX
    const handleDocxFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            const isValidType = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx');
            if (isValidType) {
                setDocxError(null);
                handleDocxUpload(file); // Crida la funció de processament
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
        if (event.target) event.target.value = ''; // Permet re-seleccionar
    };


    // --- Funcions EXCEL (Ara cridada des del sidebar Pas 2) ---
    const handleExcelFileChange = (event: ChangeEvent<HTMLInputElement>) => {
         if (event.target.files && event.target.files[0]) { const f=event.target.files[0];setSelectedExcelFileName(f.name);setExcelError(null);setExcelData(null);setSelectedExcelHeader(null);setExcelHeaders([]);setAiSelectedText(null);setAiTemporaryMarkerId(null);setAiUserPrompt('');/* NO reset aiInstructions */setSaveStatus('idle');setSaveMessage(null);const vMT=['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];const vT=vMT.includes(f.type)||f.name.toLowerCase().endsWith('.xlsx')||f.name.toLowerCase().endsWith('.xls');if(vT){setIsParsingExcel(true);const r=new FileReader();r.onload=(e)=>{try{const a=e.target?.result;if(a){const w=XLSX.read(a,{type:'buffer'});const sN=w.SheetNames[0];const wS=w.Sheets[sN];const jD=XLSX.utils.sheet_to_json(wS);if(jD.length>0){const fR=jD[0];if(fR&&typeof fR==='object'){setExcelHeaders(Object.keys(fR));}else{setExcelHeaders([]);setExcelError("Format fila Excel invàlid.");}}else{setExcelHeaders([]);setExcelError("Excel buit.");}setExcelData(jD);}else{throw new Error("Error llegint");}}catch(err){setExcelError(err instanceof Error?err.message:'Error');setExcelData(null);setExcelHeaders([]);}finally{setIsParsingExcel(false);}};r.onerror=(e)=>{setExcelError("Error llegint fitxer.");setIsParsingExcel(false);setExcelData(null);setExcelHeaders([]);};r.readAsArrayBuffer(f);}else{setExcelError('Selecciona .xlsx/.xls');setSelectedExcelFileName(null);setExcelData(null);setExcelHeaders([]);}}else{}if(event.target){event.target.value='';}
    };

    // --- Funcions per Vinculació Excel i Selecció IA ---

    // Funció auxiliar per desembolcallar un span temporal IA
    const unwrapTemporaryAiSpan = (tempId: string | null): boolean => {
        if (tempId && contentRef.current) {
            const tempSpan = contentRef.current.querySelector<HTMLElement>(`span[data-ai-temp-id="${tempId}"]`);
            if (tempSpan) {
                try {
                    const childNodesArray = Array.from(tempSpan.childNodes);
                    tempSpan.replaceWith(...childNodesArray);
                    return true; // Indica que s'ha modificat l'HTML
                } catch (error) { console.error("Error desembolcallant span temporal:", error); }
            }
        }
        return false;
    };

    // S'activa quan es clica una capçalera al sidebar
    const handleSelectHeader = (header: string) => {
        // Neteja estat temporal IA si n'hi ha, abans de seleccionar capçalera
        const htmlChanged = unwrapTemporaryAiSpan(aiTemporaryMarkerId);
        if (htmlChanged && contentRef.current) {
            setConvertedHtml(contentRef.current.innerHTML); // Actualitza HTML
        }
        setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt('');
        setSelectedExcelHeader(header); // Activa per vincular Excel
    };

    // S'activa en deixar anar el ratolí sobre el contingut DOCX
    const handleTextSelection = () => {
        // No actuar si el sidebar no està en mode d'edició (ja té DOCX carregat)
        if (!convertedHtml || isLoadingDocx) return;

        const selection = window.getSelection();

        // Cas 1: Vincular Excel (selectedExcelHeader té valor)
        if (selectedExcelHeader && selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
            const originalSelectedText = selection.toString();
            if (!originalSelectedText.trim()) { selection.removeAllRanges(); return; }
            const range = selection.getRangeAt(0);
            const linkId = `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            if (!contentRef.current.contains(range.commonAncestorContainer)) {
                 console.warn("Ignorant selecció (link): Fora de l'àrea."); selection.removeAllRanges(); setSelectedExcelHeader(null); return;
            }
            const span = document.createElement('span');
            span.className = 'linked-placeholder';
            span.dataset.excelHeader = selectedExcelHeader;
            span.dataset.linkId = linkId;
            span.textContent = selectedExcelHeader; // Reemplaça amb la capçalera
            try {
                range.deleteContents();
                range.insertNode(span);
                const updatedHtml = contentRef.current.innerHTML;
                setConvertedHtml(updatedHtml);
                setLinks(prevLinks => [...prevLinks, { id: linkId, excelHeader: selectedExcelHeader!, selectedText: selectedExcelHeader! }]);
            } catch (error) { console.error("Error DOM (link):", error); alert("Error vinculant."); }
            finally { selection.removeAllRanges(); setSelectedExcelHeader(null); }
             // Neteja IA per si de cas
             const changed = unwrapTemporaryAiSpan(aiTemporaryMarkerId);
             if(changed && contentRef.current) setConvertedHtml(contentRef.current.innerHTML);
             setAiSelectedText(null); setAiTemporaryMarkerId(null); setAiUserPrompt('');
        }
        // Cas 2: Preparar per Instrucció IA (selectedExcelHeader és null)
        else if (!selectedExcelHeader && selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
            const currentSelectedText = selection.toString();
            if (!currentSelectedText.trim()) { selection.removeAllRanges(); return; }
            const range = selection.getRangeAt(0);
            if (!contentRef.current.contains(range.commonAncestorContainer)) {
                console.warn("Ignorant selecció (IA): Fora de l'àrea."); selection.removeAllRanges(); return;
            }

            // Neteja marcador temporal IA anterior
            const changedHtml = unwrapTemporaryAiSpan(aiTemporaryMarkerId);
            // Important: Si s'ha desembolicat, l'HTML ja ha canviat, llegim-lo abans de continuar
            let baseHtml = changedHtml && contentRef.current ? contentRef.current.innerHTML : convertedHtml;

            const tempId = `temp-ai-${Date.now()}`;
            const tempSpan = document.createElement('span');
            tempSpan.dataset.aiTempId = tempId;
            try {
                // Recreem el range sobre l'HTML actualitzat si cal
                 if (changedHtml) {
                    // Això és complex, per ara simplement actualitzem l'estat i confiem
                    setConvertedHtml(baseHtml || ''); // Assegura que l'HTML està actualitzat
                    // L'usuari haurà de tornar a seleccionar si vol marcar un nou tros
                    console.warn("S'ha netejat un marcador IA previ. Si us plau, torna a seleccionar el text per a la IA.");
                     setAiSelectedText(null); setAiTemporaryMarkerId(null);
                     selection.removeAllRanges();
                    return;
                }
                 // Si no hi havia marcador previ, continuem
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
                setAiSelectedText(null); setAiTemporaryMarkerId(null);
            } finally { selection.removeAllRanges(); }
        }
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
            <div className="web-header w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 px-1 gap-4">
                <h2 className="text-lg font-semibold text-gray-700">Configurador Plantilles DOCX</h2>
                {selectedFileName && (<span className="text-sm text-gray-500 italic hidden sm:block"> Editant: {selectedFileName} {selectedExcelFileName ? ` amb ${selectedExcelFileName}` : ''}</span>)}
            </div>

            {/* Capçalera/Peu Impressió */}
            <div id="print-header" className="hidden print:block w-full max-w-4xl mx-auto mb-4 text-center text-xs text-gray-500">Configuració Plantilla - {new Date().toLocaleDateString()}</div>
            <div id="print-footer" className="hidden print:block w-full max-w-4xl mx-auto mt-8 text-center text-xs text-gray-500"></div>

            {/* Errors Globals */}
            {(docxError || excelError) && (<div className="web-errors w-full max-w-6xl mx-auto text-sm text-red-600 text-center mb-2 -mt-2 px-1">{docxError && <p>Error DOCX: {docxError}</p>}{excelError && <p>Error Excel: {excelError}</p>}</div>)}

            {/* Contenidor Principal (Flexbox per Foli + Sidebar) */}
            <div className="flex w-full max-w-6xl gap-x-6 px-1">

                {/* Columna Esquerra: Foli Blanc DOCX */}
                <div className="flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-0">
                    {isLoadingDocx && (<div className="text-center my-6"><p className="text-blue-600 animate-pulse">Processant DOCX...</p></div>)}
                    {/* Contingut DOCX amb Ref i onMouseUp */}
                    <div className="mt-1" ref={contentRef} onMouseUp={handleTextSelection} >
                        {isMounted && convertedHtml ? ( <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: convertedHtml }} /> ) : ( !isLoadingDocx && !docxError && <p className="text-gray-400 italic text-center py-10">Comença seleccionant un fitxer DOCX al panell lateral.</p> )}
                    </div>
                    {/* Missatges Mammoth */}
                    {mammothMessages && mammothMessages.length > 0 && ( <div className="mt-6 border-t pt-6"> <h3 className="text-lg font-semibold text-orange-600 mb-2">Missatges Conversió:</h3> <ul className="list-disc list-inside text-sm text-orange-700 bg-orange-50 p-4 rounded-md"> {mammothMessages.map((msg, index) => (<li key={index}><strong>{msg.type}:</strong> {msg.message}</li>))} </ul> </div> )}
                    {/* Debug: Mostrar Vincles Excel i Instruccions IA */}
                    {(links.length > 0 || aiInstructions.length > 0) && ( <div className="mt-6 border-t border-gray-200 pt-4 space-y-4 text-xs"> {links.length > 0 && <div> <h3 className="text-sm font-semibold text-purple-600 mb-1">Placeholders Excel:</h3> <ul className="list-disc list-inside text-gray-600"> {links.map(l => (<li key={l.id} className='mb-1'><code>{l.selectedText}</code> <span className='text-gray-500'>=&gt;</span> <strong>{l.excelHeader}</strong></li>))} </ul> </div>} {aiInstructions.length > 0 && <div> <h3 className="text-sm font-semibold text-indigo-600 mb-1">Instruccions IA:</h3> <ul className="list-disc list-inside text-gray-600"> {aiInstructions.map(i => (<li key={i.id} className='mb-1' title={`Original: ${i.originalText || 'N/A'}`}>ID:<code>{i.id.substring(9,14)}</code> | Prompt: <i className='bg-indigo-50 px-1 rounded'>{i.prompt}</i></li>))} </ul> </div>} </div> )}
                 </div> {/* Fi Foli */}


                {/* Columna Dreta: Sidebar (SEMPRE VISIBLE si isMounted) */}
                {isMounted && (
                    <aside className="w-80 flex-shrink-0 my-0 relative">
                        <div className="sticky top-4 p-4 bg-white rounded shadow-lg border max-h-[calc(100vh-2rem)] overflow-y-auto flex flex-col">
                            {/* Capçalera Sidebar */}
                            <div className="flex justify-between items-center mb-3 pb-2 border-b flex-shrink-0">
                                <h3 className="text-md font-semibold text-blue-700">Configuració</h3>
                                {/* Eliminat botó tancar */}
                            </div>

                            {/* Contingut Sidebar */}
                            <div className="flex-grow overflow-y-auto space-y-4 pr-1 mb-4">

                                {/* Pas 1: Carregar DOCX */}
                                <div className={`p-3 border rounded ${convertedHtml ? 'border-green-300 bg-green-50' : 'border-dashed border-gray-300'}`}>
                                    <p className={`text-sm font-medium mb-2 ${convertedHtml ? 'text-green-700' : 'text-gray-700'}`}>Pas 1: Plantilla DOCX</p>
                                    <div className="flex flex-col items-start gap-2">
                                        <label htmlFor="docxInputSidebar" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${isLoadingDocx ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}`}>
                                            {isLoadingDocx ? 'Processant...' : (selectedFileName ? 'Canvia DOCX' : 'Selecciona DOCX')}
                                        </label>
                                        <input type="file" id="docxInputSidebar" onChange={handleDocxFileChange} accept=".docx" className="hidden" disabled={isLoadingDocx}/>
                                        {selectedFileName && !isLoadingDocx && (<span className="text-xs text-gray-500 italic">({selectedFileName})</span>)}
                                    </div>
                                    {docxError && (<p className="text-xs text-red-600 mt-2">{docxError}</p>)}
                                </div>

                                {/* Pas 2: Carregar Excel */}
                                {/* Només visible si el DOCX ja està carregat */}
                                {convertedHtml && !isLoadingDocx && !docxError && (
                                     <div className={`p-3 border rounded ${excelHeaders.length > 0 ? 'border-green-300 bg-green-50' : 'border-dashed border-gray-300'}`}>
                                        <p className={`text-sm font-medium mb-2 ${excelHeaders.length > 0 ? 'text-green-700' : 'text-gray-700'}`}>Pas 2: Dades Excel (Opcional)</p>
                                        <div className="flex flex-col items-start gap-2">
                                            <label htmlFor="excelInputSidebar" className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${isParsingExcel ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 cursor-pointer'}`}>
                                                {isParsingExcel ? 'Processant...' : (selectedExcelFileName ? 'Canvia Excel' : 'Selecciona Excel')}
                                            </label>
                                            <input type="file" id="excelInputSidebar" onChange={handleExcelFileChange} accept=".xlsx, .xls" className="hidden" disabled={isParsingExcel} />
                                            {selectedExcelFileName && !isParsingExcel && (<span className="text-xs text-gray-500 italic">({selectedExcelFileName})</span>)}
                                        </div>
                                        {isParsingExcel && (<div className="mt-2"><p className="text-green-600 animate-pulse text-xs">Processant...</p></div>)}
                                        {excelError && (<p className="text-xs text-red-600 mt-2">{excelError}</p>)}
                                    </div>
                                )}

                                {/* Pas 3: Vincular / IA */}
                                {/* Només visible si DOCX i Excel estan carregats */}
                                {convertedHtml && excelHeaders.length > 0 && !isLoadingDocx && !isParsingExcel && !docxError && !excelError && (
                                    <div className="space-y-4 pt-4 border-t">
                                        {/* Secció Vincular Excel */}
                                        <div>
                                            <p className="text-sm font-medium text-gray-700 mb-1">Pas 3a: Vincular Excel</p>
                                            <p className="text-xs text-gray-600 mb-2">1. Clica capçalera:</p>
                                            <div className="flex flex-col gap-1 mb-2 max-h-40 overflow-y-auto pr-1 border rounded p-2 bg-gray-50">
                                                 {excelHeaders.map(h => { const c=linkCounts[h]||0; const iL=c>0; return ( <button key={h} onClick={()=>handleSelectHeader(h)} className={`w-full text-left px-2 py-1 border rounded text-xs font-medium transition-colors break-words flex justify-between items-center ${ selectedExcelHeader === h ? 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-300' : iL ? 'bg-green-50 text-green-800 border-green-300 hover:bg-green-100' : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-100' }`} > <span>{h}</span> {c > 0 && (<span className={`ml-2 text-xs font-normal px-1.5 py-0.5 rounded ${selectedExcelHeader === h ? 'bg-white text-blue-700' : 'bg-gray-200 text-gray-600'}`}> ({c}) </span>)} </button> ); })}
                                            </div>
                                            {selectedExcelHeader && (<p className="text-xs bg-blue-50 p-2 rounded border border-blue-200"> <strong className="block mb-1">2.</strong> Selecciona text al document per <strong className='text-red-600'>REEMPLAÇAR</strong> per: <span className="font-semibold italic">{selectedExcelHeader}</span> </p>)}
                                        </div>

                                        {/* Secció Instruccions IA */}
                                        <div className="pt-3 border-t">
                                            <p className="text-sm font-medium text-gray-700 mb-1">Pas 3b: Instruccions IA</p>
                                            {/* UI per afegir instrucció IA */}
                                            {aiSelectedText && aiTemporaryMarkerId && (
                                                <div className='p-3 border rounded bg-indigo-50 space-y-3 border-indigo-200'>
                                                    <div><label className='block text-xs ...'>Al text seleccionat:</label> <p className="text-xs bg-white p-2 border rounded max-h-20 ..." title={aiSelectedText}>{aiSelectedText.substring(0, 100)}{aiSelectedText.length > 100 ? '...' : ''}</p></div>
                                                    <div><label htmlFor="aiPrompt" className='block text-xs ...'>Instrucció per la IA:</label> <textarea id="aiPrompt" rows={4} value={aiUserPrompt} onChange={(e) => setAiUserPrompt(e.target.value)} placeholder="Ex: Resumeix..." className="w-full p-2 border rounded text-xs" /></div>
                                                    <button onClick={handleSaveAiInstruction} disabled={!aiUserPrompt.trim()} className={`w-full ... ${!aiUserPrompt.trim() ? 'bg-gray-400 ...' : 'bg-indigo-600 hover:bg-indigo-700'}`} > Guardar Instrucció IA </button>
                                                </div>
                                            )}
                                            {/* Missatge si no hi ha text seleccionat per IA */}
                                            {!aiSelectedText && ( <p className="text-xs text-gray-400 italic p-2 text-center">Selecciona text al document (sense capçalera Excel activa) per afegir una instrucció IA.</p> )}
                                            {/* Historial Instruccions IA Guardades */}
                                            {aiInstructions.length > 0 && ( <div className="mt-4 pt-4 border-t"> <h4 className="text-sm font-medium ...">Instruccions Guardades:</h4> <ul className="space-y-2 text-xs ..."> {aiInstructions.map(instr => ( <li key={instr.id} className="p-2 border rounded ..."> <span className="block font-medium ...">ID: {instr.id.substring(9,14)}...</span> <span className="block italic">"{instr.prompt}"</span> </li> ))} </ul> </div> )}
                                        </div>
                                    </div>
                                )}

                            </div> {/* Fi Contingut Scrollable Sidebar */}

                            {/* Botó Guardar Configuració Final */}
                            <div className="mt-auto pt-4 border-t flex-shrink-0 space-y-2">
                                <button onClick={handleSaveConfiguration} disabled={saveStatus === 'saving' || (!convertedHtml)} className={`w-full px-4 py-2 text-sm font-medium rounded shadow-sm transition ... ${saveStatus === 'saving' || !convertedHtml ? 'bg-gray-300 ... cursor-not-allowed' : 'bg-purple-600 ...'}`} > {saveStatus === 'saving' ? 'Guardant...' : 'Guardar Configuració'} </button>
                                {saveMessage && ( <p className={`text-xs text-center ${saveStatus === 'error' ? 'text-red-600' : 'text-green-600'}`}> {saveMessage} </p> )}
                            </div>
                        </div>
                    </aside>
                 )} {/* Fi Sidebar (ara sempre visible si isMounted) */}

            </div> {/* Fi Contenidor Principal Flex */}

        </main>
    );
} // <<< Fi component Home