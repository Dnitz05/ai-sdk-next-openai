import React, { useState, useEffect, useRef, MouseEvent } from 'react';
import * as XLSX from 'xlsx';

const TemplateEditor: React.FC<{ initialTemplateData: any; mode: 'edit' | 'new' }> = ({ initialTemplateData, mode }) => {
  // Basic states
  const templateTitle = initialTemplateData?.config_name || '';
  const docxName = initialTemplateData?.base_docx_name || '';
  const excelName = initialTemplateData?.excel_file_name || '';
  const excelHeaders = initialTemplateData?.excel_headers || [];
  const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null);
  const [links, setLinks] = useState<{ id: string; excelHeader: string; selectedText: string }[]>(initialTemplateData?.link_mappings || []);
  const [convertedHtml, setConvertedHtml] = useState<string>(initialTemplateData?.final_html || '');
  const contentRef = useRef<HTMLDivElement>(null);

  // AI mode state
  const [iaInstructionsMode, setIaInstructionsMode] = useState(false);
  // IA prompt: paragraph highlighted per enviar a la IA
  const [aiTargetParagraphId, setAiTargetParagraphId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState<string>('');

  // Ensure unique paragraph IDs
  useEffect(() => {
    if (contentRef.current) {
      const paragraphs = contentRef.current.querySelectorAll('p');
      let updated = false;
      paragraphs.forEach(p => {
        if (!p.dataset.paragraphId) {
          p.dataset.paragraphId = `p-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          updated = true;
        }
      });
      if (updated) {
        setConvertedHtml(contentRef.current.innerHTML);
      }
    }
  }, [convertedHtml]);

  // Excel text selection mapping
  const handleTextSelection = () => {
    if (!convertedHtml || !selectedExcelHeader) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0 && contentRef.current) {
      const originalSelectedText = selection.toString();
      if (!originalSelectedText.trim()) {
        selection.removeAllRanges();
        return;
      }
      const range = selection.getRangeAt(0);
      if (!contentRef.current.contains(range.commonAncestorContainer)) {
        selection.removeAllRanges();
        setSelectedExcelHeader(null);
        return;
      }
      const linkId = `link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const span = document.createElement('span');
      span.className = 'linked-placeholder';
      span.dataset.excelHeader = selectedExcelHeader;
      span.dataset.linkId = linkId;
      span.textContent = selectedExcelHeader;
      try {
        range.deleteContents();
        range.insertNode(span);
        setConvertedHtml(contentRef.current.innerHTML);
        setLinks(prev => [...prev, { id: linkId, excelHeader: selectedExcelHeader, selectedText: selectedExcelHeader }]);
      } catch {
        alert("Error vinculant.");
      } finally {
        selection.removeAllRanges();
        setSelectedExcelHeader(null);
      }
    }
  };

  // Inline editing in AI mode
  const handleContentClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!convertedHtml || !iaInstructionsMode) return;
    const target = event.target as HTMLElement;
    const targetParagraph = target.closest('p');
    if (targetParagraph && contentRef.current?.contains(targetParagraph)) {
      if (!targetParagraph.dataset.paragraphId) {
        targetParagraph.dataset.paragraphId = `p-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }
      targetParagraph.setAttribute('contenteditable', 'true');
      targetParagraph.focus();
      const commit = () => {
        targetParagraph.removeAttribute('contenteditable');
        if (contentRef.current) {
          contentRef.current.querySelectorAll('p.ia-selected').forEach(p => p.classList.remove('ia-selected'));
          targetParagraph.classList.add('ia-selected');
          setConvertedHtml(contentRef.current.innerHTML);
        }
        // Genera prompt per a IA
        const newText = targetParagraph.textContent || '';
        const prompt = `Refina automàticament aquest paràgraf: "${newText}"`;
        setAiTargetParagraphId(targetParagraph.dataset.paragraphId!);
        setAiPrompt(prompt);
      };
      targetParagraph.addEventListener('blur', commit, { once: true });
      targetParagraph.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          targetParagraph.blur();
        }
      }, { once: true });
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">
      {/* Header */}
      <div className="w-full max-w-4xl mx-auto mb-4">
        <h1 className="text-2xl font-bold text-gray-800">{templateTitle}</h1>
      </div>
      <div className="flex w-full max-w-6xl gap-x-6" style={{ position: 'relative' }}>
        {/* Document content */}
        <div className="flex-grow print-content bg-white shadow-lg rounded-sm p-8">
          {convertedHtml ? (
            <div
              ref={contentRef}
              className={`prose max-w-5xl mx-auto bg-white p-4 rounded${iaInstructionsMode ? ' ia-mode-actiu' : ''}`}
              dangerouslySetInnerHTML={{ __html: convertedHtml }}
              onMouseUp={handleTextSelection}
              onClick={iaInstructionsMode ? handleContentClick : undefined}
              style={{ cursor: iaInstructionsMode ? 'pointer' : 'auto' }}
            />
          ) : (
            <p className="text-gray-400 italic text-center py-10">Carrega un DOCX per començar.</p>
          )}
        </div>
        {/* Sidebar */}
        <aside className="w-80 flex-shrink-0 relative">
          <div className="sticky top-4 p-4 bg-white rounded shadow-lg border overflow-y-auto">
            {(docxName || excelName) && (
              <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                Editant: {docxName}{excelName && <> amb <span className="font-semibold">{excelName}</span></>}
              </div>
            )}
            {excelHeaders.length > 0 && (
              <div className="mb-4">
                <h3 className="text-md font-semibold text-gray-700 mb-2">Capçaleres d'Excel</h3>
                <div className="flex flex-wrap gap-2">
                  {excelHeaders.map((header: string) => (
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
            <div>
              <h3 className="text-md font-semibold text-indigo-700 mb-2 flex items-center">
                Instruccions IA
                <button
                  className={`ml-2 px-2 py-1 rounded text-xs ${
                    iaInstructionsMode ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-indigo-700'
                  }`}
                  onClick={() => setIaInstructionsMode(v => !v)}
                >
                  {iaInstructionsMode ? 'ACTIU' : 'Inactiu'}
                </button>
              </h3>
              {iaInstructionsMode && (
                <>
                  <p className="text-xs italic">Fes clic sobre un paràgraf per editar.</p>
                  {aiPrompt && (
                    <div className="mt-2 p-2 bg-gray-50 text-xs border rounded text-gray-700">
                      <strong>Prompt IA:</strong> {aiPrompt}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default TemplateEditor;