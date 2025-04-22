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

  // Recompte d'usos de cada capçalera
  const linkCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    for (const link of links) {
      counts[link.excelHeader] = (counts[link.excelHeader] || 0) + 1;
    }
    return counts;
  }, [links]);

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
              className="prose max-w-5xl mx-auto bg-gray-50 p-4 rounded"
              dangerouslySetInnerHTML={{ __html: convertedHtml }}
              onMouseUp={handleTextSelection}
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
                      {linkCounts[header] ? (
                        <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                          ({linkCounts[header]})
                        </span>
                      ) : null}
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
            {/* ... resta del sidebar: IA, etc. ... */}
          </div>
        </aside>
      </div>
    </main>
  );
};

export default TemplateEditor;