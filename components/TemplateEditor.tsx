import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import * as XLSX from 'xlsx';

interface ParagraphIaData {
  currentPrompt: string;
  savedPrompt: string;
  y: number;
  height: number;
  isActiveEditor: boolean;
}

interface ParagraphButtonVisual {
  yButton: number;
  showButton: boolean;
  hasSavedPrompt: boolean;
}

interface TemplateEditorProps {
  initialTemplateData: any;
  mode: 'edit' | 'new';
}

const MIN_EDITOR_BOX_HEIGHT = 90; // px - Adjusted for label, button, padding, and some textarea space

const TemplateEditor: React.FC<TemplateEditorProps> = ({ initialTemplateData, mode }) => {
  const templateTitle = initialTemplateData?.config_name || '';
  const docxName = initialTemplateData?.base_docx_name || '';
  const excelName = initialTemplateData?.excel_file_name || '';
  const excelHeaders: string[] = initialTemplateData?.excel_headers || [];

  const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null);
  const [convertedHtml, setConvertedHtml] = useState<string>(initialTemplateData?.final_html || '');
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // IA mode state
  const [iaMode, setIaMode] = useState(true);
  const [iaPromptsData, setIaPromptsData] = useState<Record<string, ParagraphIaData>>({});
  const [paragraphButtonVisuals, setParagraphButtonVisuals] = useState<Record<string, ParagraphButtonVisual>>({});
  const [hoveredPId, setHoveredPId] = useState<string | null>(null);
  const iaTextAreaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // assign unique ids to paragraphs
  useEffect(() => {
    if (!contentRef.current) return;
    const ps = contentRef.current.querySelectorAll('p');
    let updated = false;
    ps.forEach(p => {
      if (!p.dataset.paragraphId) {
        p.dataset.paragraphId = `p-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        updated = true;
      }
    });
    if (updated) {
      setConvertedHtml(contentRef.current.innerHTML);
    }
  }, [convertedHtml]);

  // Effect to update IA button visuals based on hover, saved prompts, and iaMode
  useEffect(() => {
    if (!iaMode || !contentRef.current || !contentWrapperRef.current) {
      setParagraphButtonVisuals({}); // Clear visuals if IA mode is off or refs not ready
      return;
    }

    const newVisuals: Record<string, ParagraphButtonVisual> = {};
    const ps = contentRef.current.querySelectorAll('p[data-paragraph-id]');
    const wrapRect = contentWrapperRef.current.getBoundingClientRect();

    ps.forEach(pElement => {
      const pid = (pElement as HTMLElement).dataset.paragraphId!;
      if (!pid) return;

      const rect = pElement.getBoundingClientRect();
      const yButton = (rect.top + rect.height / 2) - wrapRect.top;
      const hasSavedPrompt = !!iaPromptsData[pid]?.savedPrompt;
      const showButton = iaMode && (hasSavedPrompt || pid === hoveredPId);
      
      newVisuals[pid] = { yButton, showButton, hasSavedPrompt };
    });
    setParagraphButtonVisuals(newVisuals);

  }, [iaMode, convertedHtml, hoveredPId, iaPromptsData, contentRef, contentWrapperRef]);


  const handleMouseOver = (e: MouseEvent<HTMLDivElement>) => {
    if (!iaMode) return;
    const target = e.target as HTMLElement;
    const p = target.closest('p[data-paragraph-id]');
    if (p) {
      setHoveredPId((p as HTMLElement).dataset.paragraphId!);
    }
  };

  const handleMouseLeave = () => {
    setHoveredPId(null);
  };

  const adaptWithIA = (paragraphId: string) => {
    if (!contentRef.current || !contentWrapperRef.current) return;
    const pElement = contentRef.current.querySelector(`p[data-paragraph-id="${paragraphId}"]`);
    if (!pElement) return;

    // Clear previous highlights
    contentRef.current.querySelectorAll('p.ia-selected').forEach(el => el.classList.remove('ia-selected'));
    pElement.classList.add('ia-selected');

    const rect = pElement.getBoundingClientRect();
    const wrapRect = contentWrapperRef.current.getBoundingClientRect();
    const y = rect.top - wrapRect.top;
    const height = rect.height;

    setIaPromptsData(prevData => ({
      ...prevData,
      [paragraphId]: {
        currentPrompt: prevData[paragraphId]?.savedPrompt || '', // Load saved or empty
        savedPrompt: prevData[paragraphId]?.savedPrompt || '',
        y,
        height,
        isActiveEditor: true,
      }
    }));

    setTimeout(() => {
      iaTextAreaRefs.current[paragraphId]?.focus();
    }, 0);
  };
  
  const handleSaveIaPrompt = (paragraphId: string) => {
    setIaPromptsData(prev => {
      const currentEntry = prev[paragraphId];
      if (!currentEntry) return prev;
      return {
        ...prev,
        [paragraphId]: {
          ...currentEntry,
          savedPrompt: currentEntry.currentPrompt,
        },
      };
    });
    // Future: API call to save prompt to backend
  };

  // Excel mapping logic remains unchanged
  const handleTextSelection = () => {
    if (!convertedHtml || !selectedExcelHeader) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !contentRef.current) return;
    const range = sel.getRangeAt(0);
    if (!contentRef.current.contains(range.commonAncestorContainer)) {
      sel.removeAllRanges();
      setSelectedExcelHeader(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text) {
      sel.removeAllRanges();
      return;
    }
    const span = document.createElement('span');
    span.className = 'linked-placeholder';
    span.dataset.excelHeader = selectedExcelHeader;
    const linkId = `link-${Date.now()}-${Math.random().toString(36).substr(2,5)}`;
    span.dataset.linkId = linkId;
    span.textContent = selectedExcelHeader;
    try {
      range.deleteContents();
      range.insertNode(span);
      setConvertedHtml(contentRef.current.innerHTML);
    } catch {
      alert('Error vinculant.');
    } finally {
      sel.removeAllRanges();
      setSelectedExcelHeader(null);
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-gray-50 pt-4">
      {/* Document title */}
      <div className="w-full max-w-5xl mx-auto mb-3 px-4 flex items-center">
        <h1 className="text-lg font-semibold text-gray-800">
          Plantilla: <span className="font-normal">{templateTitle}</span>
        </h1>
      </div>
      
      {/* Main grid layout */}
      <div className="w-full max-w-5xl mx-auto grid grid-cols-[180px_1fr_220px]">
        {/* Document toolbar - Word-like menu bar that extends full width */}
        <div className="col-span-3 bg-white border-t border-x border-gray-200 rounded-t px-4 py-1.5 flex items-center space-x-4 text-sm shadow-sm">
          <button className="px-2 py-1 text-gray-700 hover:bg-gray-100 rounded">
            Arxiu
          </button>
          <button className="px-2 py-1 text-gray-700 hover:bg-gray-100 rounded">
            Editar
          </button>
          <button className="px-2 py-1 text-gray-700 hover:bg-gray-100 rounded">
            Visualitzar
          </button>
          <button className="px-2 py-1 text-gray-700 hover:bg-gray-100 rounded">
            Inserir
          </button>
          <button className="px-2 py-1 text-gray-700 hover:bg-gray-100 rounded">
            Format
          </button>
          <div className="ml-auto">
            <button 
              className={`px-3 py-1 rounded text-sm ${iaMode ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}`} 
              onClick={() => {
                const newIaMode = !iaMode;
                setIaMode(newIaMode);
                if (!newIaMode) {
                  setIaPromptsData({}); // Clear active editors
                  setParagraphButtonVisuals({}); // Clear button visuals
                }
              }}
            >
              {iaMode ? 'IA: Actiu' : 'IA: Inactiu'}
            </button>
          </div>
        </div>
        
        {/* Main document area with 3 columns */}
        <div className="col-span-3 grid grid-cols-[180px_1fr_220px] bg-gray-100 border-x border-b border-gray-200 shadow-md">
          {/* Left ruler - now empty */}
          <aside className="flex-shrink-0 border-r border-gray-200 py-2">
            <div className="sticky top-4 pt-2 flex flex-col items-end pr-1">
              <div className="h-80 border-r border-gray-300 pr-1">
                {/* Left rulers removed as requested */}
              </div>
            </div>
          </aside>
        
          {/* Content area - A4 paper style that auto-expands based on content */}
          <div className="flex justify-center py-6 bg-gray-100 min-h-[calc(100vh-140px)]">
            <div
              ref={contentWrapperRef}
              className="relative w-[21cm] bg-white mx-auto border border-gray-300 shadow-lg"
              style={{ minHeight: '29.7cm' }}
              onMouseMove={handleMouseOver}
              onMouseLeave={handleMouseLeave}
            >
              {/* Section and page text removed */}
              {/* Horizontal ruler removed */}
              
              <div className="p-[2.54cm]">
                {convertedHtml ? (
                  <div
                    ref={contentRef}
                    className={`prose max-w-none${iaMode ? ' ia-mode-actiu' : ''}`}
                    dangerouslySetInnerHTML={{ __html: convertedHtml }}
                    onMouseUp={handleTextSelection}
                  />
                ) : (
                  <p className="text-gray-400 italic text-center py-10">Carrega un DOCX per començar.</p>
                )}
              </div>
              
              {/* Word-like status bar at bottom of document */}
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#f3f2f1] border-t border-gray-200 flex items-center justify-between px-3 text-xs text-gray-500">
                <div className="flex items-center space-x-4">
                  <span>Pàgina 1 de 1</span>
                  <span>Paraules: {convertedHtml ? convertedHtml.split(/\s+/).length : 0}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span>Català</span>
                  <span>100%</span>
                </div>
              </div>
              
              {/* Render IA buttons based on paragraphButtonVisuals */}
              {iaMode && Object.entries(paragraphButtonVisuals).map(([pid, visual]) => {
                if (!visual.showButton) return null;
                return (
                  <button
                    key={`btn-${pid}`}
                    className={`absolute left-6 w-6 h-6 text-white rounded-full focus:outline-none flex items-center justify-center text-xs p-0 transition-colors
                                ${visual.hasSavedPrompt ? 'bg-green-600 hover:bg-green-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                    style={{ 
                      top: visual.yButton,
                      transform: 'translateY(-50%)'
                    }}
                    onClick={() => adaptWithIA(pid)}
                    aria-label={`IA per paràgraf ${pid.substring(0,5)}`}
                  >
                    IA
                  </button>
                );
              })}

              {/* Render IA prompt editor boxes */}
              {iaMode && contentWrapperRef.current && Object.entries(iaPromptsData).map(([pid, data]) => {
                if (!data.isActiveEditor) return null;
                return (
                  <div
                    key={`editor-${pid}`}
                    className="absolute left-6 w-[220px] p-2 bg-gray-50 border border-gray-300 rounded shadow-lg text-xs flex flex-col" // Increased width slightly
                    style={{
                      top: data.y,
                      height: `${Math.max(MIN_EDITOR_BOX_HEIGHT, data.height)}px`,
                      transform: 'translateX(calc(-100% - 10px))', // Positioned to the left of the IA button, with a small gap
                      boxSizing: 'border-box',
                      // overflow: 'hidden', // Removed to prevent cutting off content
                    }}
                  >
                    <label htmlFor={`iaPromptInput-${pid}`} className="block text-xs font-medium text-gray-700 mb-1 shrink-0">
                      Prompt IA ({pid.substring(0,5)}...):
                    </label>
                    <textarea
                      ref={el => { iaTextAreaRefs.current[pid] = el; }}
                      id={`iaPromptInput-${pid}`}
                      value={data.currentPrompt}
                      onChange={(e) => {
                        const newText = e.target.value;
                        setIaPromptsData(prev => ({
                          ...prev,
                          [pid]: { ...prev[pid], currentPrompt: newText }
                        }));
                      }}
                      className="w-full p-1 border border-gray-300 rounded shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs grow"
                      style={{ resize: 'none', overflowY: 'auto', minHeight: '30px' }} // Ensure textarea is usable even if paragraph is tiny
                    />
                    <button
                      onClick={() => handleSaveIaPrompt(pid)}
                      className="mt-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 shrink-0"
                    >
                      Desar Prompt
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        
          {/* Sidebar - Word-like document properties panel */}
          <aside className="w-[220px] flex-shrink-0 border-l border-gray-200 bg-[#f3f2f1]">
            <div className="sticky top-4 p-4">
              <div className="bg-white rounded shadow border mb-4">
                <div className="border-b border-gray-200 px-3 py-2 bg-[#f9f9f9]">
                  <h3 className="text-sm font-semibold text-gray-700">Propietats del document</h3>
                </div>
                
                <div className="p-3">
                  {(docxName || excelName) && (
                    <div className="mb-3 text-xs">
                      <div className="font-medium text-gray-600 mb-1">Arxius relacionats:</div>
                      <div className="text-gray-700">
                        {docxName && <div className="flex items-center mb-1">
                          <svg className="w-3 h-3 mr-1 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"></path></svg>
                          {docxName}
                        </div>}
                        {excelName && <div className="flex items-center">
                          <svg className="w-3 h-3 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"></path></svg>
                          {excelName}
                        </div>}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs mb-3">
                    <div className="font-medium text-gray-600 mb-1">Informació del document:</div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-700">
                      <div className="text-gray-500">Creat:</div>
                      <div>{new Date().toLocaleDateString()}</div>
                      <div className="text-gray-500">Modificat:</div>
                      <div>{new Date().toLocaleDateString()}</div>
                      <div className="text-gray-500">Mida:</div>
                      <div>{convertedHtml ? Math.round(convertedHtml.length / 1024) : 0} KB</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Excel headers panel */}
              {excelHeaders.length > 0 && (
                <div className="bg-white rounded shadow border mb-4">
                  <div className="border-b border-gray-200 px-3 py-2 bg-[#f9f9f9]">
                    <h3 className="text-sm font-semibold text-gray-700">Capçaleres d'Excel</h3>
                  </div>
                  <div className="p-3">
                    <div className="text-xs text-gray-500 mb-2">Selecciona per vincular al text:</div>
                    <div className="flex flex-wrap gap-2">
                      {excelHeaders.map(header => (
                        <button
                          key={header}
                          className={`px-2 py-1 rounded text-xs border ${
                            selectedExcelHeader === header ? 'bg-[#2b579a] text-white' : 'bg-white text-[#2b579a] border-[#2b579a]'
                          }`}
                          onClick={() => setSelectedExcelHeader(header)}
                        >
                          {header}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Word-like help panel */}
              <div className="bg-white rounded shadow border">
                <div className="border-b border-gray-200 px-3 py-2 bg-[#f9f9f9]">
                  <h3 className="text-sm font-semibold text-gray-700">Ajuda ràpida</h3>
                </div>
                <div className="p-3">
                  <div className="text-xs text-gray-700 space-y-2">
                    <p>Per inserir un marcador d'Excel al text, selecciona una capçalera i després selecciona el text que vols vincular.</p>
                    <p>Utilitza els botons IA per refinar automàticament el contingut dels paràgrafs.</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default TemplateEditor;
