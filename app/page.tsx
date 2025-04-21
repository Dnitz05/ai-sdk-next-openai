'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NovaPlantilla() {
  const router = useRouter();
  const [templateName, setTemplateName] = useState('');
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Simulació: processar fitxers i obtenir dades (en producció, crida a /api/process-document i processa Excel)
  const processFiles = async () => {
    // Aquí hauries de processar el DOCX i l'Excel i obtenir el HTML i les capçaleres
    // Per la demo, retornem valors simulats
    return {
      baseDocxName: wordFile?.name || '',
      config_name: templateName,
      excelInfo: { fileName: excelFile?.name || '', headers: ['Nom', 'Cognoms', 'Data'] },
      linkMappings: [],
      aiInstructions: [],
      finalHtml: '<p>Contingut DOCX processat!</p>',
    };
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const config = await processFiles();
      const response = await fetch('/api/save-configuration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error('Error desant la plantilla');
      const data = await response.json();
      const id = data.configId || data.id || data.templateId || 'plantilla-fake-id';
      router.push(`/plantilles/editar/${id}`);
    } catch (err: any) {
      setError('Error desant la plantilla');
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
