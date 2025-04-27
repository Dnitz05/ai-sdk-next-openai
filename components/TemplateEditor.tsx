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
    <main className="flex min-h-screen w-full flex-col items-center bg-gray-100">
      <div className="w-full max-w-4xl mx-auto mb-4">
        <h1 className="text-2xl font-bold text-gray-800">{templateTitle}</h1>
      </div>
      <div className="grid w-full max-w-7xl mx-auto grid-cols-[1fr_auto] gap-x-[6px]">
        {/* Content area */}
        <div
          ref={contentWrapperRef}
          className="relative w-full justify-self-center bg-white p-4 rounded shadow"
          onMouseMove={handleMouseOver}
        >
          {convertedHtml ? (
            <div
              ref={contentRef}
              className={`prose max-w-none bg-white p-4 rounded${iaMode ? ' ia-mode-actiu' : ''}`}
              dangerouslySetInnerHTML={{ __html: convertedHtml }}
              onMouseUp={handleTextSelection}
            />
          ) : (
            <p className="text-gray-400 italic text-center py-10">Carrega un DOCX per començar.</p>
          )}
          {iaMode && hoveredParagraphId && (
            <button
              className="absolute left-[-40px] w-6 h-6 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 focus:outline-none flex items-center justify-center text-xs p-0"
              style={{ top: hoverY }}
              onClick={() => adaptWithIA(hoveredParagraphId)}
              aria-label="IA"
            >
              IA
            </button>
          )}
          {iaMode && activeParagraphId && iaPrompt && contentWrapperRef.current && (
            <div
              className="absolute left-[-54px] transform -translate-x-full w-[35%] p-2 bg-gray-50 border rounded shadow text-xs"
              style={{
                top:
                  contentRef.current!
                    .querySelector(`p[data-paragraph-id="${activeParagraphId}"]`)!
                    .getBoundingClientRect().top -
                  contentWrapperRef.current!.getBoundingClientRect().top
              }}
            >
              <strong>Prompt IA:</strong> {iaPrompt}
            </div>
          )}
        </div>
        {/* Sidebar */}
        <aside className="w-48 flex-shrink-0">
          <div className="sticky top-4 p-4 bg-white rounded shadow border">
            {(docxName || excelName) && (
              <div className="mb-4 p-2 bg-blue-50 border-blue-200 rounded text-xs text-blue-800">
                Editant: {docxName}
                {excelName && <> amb <span className="font-semibold">{excelName}</span></>}
              </div>
            )}
            {excelHeaders.length > 0 && (
              <div className="mb-4">
                <h3 className="text-md font-semibold text-gray-700 mb-2">Capçaleres d'Excel</h3>
                <div className="flex flex-wrap gap-2">
                  {excelHeaders.map(header => (
                    <button
                      key={header}
                      className={`px-3 py-1 rounded border ${
                        selectedExcelHeader === header ? 'bg-blue-600 text-white' : 'bg-gray-100 text-blue-700'
                      }`}
                      onClick={() => setSelectedExcelHeader(header)}
                    >
                      {header}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
};

export default TemplateEditor;