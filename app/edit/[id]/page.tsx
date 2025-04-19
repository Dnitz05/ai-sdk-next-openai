'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Template {
  id: string;
  config_name: string;
  base_docx_name: string | null;
  excel_file_name: string | null;
  final_html: string;
  // Afegeix més camps segons sigui necessari
}

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const { id } = params as { id: string };

  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carrega la plantilla
  useEffect(() => {
    const fetchTemplate = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/get-template/${id}`);
        if (!response.ok) throw new Error('No s\'ha pogut carregar la plantilla');
        const data = await response.json();
        setTemplate(data.template);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconegut');
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchTemplate();
  }, [id]);

  // Gestió del formulari
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!template) return;
    setTemplate({ ...template, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!template) return;
    try {
      const response = await fetch(`/api/update-template/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      if (!response.ok) throw new Error('Error desant la plantilla');
      router.push('/plantilles');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut');
    }
  };

  if (isLoading) return <p className="p-8 text-center">Carregant plantilla...</p>;
  if (error) return <p className="p-8 text-center text-red-500">{error}</p>;
  if (!template) return <p className="p-8 text-center">Plantilla no trobada.</p>;

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Editar Plantilla</h1>
      <div className="space-y-4">
        <label className="block">
          <span className="text-gray-700">Nom de la configuració</span>
          <input
            type="text"
            name="config_name"
            value={template.config_name}
            onChange={handleChange}
            className="mt-1 block w-full border rounded p-2"
          />
        </label>
        <label className="block">
          <span className="text-gray-700">Nom DOCX base</span>
          <input
            type="text"
            name="base_docx_name"
            value={template.base_docx_name || ''}
            onChange={handleChange}
            className="mt-1 block w-full border rounded p-2"
          />
        </label>
        <label className="block">
          <span className="text-gray-700">Nom fitxer Excel</span>
          <input
            type="text"
            name="excel_file_name"
            value={template.excel_file_name || ''}
            onChange={handleChange}
            className="mt-1 block w-full border rounded p-2"
          />
        </label>
        <label className="block">
          <span className="text-gray-700">HTML Final</span>
          <textarea
            name="final_html"
            value={template.final_html}
            onChange={handleChange}
            className="mt-1 block w-full border rounded p-2"
            rows={6}
          />
        </label>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Desa
        </button>
      </div>
    </main>
  );
}