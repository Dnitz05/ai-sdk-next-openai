import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';

const TemplateEditor: React.FC<{ initialTemplateData: any; mode: 'edit' | 'new' }> = ({ initialTemplateData, mode }) => {
  // [tots els estats i handlers ja declarats, com a la versió funcional]
  const templateTitle = initialTemplateData?.config_name || '';
  const docxName = initialTemplateData?.base_docx_name || '';
  const excelName = initialTemplateData?.excel_file_name || '';
  const excelHeaders = initialTemplateData?.excel_headers || [];
  const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null);
  const [aiUserPrompt, setAiUserPrompt] = useState('');
  const [aiInstructions, setAiInstructions] = useState<{ id: string; prompt: string }[]>(initialTemplateData?.ai_instructions || []);
  const [convertedHtml, setConvertedHtml] = useState<string | null>(initialTemplateData?.final_html || null);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">
      {/* Capçalera: nom de la plantilla alineat a l'esquerra */}
      <div className="w-full max-w-4xl mx-auto flex items-center mb-4 sm:mb-6 px-1">
        <h1 className="text-2xl font-bold text-gray-800">{templateTitle}</h1>
      </div>
      {/* Renderitzat complet de l'editor enriquit */}
      <div className="flex w-full max-w-6xl gap-x-6 px-1">
        {/* Foli blanc */}
        <div className="flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-0">
          {/* Previsualització DOCX */}
          {convertedHtml ? (
            <div ref={contentRef} className="prose max-w-5xl mx-auto bg-gray-50 p-4 rounded" dangerouslySetInnerHTML={{ __html: convertedHtml }} />
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
            {convertedHtml && (
              <div className="mt-8">
                <h3 className="text-md font-semibold text-indigo-700 mb-2">Instruccions IA</h3>
                <div className="flex flex-col gap-2">
                  <textarea
                    className="w-full border rounded p-2 text-sm"
                    rows={3}
                    placeholder="Escriu una instrucció per la IA (ex: Resumeix aquest paràgraf...)"
                    value={aiUserPrompt}
                    onChange={e => setAiUserPrompt(e.target.value)}
                  />
                  <button
                    className="self-end px-4 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                  >
                    Desa instrucció IA
                  </button>
                </div>
                {/* Llista d'instruccions IA */}
                {aiInstructions.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {aiInstructions.map((instr, idx) => (
                      <li key={instr.id} className="p-2 border rounded bg-indigo-50 text-gray-700">
                        <span className="font-medium text-indigo-800">Inst. {idx + 1}:</span> {instr.prompt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
};

export default TemplateEditor;