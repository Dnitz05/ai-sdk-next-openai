import React, { useState, useEffect, useRef, ChangeEvent, MouseEvent, useMemo } from 'react';
import ReactDOM from 'react-dom';
import * as XLSX from 'xlsx';

// Component React per editar el paràgraf inline amb botons al marge esquerre
const InlineParagraphEditor: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ value, onChange, onSave, onCancel }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus automàtic al textarea
    textareaRef.current?.focus();
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {/* Botons a l'esquerra */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5em', marginRight: '0.5em' }}>
        <button
          className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs mb-1 ml-[-0.5em]"
          onClick={onSave}
        >
          Desa
        </button>
        <button
          className="px-2 py-0.5 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-xs ml-[-0.5em]"
          onClick={onCancel}
        >
          Cancel·la
        </button>
      </div>
      {/* Textarea a la dreta */}
      <textarea
        ref={textareaRef}
        value={value}
        className="w-full border rounded p-2 text-xs mb-2"
        rows={3}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

// Component auxiliar per gestionar el portal i l'existència del contenidor
const PortalEditor = ({
  editingParagraphId,
  editingPrompt,
  setEditingPrompt,
  saveEditedParagraph,
  cancelEditParagraph,
}: {
  editingParagraphId: string;
  editingPrompt: string;
  setEditingPrompt: (v: string) => void;
  saveEditedParagraph: () => void;
  cancelEditParagraph: () => void;
}) => {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Espera que el contenidor existeixi al DOM
    const el = document.getElementById(`react-edit-p-${editingParagraphId}`);
    setContainer(el);
  }, [editingParagraphId]);

  if (!container) return null; // No renderitza el portal si el contenidor no existeix

  return ReactDOM.createPortal(
    <div style={{
      position: 'absolute',
      left: '-180px', // Ajusta segons necessitat
      top: '30%', // Ajusta segons necessitat
      zIndex: 20,
      // El component InlineParagraphEditor ja té el display:flex
    }}>
      <InlineParagraphEditor
        value={editingPrompt}
        onChange={setEditingPrompt}
        onSave={saveEditedParagraph}
        onCancel={cancelEditParagraph}
      />
    </div>,
    container
  );
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

  // IA: paràgraf seleccionat, prompt, llista d'instruccions (només per persistència, no per UI)
  const [aiTargetParagraphId, setAiTargetParagraphId] = useState<string | null>(null);
  const [aiInstructions, setAiInstructions] = useState<{ id: string; prompt: string; originalText: string }[]>(initialTemplateData?.ai_instructions || []);
  const [iaInstructionsMode, setIaInstructionsMode] = useState(false);

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
  }, [convertedHtml]); // Executa només quan convertedHtml canvia

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
    if (!convertedHtml || !iaInstructionsMode) return; // Només en mode IA
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
      // Inicia l'edició del paràgraf
      setEditingParagraphId(paragraphId);
      setEditingPrompt(targetParagraph.textContent || '');
    }
  };

  // Funció per desar el text editat directament al foli
  const saveEditedParagraph = () => {
    if (contentRef.current && editingParagraphId) {
      const placeholderDiv = contentRef.current.querySelector(`#react-edit-p-${editingParagraphId}`);
      if (placeholderDiv) {
        const newP = document.createElement('p');
        newP.dataset.paragraphId = editingParagraphId;
        newP.textContent = editingPrompt;
        placeholderDiv.parentNode?.replaceChild(newP, placeholderDiv);
        setConvertedHtml(contentRef.current.innerHTML); // Actualitza l'estat amb el nou HTML
      }
    }
    setEditingParagraphId(null);
    setEditingPrompt('');
  };

  // Funció per cancel·lar l'edició
  const cancelEditParagraph = () => {
    if (contentRef.current && editingParagraphId) {
      const placeholderDiv = contentRef.current.querySelector(`#react-edit-p-${editingParagraphId}`);
      if (placeholderDiv) {
        const newP = document.createElement('p');
        newP.dataset.paragraphId = editingParagraphId;
        // Restaura amb el text que hi havia abans d'editar (que està a editingPrompt)
        newP.textContent = editingPrompt;
        placeholderDiv.parentNode?.replaceChild(newP, placeholderDiv);
        setConvertedHtml(contentRef.current.innerHTML); // Actualitza l'estat amb el nou HTML
      }
    }
    setEditingParagraphId(null);
    setEditingPrompt('');
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">
      {/* Capçalera */}
      <div className="w-full max-w-4xl mx-auto flex items-center mb-4 sm:mb-6 px-1">
        <h1 className="text-2xl font-bold text-gray-800">{templateTitle}</h1>
      </div>
      <div className="flex w-full max-w-6xl gap-x-6 px-1" style={{ position: 'relative' }}>
        {/* Foli blanc */}
        <div className="flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-0">
          {convertedHtml ? (
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
                      `<div id="react-edit-p-${editingParagraphId}"></div>` // Crea el placeholder
                    )
                  : convertedHtml,
              }}
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
        {/* Portal per a l'editor inline, fora del foli */}
        {editingParagraphId && (
          <PortalEditor
            editingParagraphId={editingParagraphId}
            editingPrompt={editingPrompt}
            setEditingPrompt={setEditingPrompt}
            saveEditedParagraph={saveEditedParagraph}
            cancelEditParagraph={cancelEditParagraph}
          />
        )}
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
            {/* Panell d'instruccions IA (simplificat) */}
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
                 <p className="text-xs text-gray-500 italic">Fes clic sobre un paràgraf per editar-lo directament.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default TemplateEditor;