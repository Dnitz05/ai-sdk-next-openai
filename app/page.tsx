'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { createBrowserSupabaseClient } from '../lib/supabase/browserClient';

export default function NovaPlantilla() {
  const router = useRouter();
  const [templateName, setTemplateName] = useState('');
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalHtml, setFinalHtml] = useState<string | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [originalDocxPath, setOriginalDocxPath] = useState<string | null>(null);
  const [templateId] = useState(() => crypto.randomUUID());

  // Processa el DOCX amb l'API
  // Nou flux: primer puja el DOCX a Storage, després processa via storagePath
  const processDocx = async (file: File) => {
    // 1. Obtenir token d'autenticació Supabase
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.refreshSession();
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    console.log('accessToken per upload-original-docx:', accessToken);

    // 2. Pujar el DOCX a Storage
    const formData = new FormData();
    formData.append('file', file);
    formData.append('templateId', templateId);
    const uploadRes = await fetch('/api/upload-original-docx', {
      method: 'POST',
      credentials: 'include',
      body: formData,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    if (!uploadRes.ok) throw new Error('Error pujant DOCX');
    const uploadData = await uploadRes.json();
    if (!uploadData.success || !uploadData.originalDocxPath) throw new Error('No s\'ha rebut la ruta del DOCX');
    setOriginalDocxPath(uploadData.originalDocxPath);
    // 3. Processar el DOCX via storagePath
    const r = await fetch('/api/process-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ storagePath: uploadData.originalDocxPath }),
    });
    if (!r.ok) throw new Error('Error processant DOCX');
    const d = await r.json();
    return d.html as string;
  };

  // Processa l'Excel al frontend
  const processExcel = async (file: File) => {
    return new Promise<string[]>((resolve, reject) => {
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
                resolve(Object.keys(fR));
                return;
              }
            }
            reject('Excel buit o format invàlid');
          } else {
            reject('Error llegint Excel');
          }
        } catch (err) {
          reject('Error processant Excel');
        }
      };
      r.onerror = () => reject('Error llegint fitxer Excel');
      r.readAsArrayBuffer(file);
    });
  };

  const handleSave = async () => {
      setIsSaving(true);
      setError(null);
      // refrescar sessió i obtenir token
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      try {
      if (!wordFile || !excelFile) throw new Error('Falten fitxers');
      // Processa DOCX i Excel
      const html = await processDocx(wordFile);
      setFinalHtml(html);
      const headers = await processExcel(excelFile);
      setExcelHeaders(headers);

      // Desa la plantilla
      const config = {
        id: templateId,
        originalDocxPath: originalDocxPath,
        baseDocxName: wordFile.name,
        config_name: templateName,
        excelInfo: { fileName: excelFile.name, headers },
        linkMappings: [],
        aiInstructions: [],
        finalHtml: html,
      };
      const response = await fetch('/api/save-configuration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error('Error desant la plantilla');
      const data = await response.json();
      const id = data.configId || data.id || data.templateId || 'plantilla-fake-id';
      router.push(`/plantilles/editar/${id}`);
    } catch (err: any) {
      setError('Error processant o desant la plantilla');
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = templateName.trim() && wordFile && excelFile;

  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 sm:p-8 bg-gray-100">
      <div className="w-full max-w-3xl bg-white rounded shadow-lg p-8 flex flex-col gap-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la plantilla</label>
          <input
            type="text"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            className="w-full px-3 py-2 border rounded text-sm font-semibold text-gray-800"
            placeholder="Nom únic de la plantilla"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Word (DOCX)</label>
          <input
            type="file"
            accept=".docx"
            onChange={e => setWordFile(e.target.files?.[0] || null)}
            className="block"
          />
          {wordFile && <span className="text-xs text-gray-500">({wordFile.name})</span>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Excel</label>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={e => setExcelFile(e.target.files?.[0] || null)}
            className="block"
            disabled={!wordFile}
          />
          {excelFile && <span className="text-xs text-gray-500">({excelFile.name})</span>}
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className={`px-6 py-2 rounded font-semibold text-white transition ${
              !canSave || isSaving
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isSaving ? 'Desant...' : 'Continua'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    </main>
  );
}
