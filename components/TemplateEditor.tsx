import React, { useState, useEffect, useRef, ChangeEvent, MouseEvent, useMemo } from 'react';
import * as XLSX from 'xlsx';

// Component auxiliar per editar el paràgraf inline
const InlineParagraphEditor = ({
  containerId,
  value,
  onChange,
  onSave,
  onCancel,
}: {
  containerId: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
      // Contenidor principal: flex row
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'flex-start';

      // Botons a l'esquerra
      const btnsDiv = document.createElement('div');
      btnsDiv.style.display = 'flex';
      btnsDiv.style.flexDirection = 'column';
      btnsDiv.style.gap = '0.5em';
      btnsDiv.style.marginRight = '0.5em';

      const btnSave = document.createElement('button');
      btnSave.textContent = 'Desa';
      btnSave.className = 'px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs mb-1 ml-[-0.5em]';
      btnSave.onclick = onSave;
      btnsDiv.appendChild(btnSave);

      const btnCancel = document.createElement('button');
      btnCancel.textContent = 'Cancel·la';
      btnCancel.className = 'px-2 py-0.5 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-xs ml-[-0.5em]';
      btnCancel.onclick = onCancel;
      btnsDiv.appendChild(btnCancel);

      // Textarea a la dreta
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.className = 'w-full border rounded p-2 text-xs mb-2';
      textarea.rows = 3;
      textarea.oninput = (e: any) => onChange(e.target.value);

      wrapper.appendChild(btnsDiv);
      wrapper.appendChild(textarea);

      container.appendChild(wrapper);

      textarea.focus();
    }
  }, [containerId, value, onChange, onSave, onCancel]);
  return null;
};

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

  // Edició ràpida: estat per saber quin paràgraf està en mode edició i el seu valor
  const [editingParagraphId, setEditingParagraphId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<string>('');

  // IA: paràgraf seleccionat, prompt, llista d'instruccions
  const [aiTargetParagraphId, setAiTargetParagraphId] = useState<string | null>(null);
  const [aiUserPrompt, setAiUserPrompt] = useState('');
  // Evita que la selecció es perdi si el paràgraf seleccionat desapareix temporalment
  useEffect(() => {
    if (aiTargetParagraphId && contentRef.current) {
      const p = contentRef.current.querySelector(`p[data-paragraph-id="${aiTargetParagraphId}"]`);
      if (!p) {
        // El paràgraf seleccionat no existeix, però no esborrem la selecció
        // (no fem setAiTargetParagraphId(null))
      }
    }
  }, [aiTargetParagraphId, convertedHtml]);
  const [aiInstructions, setAiInstructions] = useState<{ id: string; prompt: string; originalText: string }[]>(initialTemplateData?.ai_instructions || []);
  const [iaInstructionsMode, setIaInstructionsMode] = useState(false);

  // Afegir/treure hover als paràgrafs quan la IA està activa
  // Hover i selecció de paràgrafs per IA
  // Només gestiona la selecció permanent via JS, el hover es fa via CSS
  useEffect(() => {
    if (contentRef.current) {
      const paragraphs = contentRef.current.querySelectorAll('p');
      paragraphs.forEach(p => {
        // Gestiona selecció permanent
        if (aiTargetParagraphId && p.dataset.paragraphId === aiTargetParagraphId) {
          p.classList.add('ia-selected');
        } else {
          p.classList.remove('ia-selected');
        }
      });
    }
  }, [convertedHtml, aiTargetParagraphId]);

  // Assegura que tots els <p> tinguin un data-paragraph-id únic i persistent
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
      // Si s'han assignat nous id, actualitza el HTML per persistir-los
      if (updated) {
        setConvertedHtml(contentRef.current.innerHTML);
      }
    }
  }, [convertedHtml]);

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
  // Edició ràpida: click sobre paràgraf per editar-lo directament
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
      // Troba el prompt associat o el text original
      const existingInstruction = aiInstructions.find(instr => instr.id === paragraphId);
      setEditingParagraphId(paragraphId);
      setEditingPrompt(existingInstruction?.prompt || targetParagraph.textContent || '');
    }
  };

  // Handler de desar instrucció IA
  // Elimina la lògica de desar instrucció a la barra lateral: només es desa al document
  const handleSaveAiInstruction = () => {};

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
            <>
              <div
                ref={contentRef}
                className={`prose max-w-5xl mx-auto bg-white p-4 rounded${iaInstructionsMode ? ' ia-mode-actiu' : ''}`}
                dangerouslySetInnerHTML={{
                  __html: editingParagraphId
                    ? convertedHtml.replace(
                        new RegExp(
                          `<p([^>]*data-paragraph-id=["']${editingParagraphId}["'][^>]*)>([\\s\\S]*?)<\\/p>`,
                          'i'
                        ),
                        `<div id="react-edit-p-${editingParagraphId}"></div>`
                      )
                    : convertedHtml,
                }}
                onMouseUp={handleTextSelection}
                onClick={iaInstructionsMode ? handleContentClick : undefined}
                style={{ cursor: iaInstructionsMode ? 'pointer' : 'auto' }}
              />
              {/* Renderitza el textarea React dins el placeholder */}
              {editingParagraphId && (
                <InlineParagraphEditor
                  containerId={`react-edit-p-${editingParagraphId}`}
                  value={editingPrompt}
                  onChange={setEditingPrompt}
                  onSave={() => {
                    // Desa la instrucció i substitueix el paràgraf pel prompt
                    setAiInstructions(prev => {
                      const idx = prev.findIndex(i => i.id === editingParagraphId);
                      if (idx > -1) {
                        const updated = [...prev];
                        updated[idx] = { ...updated[idx], prompt: editingPrompt };
                        return updated;
                      }
                      // Si no existeix, afegeix nova instrucció
                      return [...prev, { id: editingParagraphId, prompt: editingPrompt, originalText: '' }];
                    });
                    // Substitueix el <div> pel <p> amb el prompt
                    if (contentRef.current) {
                      const html = contentRef.current.innerHTML.replace(
                        `<div id="react-edit-p-${editingParagraphId}"></div>`,
                        `<p data-paragraph-id="${editingParagraphId}">${editingPrompt}</p>`
                      );
                      setConvertedHtml(html);
                    }
                    setEditingParagraphId(null);
                    setEditingPrompt('');
                  }}
                  onCancel={() => {
                    // Cancel·la l'edició i restaura el paràgraf original
                    if (contentRef.current) {
                      const original = aiInstructions.find(i => i.id === editingParagraphId)?.prompt || '';
                      const html = contentRef.current.innerHTML.replace(
                        `<div id="react-edit-p-${editingParagraphId}"></div>`,
                        `<p data-paragraph-id="${editingParagraphId}">${original}</p>`
                      );
                      setConvertedHtml(html);
                    }
                    setEditingParagraphId(null);
                    setEditingPrompt('');
                  }}
                />
              )}
            </>
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