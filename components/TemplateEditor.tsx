import React, { useState, useEffect, useRef, ChangeEvent, MouseEvent, useMemo } from 'react';
import * as XLSX from 'xlsx';

const TemplateEditor: React.FC<{ initialTemplateData: any; mode: 'edit' | 'new' }> = ({ initialTemplateData, mode }) => {
  // --- Estats bàsics ---
  const templateTitle = initialTemplateData?.config_name || '';
  const docxName = initialTemplateData?.base_docx_name || '';
  const excelName = initialTemplateData?.excel_file_name || '';
  const excelHeaders = initialTemplateData?.excel_headers || [];
  const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null);
  const [links, setLinks] = useState<{ id: string; excelHeader: string; selectedText: string }[]>(initialTemplateData?.link_mappings || []);
  const [convertedHtml, setConvertedHtml] = useState<string | null>(initialTemplateData?.final_html || null);
  const contentRef = useRef<HTMLDivElement>(null);

  // IA: paràgraf seleccionat, prompt, llista d'instruccions
  const [aiTargetParagraphId, setAiTargetParagraphId] = useState<string | null>(null);
  const [aiUserPrompt, setAiUserPrompt] = useState('');
  const [aiInstructions, setAiInstructions] = useState<{ id: string; prompt: string; originalText: string }[]>(initialTemplateData?.ai_instructions || []);
  const [iaInstructionsMode, setIaInstructionsMode] = useState(false);

  // Afegir/treure hover als paràgrafs quan la IA està activa
  // Hover i selecció de paràgrafs per IA
  useEffect(() => {
    if (contentRef.current) {
      const paragraphs = contentRef.current.querySelectorAll('p');
      paragraphs.forEach(p => {
        // Gestiona hover
        if (iaInstructionsMode) {
          p.classList.add('ia-hover');
        } else {
          p.classList.remove('ia-hover');
        }
        // Gestiona selecció permanent
        if (aiTargetParagraphId && p.dataset.paragraphId === aiTargetParagraphId) {
          p.classList.add('ia-selected');
        } else {
          p.classList.remove('ia-selected');
        }
      });
    }
  }, [iaInstructionsMode, convertedHtml, aiTargetParagraphId]);

  // Handler de selecció de text per mapping
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
        const updatedHtml = contentRef.current.innerHTML;
        setConvertedHtml(updatedHtml);
        setLinks(prevLinks => [...prevLinks, { id: linkId, excelHeader: selectedExcelHeader, selectedText: selectedExcelHeader }]);
      } catch (error) {
        alert("Error vinculant.");
      } finally {
        selection.removeAllRanges();
        setSelectedExcelHeader(null);
      }
    }
  };

  // Handler de selecció de paràgraf per IA
  const handleContentClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!convertedHtml) return;
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
      if (htmlNeedsUpdate && contentRef.current) {
        setConvertedHtml(contentRef.current.innerHTML);
      }
      const existingInstruction = aiInstructions.find(instr => instr.id === paragraphId);
      setAiTargetParagraphId(paragraphId);
      setAiUserPrompt(existingInstruction?.prompt || '');
    } else {
      if (aiTargetParagraphId) {
        setAiTargetParagraphId(null);
        setAiUserPrompt('');
      }
    }
  };

  // Handler de desar instrucció IA
  const handleSaveAiInstruction = () => {
    if (!aiUserPrompt.trim() || !aiTargetParagraphId || !contentRef.current) {
      alert("Selecciona paràgraf i escriu instrucció.");
      return;
    }
    const targetParagraph = contentRef.current.querySelector<HTMLParagraphElement>(`p[data-paragraph-id="${aiTargetParagraphId}"]`);
    if (targetParagraph) {
      const originalText = targetParagraph.textContent || "";
      setAiInstructions(prev => {
        const index = prev.findIndex(i => i.id === aiTargetParagraphId);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = { id: aiTargetParagraphId, prompt: aiUserPrompt, originalText: updated[index].originalText || originalText };
          return updated;
        } else {
          return [...prev, { id: aiTargetParagraphId, prompt: aiUserPrompt, originalText }];
        }
      });
      // NO deseleccionem el paràgraf després de desar la instrucció
      setAiUserPrompt('');
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">
      {/* Capçalera */}
      <div className="w-full max-w-4xl mx-auto flex items-center mb-4 sm:mb-6 px-1">
        <h1 className="text-2xl font-bold text-gray-800">{templateTitle}</h1>
      </div>
      <div className="flex w-full max-w-6xl gap-x-6 px-1">
        {/* Foli blanc */}
        <div className="flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-0">
          {convertedHtml ? (
            <div
              ref={contentRef}
              className="prose max-w-5xl mx-auto bg-white p-4 rounded"
              dangerouslySetInnerHTML={{ __html: convertedHtml }}
              onMouseUp={handleTextSelection}
              onClick={iaInstructionsMode ? handleContentClick : undefined}
              style={{ cursor: iaInstructionsMode ? 'pointer' : 'auto' }}
            />
          ) : (
            <p className="text-gray-400 italic text-center py-10">
              Carrega un DOCX per començar.
            </p>
          )}
        </div>
        {/* Sidebar */}
        <aside className="w-80 flex-shrink-0 my-0 relative">
          <div className="sticky top-4 p-4 bg-white rounded shadow-lg border max-h-[calc(100vh-2rem)] overflow-y-auto flex flex-col">
            {/* Info: Editant: docx amb excel */}
            {(docxName || excelName) && (
              <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 font-medium">
                Editant: {docxName}
                {excelName && (
                  <>
                    {' '}<span className="text-gray-500">amb</span> <span className="font-semibold">{excelName}</span>
                  </>
                )}
              </div>
            )}
            {/* Mapping Excel */}
            {excelHeaders.length > 0 && (
              <div className="mt-6">
                <h3 className="text-md font-semibold text-gray-700 mb-2">Capçaleres d'Excel</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {excelHeaders.map((header: string) => (
                    <button
                      key={header}
                      className={`px-3 py-1 rounded border ${
                        selectedExcelHeader === header
                          ? 'bg-blue-600 text-white border-blue-700'
                          : 'bg-gray-100 text-blue-700 border-blue-300 hover:bg-blue-200'
                      }`}
                      onClick={() => setSelectedExcelHeader(header)}
                    >
                      {header}
                    </button>
                  ))}
                </div>
                {selectedExcelHeader && (
                  <div className="text-xs text-blue-700 mb-2">
                    Selecciona text al document per vincular amb: <b>{selectedExcelHeader}</b>
                  </div>
                )}
              </div>
            )}
            {/* Panell d'instruccions IA */}
            <div className="mt-8">
              <h3 className="text-md font-semibold text-indigo-700 mb-2 flex items-center gap-2">
                Instruccions IA
                <button
                  className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${iaInstructionsMode ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-indigo-700'}`}
                  onClick={() => setIaInstructionsMode(v => !v)}
                >
                  {iaInstructionsMode ? 'Mode IA: ACTIU' : 'Mode IA: Inactiu'}
                </button>
              </h3>
              {iaInstructionsMode && (
                <div className="flex flex-col gap-2">
                  <textarea
                    className={`w-full border rounded p-2 text-sm transition-colors duration-150 ${
                      aiTargetParagraphId ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'
                    }`}
                    rows={3}
                    placeholder="Escriu una instrucció per la IA (ex: Resumeix aquest paràgraf...)"
                    value={aiUserPrompt}
                    onChange={e => setAiUserPrompt(e.target.value)}
                  />
                  <button
                    className="self-end px-4 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                    onClick={handleSaveAiInstruction}
                  >
                    Desa instrucció IA
                  </button>
                </div>
              )}
              {/* Llista d'instruccions IA */}
              {aiInstructions.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {aiInstructions.map((instr, idx) => (
                    <li
                      key={instr.id}
                      className={`p-2 border rounded bg-indigo-50 text-gray-700 cursor-pointer transition-colors duration-150 ${
                        aiTargetParagraphId === instr.id ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => {
                        setAiTargetParagraphId(instr.id);
                        setAiUserPrompt(instr.prompt);
                        // Scroll al paràgraf associat
                        if (contentRef.current) {
                          const p = contentRef.current.querySelector(`p[data-paragraph-id="${instr.id}"]`);
                          if (p) p.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                    >
                      <span className="font-medium text-indigo-800">Inst. {idx + 1}:</span> {instr.prompt}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default TemplateEditor;