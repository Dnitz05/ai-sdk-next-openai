import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import * as XLSX from 'xlsx';
import PromptSidebar, { IAPrompt } from './PromptSidebar';
import { 
  calculatePromptPositions, 
  scrollToParagraph, 
  createPromptForParagraph,
  findParagraphElement
} from './PromptPositionUtils';
import './PromptSidebar.css';

// Legacy interfaces kept for backward compatibility
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

  // IA mode is always active
  const iaMode = true; // Always true, no toggle needed
  
  // New prompt management state
  const [prompts, setPrompts] = useState<IAPrompt[]>([]); 
  const [activePromptId, setActivePromptId] = useState<string | null>(null);
  const [hoveredPId, setHoveredPId] = useState<string | null>(null);
  
  // Counter for sequential prompt numbering
  const [nextPromptNumber, setNextPromptNumber] = useState<number>(1);
  
  // Legacy state kept for backward compatibility
  const [iaPromptsData, setIaPromptsData] = useState<Record<string, ParagraphIaData>>({});
  const [paragraphButtonVisuals, setParagraphButtonVisuals] = useState<Record<string, ParagraphButtonVisual>>({});
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

  // Effect to update prompt positions based on paragraph positions
  useEffect(() => {
    if (!iaMode || !contentRef.current || !contentWrapperRef.current) return;
    
    // Calculate updated positions for prompts
    const updatedPrompts = calculatePromptPositions(prompts, contentRef, contentWrapperRef);
    
    // Only update if positions have changed
    if (JSON.stringify(updatedPrompts) !== JSON.stringify(prompts)) {
      setPrompts(updatedPrompts);
    }
    
    // Update paragraph button visuals
    const newVisuals: Record<string, ParagraphButtonVisual> = {};
    const ps = contentRef.current.querySelectorAll('p[data-paragraph-id]');
    const wrapRect = contentWrapperRef.current.getBoundingClientRect();

    ps.forEach(pElement => {
      const pid = (pElement as HTMLElement).dataset.paragraphId!;
      if (!pid) return;

      const rect = pElement.getBoundingClientRect();
      const yButton = (rect.top + rect.height / 2) - wrapRect.top;
      const hasSavedPrompt = !!prompts.find(p => p.paragraphId === pid && (p.status === 'saved' || p.status === 'draft'));
      
      // Show button only if paragraph is hovered or has a prompt
      const showButton = iaMode && (hoveredPId === pid || hasSavedPrompt);
      
      newVisuals[pid] = { yButton, showButton, hasSavedPrompt };
    });
    setParagraphButtonVisuals(newVisuals);
    
  }, [iaMode, convertedHtml, prompts, contentRef, contentWrapperRef, hoveredPId]);

  // Handle mouse over paragraph to track hovered paragraph
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

  // Handle creating or editing a prompt for a paragraph
  const handleParagraphClick = (paragraphId: string) => {
    if (!contentRef.current) return;
    
    // Find the paragraph element
    const pElement = contentRef.current.querySelector(`p[data-paragraph-id="${paragraphId}"]`);
    if (!pElement) return;
    
    // Clear previous highlights
    contentRef.current.querySelectorAll('p.ia-selected').forEach(el => el.classList.remove('ia-selected'));
    pElement.classList.add('ia-selected');
    
    // Check if a prompt already exists for this paragraph
    const existingPromptIndex = prompts.findIndex(p => p.paragraphId === paragraphId);
    
    if (existingPromptIndex >= 0) {
      // If prompt exists, set it as active
      setActivePromptId(prompts[existingPromptIndex].id);
    } else {
      // If no prompt exists, create a new one
      const newPrompt = createPromptForParagraph(
        paragraphId, 
        pElement.textContent || '', 
        contentRef, 
        contentWrapperRef
      );
      
      // Set isEditing to true for the new prompt to open the text box immediately
      // but don't assign an order number yet - it will be assigned when saved
      const newPromptWithEditing = {
        ...newPrompt,
        isEditing: true
      };
      
      setPrompts(prev => [...prev, newPromptWithEditing]);
      setActivePromptId(newPromptWithEditing.id);
    }
    
    // Legacy code for backward compatibility
    const rect = pElement.getBoundingClientRect();
    const wrapRect = contentWrapperRef.current!.getBoundingClientRect();
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
  
  // Handle updating a prompt
  const handlePromptUpdate = (updatedPrompt: IAPrompt) => {
    // Check if this is a save operation (status changing to 'saved')
    const existingPrompt = prompts.find(p => p.id === updatedPrompt.id);
    
    // If the prompt is being saved for the first time (status changing from draft to saved)
    // and it doesn't have an order number yet, assign one
    if (
      existingPrompt && 
      existingPrompt.status !== 'saved' && 
      updatedPrompt.status === 'saved' && 
      !existingPrompt.order && 
      updatedPrompt.content.trim() !== ''
    ) {
      // Assign the next available order number
      updatedPrompt.order = nextPromptNumber;
      // Increment the counter for the next prompt
      setNextPromptNumber(prev => prev + 1);
    }
    
    setPrompts(prev => 
      prev.map(p => p.id === updatedPrompt.id ? updatedPrompt : p)
    );
    
    // Legacy code for backward compatibility
    if (updatedPrompt.paragraphId) {
      setIaPromptsData(prev => {
        const currentEntry = prev[updatedPrompt.paragraphId];
        if (!currentEntry) return prev;
        return {
          ...prev,
          [updatedPrompt.paragraphId]: {
            ...currentEntry,
            savedPrompt: updatedPrompt.content,
            currentPrompt: updatedPrompt.content,
          },
        };
      });
    }
  };
  
  // Handle deleting a prompt
  const handlePromptDelete = (promptId: string) => {
    const promptToDelete = prompts.find(p => p.id === promptId);
    
    if (promptToDelete) {
      setPrompts(prev => prev.filter(p => p.id !== promptId));
      
      // If the deleted prompt was active, clear active prompt
      if (activePromptId === promptId) {
        setActivePromptId(null);
      }
      
      // Legacy code for backward compatibility
      if (promptToDelete.paragraphId) {
        setIaPromptsData(prev => {
          const newData = { ...prev };
          delete newData[promptToDelete.paragraphId];
          return newData;
        });
      }
    }
  };
  
  // Handle selecting a prompt (and scrolling to its paragraph)
  const handlePromptSelect = (paragraphId: string) => {
    // Find the prompt for this paragraph
    const prompt = prompts.find(p => p.paragraphId === paragraphId);
    
    if (prompt) {
      setActivePromptId(prompt.id);
      
      // Scroll to the paragraph
      scrollToParagraph(paragraphId, contentRef, contentWrapperRef);
    }
  };
  
  // Legacy function for backward compatibility
  const adaptWithIA = (paragraphId: string) => {
    handleParagraphClick(paragraphId);
  };
  
  // Legacy function for backward compatibility
  const handleSaveIaPrompt = (paragraphId: string) => {
    const prompt = prompts.find(p => p.paragraphId === paragraphId);
    
    if (prompt) {
      handlePromptUpdate({
        ...prompt,
        status: 'saved',
        updatedAt: new Date()
      });
    } else {
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
    }
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
      {/* Document title - removed as it will be part of the new header */}
      
      {/* Main container with flex to ensure perfect centering */}
      <div className="w-full flex justify-center">
        {/* Grid layout for the content - with equal width sidebars */}
        <div className="grid grid-cols-[280px_1fr_280px]">
          {/* New document header with document properties */}
          <div className="col-span-3 bg-white border-t border-x border-gray-200 rounded-t shadow-sm">
            {/* Main header with title */}
            <div className="px-4 py-3 flex items-center border-b border-gray-200">
              <h1 className="text-lg font-semibold text-gray-800">
                {templateTitle}
              </h1>
              <div className="ml-auto flex items-center">
                <span className="px-3 py-1 rounded text-sm bg-indigo-100 text-indigo-700">
                  IA: Actiu
                </span>
              </div>
            </div>
            
            {/* Document properties section */}
            <div className="px-4 py-2 flex flex-wrap items-center text-xs text-gray-600 gap-x-6">
              {/* Related files */}
              {(docxName || excelName) && (
                <div className="flex items-center gap-3">
                  {docxName && (
                    <div className="flex items-center">
                      <svg className="w-3 h-3 mr-1 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"></path>
                      </svg>
                      <span>{docxName}</span>
                    </div>
                  )}
                  {excelName && (
                    <div className="flex items-center">
                      <svg className="w-3 h-3 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z"></path>
                      </svg>
                      <span>{excelName}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Document info */}
              <div className="flex items-center gap-3">
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">Creat:</span>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">Modificat:</span>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">Mida:</span>
                  <span>{convertedHtml ? Math.round(convertedHtml.length / 1024) : 0} KB</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Main document area with 3 columns - equal width sidebars */}
          <div className="col-span-3 grid grid-cols-[280px_1fr_280px] bg-gray-100 border-x border-b border-gray-200 shadow-md">
          {/* Left sidebar - Prompt sidebar - always visible */}
          <PromptSidebar
            prompts={prompts}
            documentRef={contentRef}
            contentWrapperRef={contentWrapperRef}
            onPromptUpdate={handlePromptUpdate}
            onPromptDelete={handlePromptDelete}
            onPromptSelect={handlePromptSelect}
            activePromptId={activePromptId}
          />
        
          {/* Content area - A4 paper style that auto-expands based on content */}
          <div className="flex justify-center py-6 bg-gray-100 min-h-[calc(100vh-140px)]">
            <div
              ref={contentWrapperRef}
              className="relative w-[21cm] bg-white mx-auto border border-gray-300 shadow-lg"
              style={{ minHeight: '29.7cm' }}
              onMouseMove={handleMouseOver}
              onMouseLeave={handleMouseLeave}
            >
              <div className="p-[2.54cm]">
                {convertedHtml ? (
                  <div
                    ref={contentRef}
                    className="prose max-w-none"
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
              
              {/* Circular IA buttons for each paragraph - only shown on hover or if has prompt */}
              {iaMode && Object.entries(paragraphButtonVisuals).map(([pid, visual]) => {
                if (!visual.showButton) return null;
                
                // Check if this paragraph has an associated prompt
                const promptForParagraph = prompts.find(p => p.paragraphId === pid);
                const hasPrompt = !!promptForParagraph;
                const isActive = promptForParagraph?.id === activePromptId;
                
                // Get the prompt number for display - only show if prompt has an order number
                // (which means it has been saved with content)
                const promptNumber = promptForParagraph?.order || '';
                
                return (
                  <button
                    key={`btn-${pid}`}
                    className={`absolute left-6 w-6 h-6 text-white rounded-full focus:outline-none flex items-center justify-center text-xs p-0 transition-colors
                              ${isActive 
                                ? 'bg-indigo-600 ring-2 ring-indigo-300' 
                                : hasPrompt 
                                  ? 'bg-green-600 hover:bg-green-500' 
                                  : 'bg-indigo-600 hover:bg-indigo-500'}`}
                    style={{ 
                      top: visual.yButton,
                      transform: 'translateY(-50%)',
                      opacity: hoveredPId === pid || hasPrompt || isActive ? 1 : 0.8,
                      transition: 'opacity 0.2s ease'
                    }}
                    onClick={() => handleParagraphClick(pid)}
                    aria-label={`IA per paràgraf ${pid.substring(0,5)}`}
                  >
                    {/* Only show number if prompt has been saved with content */}
                    {hasPrompt && promptForParagraph?.status === 'saved' && promptNumber ? promptNumber : ''}
                  </button>
                );
              })}
              
              {/* Dotted line connectors between prompts and paragraphs */}
              {iaMode && prompts.map(prompt => {
                const paragraph = findParagraphElement(prompt.paragraphId, contentRef);
                if (!paragraph || !contentWrapperRef.current) return null;
                
                const paragraphRect = paragraph.getBoundingClientRect();
                const wrapperRect = contentWrapperRef.current.getBoundingClientRect();
                const y = paragraphRect.top + (paragraphRect.height / 2) - wrapperRect.top;
                
                return (
                  <div
                    key={`connector-${prompt.id}`}
                    className="absolute left-0 h-0.5 border-t border-dashed border-gray-400"
                    style={{
                      top: y,
                      width: '20px',
                      transform: 'translateY(-50%)'
                    }}
                  />
                );
              })}
            </div>
          </div>
        
          {/* Sidebar - Excel headers and help panel - width updated to match left sidebar */}
          <aside className="w-[280px] flex-shrink-0 border-l border-gray-200 bg-[#f3f2f1]">
            <div className="sticky top-4 p-4">
              
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
                    <p>Passa el ratolí sobre un paràgraf per veure el botó d'IA i fes-hi clic per afegir o editar un prompt.</p>
                    <p>Els prompts es mostren a la barra lateral esquerra, ordenats segons la posició al document.</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
          </div>
        </div>
      </div>
      
      {/* Add CSS for highlight effect */}
      <style jsx global>{`
        .highlight-paragraph {
          background-color: rgba(79, 70, 229, 0.1);
          transition: background-color 0.3s ease;
        }
        
        .ia-selected {
          background-color: rgba(79, 70, 229, 0.1);
        }
      `}</style>
    </main>
  );
};

export default TemplateEditor;
