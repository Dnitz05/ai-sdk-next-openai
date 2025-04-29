import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import * as XLSX from 'xlsx';

interface TemplateEditorProps {
  initialTemplateData: any;
  mode: 'edit' | 'new';
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ initialTemplateData, mode }) => {
  const templateTitle = initialTemplateData?.config_name || '';
  const docxName = initialTemplateData?.base_docx_name || '';
  const excelName = initialTemplateData?.excel_file_name || '';
  const excelHeaders: string[] = initialTemplateData?.excel_headers || [];

  const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null);
  const [convertedHtml, setConvertedHtml] = useState<string>(initialTemplateData?.final_html || '');
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // IA mode hover/adapt state
const [iaMode, setIaMode] = useState(true);
  const [hoveredParagraphId, setHoveredParagraphId] = useState<string | null>(null);
  const [hoverY, setHoverY] = useState<number>(0);
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  const [iaPrompt, setIaPrompt] = useState<string>('');

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

  const handleMouseOver = (e: MouseEvent<HTMLDivElement>) => {
    if (!iaMode) return;
    const target = e.target as HTMLElement;
    const p = target.closest('p');
    if (p && contentRef.current?.contains(p) && contentWrapperRef.current) {
      const id = p.dataset.paragraphId!;
      const rect = p.getBoundingClientRect();
      const wrapRect = contentWrapperRef.current.getBoundingClientRect();
      setHoveredParagraphId(id);
      setHoverY(rect.top - wrapRect.top);
    }
  };

  /* Removed handleMouseLeave to keep IA button visible when moving pointer to button */

  const adaptWithIA = (id: string) => {
    if (!contentRef.current) return;
    const p = contentRef.current.querySelector(`p[data-paragraph-id="${id}"]`);
    if (!p) return;
    // clear previous highlight
    contentRef.current.querySelectorAll('p.ia-selected').forEach(el => el.classList.remove('ia-selected'));
    p.classList.add('ia-selected');
    setActiveParagraphId(id);
    setIaPrompt(`Refina automàticament aquest paràgraf: "${p.textContent}"`);
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
      <div className="w-full max-w-5xl mx-auto mb-3 px-4 flex items-center">
        <h1 className="text-lg font-semibold text-gray-800">
          Plantilla: <span className="font-normal">{templateTitle}</span>
        </h1>
      </div>
      
      {/* Document toolbar - Word-like menu bar with formatting options */}
      <div className="w-full max-w-5xl mx-auto">
        {/* Main menu bar */}
        <div className="bg-white border-t border-x border-gray-200 rounded-t px-4 py-1.5 flex items-center space-x-4 text-sm shadow-sm">
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
            <button className={`px-3 py-1 rounded text-sm ${iaMode ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'}`} onClick={() => setIaMode(!iaMode)}>
              {iaMode ? 'IA: Actiu' : 'IA: Inactiu'}
            </button>
          </div>
        </div>

        {/* Formatting toolbar - Similar to Word formatting ribbon */}
        <div className="bg-[#f3f2f1] border-x border-b border-gray-200 px-4 py-1 flex items-center space-x-2 text-xs">
          <div className="flex items-center space-x-1 pr-2 border-r border-gray-300">
            <select className="bg-white border border-gray-300 rounded px-1 py-0.5 text-xs">
              <option>Calibri</option>
              <option>Arial</option>
              <option>Times New Roman</option>
            </select>
            <select className="bg-white border border-gray-300 rounded px-1 py-0.5 text-xs w-10">
              <option>11</option>
              <option>12</option>
              <option>14</option>
            </select>
          </div>
          <div className="flex items-center space-x-1 px-2">
            <button className="p-1 hover:bg-gray-200 rounded" title="Negreta">B</button>
            <button className="p-1 hover:bg-gray-200 rounded italic" title="Cursiva">I</button>
            <button className="p-1 hover:bg-gray-200 rounded underline" title="Subratllat">U</button>
          </div>
          <div className="flex items-center space-x-1 px-2 border-l border-r border-gray-300">
            <button className="p-1 hover:bg-gray-200 rounded" title="Alineació esquerra">≡</button>
            <button className="p-1 hover:bg-gray-200 rounded" title="Centrat">≡</button>
            <button className="p-1 hover:bg-gray-200 rounded" title="Alineació dreta">≡</button>
          </div>
          <div className="flex items-center space-x-1 px-2">
            <button className="px-2 py-0.5 hover:bg-gray-200 rounded text-xs" title="Inserir taula">Taula</button>
            <button className="px-2 py-0.5 hover:bg-gray-200 rounded text-xs" title="Inserir imatge">Imatge</button>
          </div>
        </div>
      </div>
      
      <div className="grid w-full max-w-5xl mx-auto grid-cols-[180px_1fr_220px] bg-gray-100 border-x border-gray-200 shadow-md">
        {/* Left ruler - Similar to Word left margin */}
        <aside className="flex-shrink-0 border-r border-gray-200 py-2">
          <div className="sticky top-4 pt-2 flex flex-col items-end pr-1">
            <div className="w-full mb-2 flex justify-end">
              <span className="text-gray-400 text-xs">Marges</span>
            </div>
            <div className="h-80 border-r border-gray-300 pr-1">
              <div className="h-6 flex items-center justify-end">
                <span className="text-gray-500 text-xs">1</span>
              </div>
              <div className="h-6 flex items-center justify-end">
                <span className="text-gray-500 text-xs">2</span>
              </div>
              <div className="h-6 flex items-center justify-end">
                <span className="text-gray-500 text-xs">3</span>
              </div>
            </div>
          </div>
        </aside>
        
        {/* Content area - A4 paper style */}
        <div className="flex justify-center py-6 bg-gray-100 min-h-[calc(100vh-140px)]">
          <div
            ref={contentWrapperRef}
            className="relative w-[21cm] h-[29.7cm] bg-white mx-auto border border-gray-300 shadow-lg"
            style={{ minHeight: '29.7cm' }}
            onMouseMove={handleMouseOver}
          >
            <div className="absolute top-0 left-0 right-0 h-6 flex items-center justify-between px-2 border-b border-gray-100">
              <div className="text-xs text-gray-400">Secció 1</div>
              <div className="text-xs text-gray-400">Pàgina 1</div>
            </div>
            
            {/* Top horizontal ruler (similar to Word) */}
            <div className="absolute top-6 left-0 right-0 h-6 border-b border-gray-100 px-[2.54cm]">
              <div className="flex items-center h-full">
                <div className="w-full flex justify-between text-[9px] text-gray-400">
                  <span>|</span>
                  <span>|</span>
                  <span>|</span>
                  <span>|</span>
                  <span>|</span>
                  <span>|</span>
                  <span>|</span>
                  <span>|</span>
                  <span>|</span>
                  <span>|</span>
                </div>
              </div>
            </div>
            
            <div className="p-[2.54cm] mt-6">
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
            
            {iaMode && hoveredParagraphId && (
              <button
                className="absolute left-6 w-6 h-6 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 focus:outline-none flex items-center justify-center text-xs p-0"
                style={{ top: hoverY + 40 }} /* Adjusted position to account for new layout */
                onClick={() => adaptWithIA(hoveredParagraphId)}
                aria-label="IA"
              >
                IA
              </button>
            )}
            
            {iaMode && activeParagraphId && iaPrompt && contentWrapperRef.current && (
              <div
                className="absolute left-6 top-20 transform translate-x-[-110%] w-[200px] p-2 bg-gray-50 border rounded shadow text-xs"
                style={{
                  top: contentRef.current 
                    ? contentRef.current.querySelector(`p[data-paragraph-id="${activeParagraphId}"]`)
                      ? contentRef.current.querySelector(`p[data-paragraph-id="${activeParagraphId}"]`)!.getBoundingClientRect().top - 
                        contentWrapperRef.current.getBoundingClientRect().top + 40
                      : 40
                    : 40
                }}
              >
                <strong>Prompt IA:</strong> {iaPrompt}
              </div>
            )}
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
    </main>
  );
};

export default TemplateEditor;
