import React, { useState, useEffect, useRef, ChangeEvent, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '../lib/supabase/browserClient';

export interface ExcelLink { id: string; excelHeader: string; selectedText: string; }
export interface AiInstruction { id: string; prompt: string; originalText: string; }
export interface TemplateData {
  id?: string;
  config_name: string;
  base_docx_name: string | null;
  excel_file_name: string | null;
  excel_headers: string[] | null;
  link_mappings: ExcelLink[];
  ai_instructions: AiInstruction[];
  final_html: string;
}

interface TemplateEditorProps {
  initialTemplateData: TemplateData | null;
  mode: 'new' | 'edit';
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ initialTemplateData, mode }) => {
  // --- Estats i Handlers ---
  const [templateName, setTemplateName] = useState<string>(initialTemplateData?.config_name ?? '');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(initialTemplateData?.base_docx_name ?? null);
  const [convertedHtml, setConvertedHtml] = useState<string | null>(initialTemplateData?.final_html ?? null);
  const [isLoadingDocx, setIsLoadingDocx] = useState<boolean>(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [mammothMessages, setMammothMessages] = useState<any[]>([]);
  const [selectedExcelFileName, setSelectedExcelFileName] = useState<string | null>(initialTemplateData?.excel_file_name ?? null);
  const [excelData, setExcelData] = useState<any[] | null>(null);
  const [isParsingExcel, setIsParsingExcel] = useState<boolean>(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>(initialTemplateData?.excel_headers ?? []);
  const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null);
  const [links, setLinks] = useState<ExcelLink[]>(initialTemplateData?.link_mappings ?? []);
  const [aiTargetParagraphId, setAiTargetParagraphId] = useState<string | null>(null);
  const [aiUserPrompt, setAiUserPrompt] = useState<string>('');
  const [aiInstructions, setAiInstructions] = useState<AiInstruction[]>(initialTemplateData?.ai_instructions ?? []);
  const [includeOriginalText, setIncludeOriginalText] = useState<boolean>(false);
  const [iaInstructionsMode, setIaInstructionsMode] = useState(false);
  type SaveStatus = 'idle' | 'saving' | 'success' | 'error';
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // --- Refs ---
  const contentRef = useRef<HTMLDivElement>(null);

  // Estat per renderitzat client
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  // Handler DOCX
  const handleDocxFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const f = event.target.files[0];
      const vT = f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || f.name.toLowerCase().endsWith('.docx');
      if (vT) {
        setSelectedFileName(f.name);
        setDocxError(null);
        // TODO: triggerUpload(f);
      } else {
        setDocxError('Selecciona .docx');
        setConvertedHtml(null);
        setMammothMessages([]);
        setSelectedFileName('');
        setSelectedExcelFileName(null);
        setExcelData(null);
        setExcelError(null);
        setExcelHeaders([]);
        setSelectedExcelHeader(null);
        setLinks([]);
        setAiTargetParagraphId(null);
        setAiUserPrompt('');
        setAiInstructions([]);
        setSaveStatus('idle');
        setSaveMessage(null);
      }
    }
    if (event.target) event.target.value = '';
  };

  // Handler Excel
  const handleExcelFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const f = event.target.files[0];
      setSelectedExcelFileName(f.name);
      setExcelError(null);
      setExcelData(null);
      setSelectedExcelHeader(null);
      setExcelHeaders([]);
      setAiTargetParagraphId(null);
      setAiUserPrompt('');
      setSaveStatus('idle');
      setSaveMessage(null);
      const vMT = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      const vT = vMT.includes(f.type) || f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls');
      if (vT) {
        setIsParsingExcel(true);
        const r = new FileReader();
        r.onload = (e) => {
          try {
            const a = e.target?.result;
            if (a) {
              const w = XLSX.read(a, { type: 'buffer' });
              const sN = w.SheetNames[0];
              const wS = w.Sheets[sN];
              const jD = XLSX.utils.sheet_to_json(wS);
              if (jD.length > 0) {
                const fR = jD[0];
                if (fR && typeof fR === 'object') {
                  setExcelHeaders(Object.keys(fR));
                } else {
                  setExcelHeaders([]);
                  setExcelError("Format fila Excel invàlid.");
                }
              } else {
                setExcelHeaders([]);
                setExcelError("Excel buit.");
              }
              setExcelData(jD);
            } else {
              throw new Error("Error llegint");
            }
          } catch (err) {
            setExcelError(err instanceof Error ? err.message : 'Error');
            setExcelData(null);
            setExcelHeaders([]);
          } finally {
            setIsParsingExcel(false);
          }
        };
        r.onerror = (e) => {
          setExcelError("Error llegint fitxer.");
          setIsParsingExcel(false);
          setExcelData(null);
          setExcelHeaders([]);
        };
        r.readAsArrayBuffer(f);
      } else {
        setExcelError('Selecciona .xlsx/.xls');
        setSelectedExcelFileName(null);
        setExcelData(null);
        setExcelHeaders([]);
      }
    }
    if (event.target) event.target.value = '';
  };

  // --- Renderitzat complet ---
  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">
      {/* Capçalera WEB */}
      <div className="web-header w-full max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 px-1 gap-4">
        <div className="flex flex-col gap-2 w-full">
          <label htmlFor="templateName" className="text-xs font-medium text-gray-600 mb-1">Nom de la plantilla</label>
          <input
            id="templateName"
            type="text"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border rounded text-sm font-semibold text-gray-800"
            placeholder="Nom únic de la plantilla"
            required
          />
        </div>
        <div className="flex space-x-4">
          <Link href="/plantilles" className="text-blue-600 hover:underline">
            Les Meves Plantilles
          </Link>
        </div>
      </div>
      {/* Botó Desa */}
      <div className="w-full max-w-4xl mx-auto flex justify-end mb-4">
        <button
          // handler de desat aquí
          disabled={
            saveStatus === 'saving' ||
            !templateName.trim() ||
            !selectedFileName ||
            !selectedExcelFileName
          }
          className={`px-6 py-2 rounded font-semibold text-white transition ${
            saveStatus === 'saving'
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700'
          }`}
        >
          {saveStatus === 'saving' ? 'Desant...' : 'Desa'}
        </button>
      </div>
      {/* Panell principal */}
      <div className="flex w-full max-w-6xl gap-x-6 px-1">
        {/* Foli blanc: pujada DOCX */}
        <div className={`flex-grow print-content bg-white shadow-lg rounded-sm p-8 md:p-12 lg:p-16 my-0 flex flex-col items-center justify-center ${!isMounted ? 'mx-auto max-w-3xl' : ''}`}>
          {!selectedFileName && (
            <div className="flex flex-col items-center justify-center h-full">
              <label
                htmlFor="docxInputSidebar"
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-lg font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
              >
                Selecciona DOCX
              </label>
              <input
                type="file"
                id="docxInputSidebar"
                onChange={handleDocxFileChange}
                accept=".docx"
                className="hidden"
                disabled={isLoadingDocx}
              />
              {docxError && <p className="text-xs text-red-600 mt-2">{docxError}</p>}
            </div>
          )}
          {selectedFileName && (
            <div className="w-full">
              {isLoadingDocx && (
                <div className="text-center my-6">
                  <p className="text-blue-600 animate-pulse">Processant DOCX...</p>
                </div>
              )}
              <div
                className="mt-1"
                ref={contentRef}
              >
                {isMounted && convertedHtml ? (
                  <div className="prose max-w-5xl mx-auto" dangerouslySetInnerHTML={{ __html: convertedHtml }} />
                ) : (
                  !isLoadingDocx && !docxError && (
                    <p className="text-gray-400 italic text-center py-10">
                      Carrega un DOCX per començar.
                    </p>
                  )
                )}
              </div>
            </div>
          )}
        </div>
        {/* Sidebar: pujada Excel */}
        {isMounted && (
          <aside className="w-80 flex-shrink-0 my-0 relative">
            <div className="sticky top-4 p-4 bg-white rounded shadow-lg border max-h-[calc(100vh-2rem)] overflow-y-auto flex flex-col">
              <div className="flex justify-between items-center mb-3 pb-2 border-b flex-shrink-0">
                <h3 className="text-md font-semibold text-blue-700">Configuració</h3>
              </div>
              <div className="flex-grow overflow-y-auto space-y-4 pr-1 mb-4">
                {/* Pas 2: Carregar Excel */}
                {selectedFileName && excelHeaders.length === 0 && (
                  <div className="p-3 border border-dashed rounded">
                    <p className="text-sm font-medium text-gray-700 mb-2">Carregar Excel</p>
                    <div className="flex flex-col items-start gap-2">
                      <label
                        htmlFor="excelInputSidebar"
                        className={`inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs sm:text-sm font-medium rounded shadow-sm text-white whitespace-nowrap ${
                          isParsingExcel ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 cursor-pointer'
                        }`}
                      >
                        {isParsingExcel ? 'Processant...' : selectedExcelFileName ? 'Canvia Excel' : 'Selecciona Excel'}
                      </label>
                      <input
                        type="file"
                        id="excelInputSidebar"
                        onChange={handleExcelFileChange}
                        accept=".xlsx, .xls"
                        className="hidden"
                        disabled={isParsingExcel}
                      />
                      {selectedExcelFileName && !isParsingExcel && (
                        <span className="text-xs text-gray-500 italic">({selectedExcelFileName})</span>
                      )}
                    </div>
                    {isParsingExcel && (
                      <div className="mt-2">
                        <p className="text-green-600 animate-pulse text-xs">Processant...</p>
                      </div>
                    )}
                    {excelError && <p className="text-xs text-red-600 mt-2">{excelError}</p>}
                  </div>
                )}
                {/* ... resta del sidebar */}
              </div>
            </div>
          </aside>
        )}
      </div>
      {/* Modals aquí */}
    </main>
  );
};

export default TemplateEditor;