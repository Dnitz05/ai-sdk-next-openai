// app/plantilles/editor/[id]/page.tsx
'use client';

import React, { useState, useEffect, useRef, ChangeEvent, MouseEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import AuthWrapper from '@/components/AuthWrapper';
import Link from 'next/link';
import { createBrowserSupabaseClient } from '@/lib/supabase/browserClient';

// Interfícies
interface ExcelLink { id: string; excelHeader: string; selectedText: string; }
interface AiInstruction { id: string; prompt: string; originalText: string; }
interface TemplateAPI {
  id?: string;
  config_name: string;
  base_docx_name: string | null;
  excel_file_name: string | null;
  excel_headers: string[] | null;
  link_mappings: ExcelLink[];
  ai_instructions: AiInstruction[];
  final_html: string;
}

export default function EditorPlantillaUnificat() {
  const router = useRouter();
  const params = useParams();
  const { id } = params as { id?: string };

  // --- Estats bàsics ---
  const [isLoading, setIsLoading] = useState(!!id && id !== 'new');
  const [error, setError] = useState<string | null>(null);

  // --- Estats editor ---
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [convertedHtml, setConvertedHtml] = useState<string | null>(null);
  const [isLoadingDocx, setIsLoadingDocx] = useState<boolean>(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [mammothMessages, setMammothMessages] = useState<any[]>([]);
  const [selectedExcelFileName, setSelectedExcelFileName] = useState<string | null>(null);
  const [excelData, setExcelData] = useState<any[] | null>(null);
  const [isParsingExcel, setIsParsingExcel] = useState<boolean>(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [selectedExcelHeader, setSelectedExcelHeader] = useState<string | null>(null);
  const [links, setLinks] = useState<ExcelLink[]>([]);
  const [aiTargetParagraphId, setAiTargetParagraphId] = useState<string | null>(null);
  const [aiUserPrompt, setAiUserPrompt] = useState<string>('');
  const [aiInstructions, setAiInstructions] = useState<AiInstruction[]>([]);
  const [includeOriginalText, setIncludeOriginalText] = useState<boolean>(false);
  const [iaInstructionsMode, setIaInstructionsMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // --- Refs ---
  const contentRef = useRef<HTMLDivElement>(null);

  // --- Carrega plantilla si id !== 'new' ---
  useEffect(() => {
    if (!id || id === 'new') return;
    setIsLoading(true);
    (async () => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) throw new Error('No autenticat. Torna a iniciar sessió.');
        const accessToken = session.access_token;
        const response = await fetch(`/api/get-template/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error('No s\'ha pogut carregar la plantilla');
        const data = await response.json();
        const t: TemplateAPI = data.template;
        setSelectedFileName(t.base_docx_name || null);
        setConvertedHtml(t.final_html || null);
        setSelectedExcelFileName(t.excel_file_name || null);
        setExcelHeaders(t.excel_headers || []);
        setLinks(t.link_mappings || []);
        setAiInstructions(t.ai_instructions || []);
        // Altres estats segons sigui necessari
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconegut');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id]);

  // --- Funcions DOCX, Excel, Mapping, IA... (igual que a app/page.tsx) ---
  // (Per brevitat, aquí només es mostra la càrrega inicial i submit, però caldria copiar tota la lògica de l’editor avançat.)

  // --- Submit ---
  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveMessage(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error('No autenticat. Torna a iniciar sessió.');
      const accessToken = session.access_token;

      const configuration = {
        baseDocxName: selectedFileName,
        config_name: selectedFileName || 'Sense nom',
        excelInfo: { fileName: selectedExcelFileName, headers: excelHeaders },
        linkMappings: links,
        aiInstructions: aiInstructions,
        finalHtml: convertedHtml || '',
      };

      let response;
      if (id && id !== 'new') {
        response = await fetch(`/api/update-template/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(configuration),
        });
      } else {
        response = await fetch('/api/save-configuration', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(configuration),
        });
      }
      if (!response.ok) throw new Error('Error desant la plantilla');
      setSaveStatus('success');
      setSaveMessage('Configuració desada!');
      router.push('/plantilles');
    } catch (err) {
      setSaveStatus('error');
      setSaveMessage(err instanceof Error ? err.message : 'Error desconegut');
    }
  };

  if (isLoading) return <div className="text-center py-12">Carregant...</div>;
  if (error) return <div className="text-center py-12 text-red-500">Error: {error}</div>;

  // --- Aquí s’hauria d’incloure tot el JSX de l’editor avançat (panell lateral, mapping, IA, etc.) igual que a app/page.tsx ---

  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">
      <div className="w-full max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-800 mb-4">{id && id !== 'new' ? 'Editar Plantilla' : 'Nova Plantilla'}</h1>
        {/* TODO: Incloure aquí tot el JSX de l’editor avançat */}
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mt-8"
        >
          Desa
        </button>
        {saveStatus === 'error' && <p className="text-red-600 mt-2">{saveMessage}</p>}
        {saveStatus === 'success' && <p className="text-green-600 mt-2">{saveMessage}</p>}
      </div>
    </main>
  );
}