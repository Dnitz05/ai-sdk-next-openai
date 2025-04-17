'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Template {
  id: string;
  config_name: string;
  base_docx_name: string | null;
  excel_file_name: string | null;
  created_at: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Estat per la pujada i processament de documents
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [processedHtml, setProcessedHtml] = useState<string | null>(null);

  // Handler per la selecció de fitxer
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files && e.target.files[0] ? e.target.files[0] : null);
    setProcessedHtml(null);
    setProcessError(null);
  };

  // Handler per enviar el fitxer a l'API
  const handleProcessDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessError(null);
    setProcessedHtml(null);

    if (!selectedFile) {
      setProcessError("Cal seleccionar un fitxer DOCX.");
      return;
    }

    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/process-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error processant el document');
      }

      const data = await response.json();
      setProcessedHtml(data.html);
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : 'Error desconegut');
    } finally {
      setProcessing(false);
    }
  };
  
  // Carregar plantilles
  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/get-templates${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`);
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        setTemplates(data.templates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconegut');
        console.error('Error carregant plantilles:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTemplates();
  }, [searchTerm]);
  
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-gray-100">
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Les Meves Plantilles</h1>
          <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Nova Plantilla
          </Link>
        </div>

        {/* Formulari de pujada i processament de document */}
        <div className="mb-6 bg-white p-4 rounded shadow">
          <form onSubmit={handleProcessDocument} className="flex flex-col gap-2">
            <label className="font-medium text-gray-700">
              Pujar document DOCX per processar:
              <input
                type="file"
                accept=".docx"
                onChange={handleFileChange}
                className="block mt-2"
              />
            </label>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              disabled={processing || !selectedFile}
            >
              {processing ? 'Processant...' : 'Processa el document'}
            </button>
            {processError && <p className="text-red-500">{processError}</p>}
          </form>
          {processedHtml && (
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Resultat HTML processat:</h3>
              <div className="border rounded p-2 bg-gray-50 overflow-x-auto" dangerouslySetInnerHTML={{ __html: processedHtml }} />
            </div>
          )}
        </div>
        
        {/* Cercador */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Cerca per nom..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>
        
        {/* Estat de càrrega */}
        {isLoading && <p className="text-center py-8 text-gray-500">Carregant plantilles...</p>}
        
        {/* Error */}
        {error && <p className="text-center py-8 text-red-500">Error: {error}</p>}
        
        {/* Llista de plantilles */}
        {!isLoading && !error && templates.length === 0 && (
          <p className="text-center py-8 text-gray-500">No s'han trobat plantilles.</p>
        )}
        
        {!isLoading && !error && templates.length > 0 && (
          <div className="grid gap-4">
            {templates.map((template) => (
              <div key={template.id} className="bg-white p-4 rounded shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-medium text-gray-800">{template.config_name}</h2>
                    <p className="text-sm text-gray-500">
                      {template.base_docx_name && `DOCX: ${template.base_docx_name}`}
                      {template.excel_file_name && ` | Excel: ${template.excel_file_name}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Creat: {new Date(template.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Link 
                      href={`/plantilles/${template.id}`} 
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Detalls
                    </Link>
                    <Link 
                      href={`/edit/${template.id}`} 
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Editar
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
