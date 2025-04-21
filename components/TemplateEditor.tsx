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
  const triggerUpload = async (file: File) => {
    setIsLoadingDocx(true);
    setDocxError(null);
    setConvertedHtml(null);
    setMammothMessages([]);
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

    const formData = new FormData();
    formData.append('file', file);
    try {
      const r = await fetch('/api/process-document', { method: 'POST', body: formData });
      const ct = r.headers.get("content-type");
      if (!r.ok) {
        let e: any = { error: `E: ${r.status}` };
        try { e = await r.json(); } catch { }
        throw new Error(e.error || `E ${r.status}`);
      }
      if (ct?.includes("application/json")) {
        const d = await r.json();
        setConvertedHtml(d.html);
        setMammothMessages(d.messages || []);
      } else {
        throw new Error("Format resposta inesperat.");
      }
    } catch (err) {
      setDocxError(err instanceof Error ? err.message : 'Error');
      setConvertedHtml(null);
    } finally {
      setIsLoadingDocx(false);
    }
  };

  const handleDocxFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const f = event.target.files[0];
      const vT = f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || f.name.toLowerCase().endsWith('.docx');
      if (vT) {
        setSelectedFileName(f.name);
        setDocxError(null);
        triggerUpload(f);
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

  // --- Renderitzat integrat i visualment coherent ---
  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">
      <div className="w-full max-w-3xl bg-white rounded shadow-lg p-8 flex flex-col gap-8">
        {/* Pas 1: Nom de la plantilla */}
        <div>
          <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 mb-1">Nom de la plantilla</label>
          <input
            id="templateName"
            type="text"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm font-semibold text-gray-800"
            placeholder="Nom únic de la plantilla"
            required
          />
        </div>
        {/* Pas 2: Pujar DOCX */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Word (DOCX)</label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              id="docxInput"
              onChange={handleDocxFileChange}
              accept=".docx"
              className="block"
              disabled={isLoadingDocx}
            />
            {selectedFileName && <span className="text-xs text-gray-500">({selectedFileName})</span>}
            {isLoadingDocx && <span className="text-blue-600 animate-pulse ml-2">Processant...</span>}
          </div>
          {docxError && <p className="text-xs text-red-600 mt-2">{docxError}</p>}
        </div>
        {/* Pas 3: Pujar Excel */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Excel</label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              id="excelInput"
              onChange={handleExcelFileChange}
              accept=".xlsx, .xls"
              className="block"
              disabled={isParsingExcel || !selectedFileName}
            />
            {selectedExcelFileName && <span className="text-xs text-gray-500">({selectedExcelFileName})</span>}
            {isParsingExcel && <span className="text-green-600 animate-pulse ml-2">Processant...</span>}
          </div>
          {excelError && <p className="text-xs text-red-600 mt-2">{excelError}</p>}
        </div>
        {/* Panell DOCX processat */}
        {convertedHtml && (
          <div className="mt-6">
            <h3 className="text-md font-semibold text-gray-700 mb-2">Previsualització DOCX</h3>
            <div ref={contentRef} className="prose max-w-5xl mx-auto bg-gray-50 p-4 rounded" dangerouslySetInnerHTML={{ __html: convertedHtml }} />
          </div>
        )}
        {/* Botó Desa */}
        <div className="flex justify-end">
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
      </div>
    </main>
  );
};

export default TemplateEditor;