'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface TemplateDetails {
  id: string;
  config_name: string;
  base_docx_name: string | null;
  excel_file_name: string | null;
  excel_headers: string[] | null;
  link_mappings: Array<{ id: string; excelHeader: string; selectedText: string; }>;
  ai_instructions: Array<{ id: string; prompt: string; }>;
  created_at: string;
  updated_at: string;
}

export default function TemplatePage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const [template, setTemplate] = useState<TemplateDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    if (!id) {
      setError('ID de plantilla no proporcionat');
      setIsLoading(false);
      return;
    }
    const fetchTemplate = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/get-template/${id}`);
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        setTemplate(data.template);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconegut');
        console.error('Error carregant plantilla:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTemplate();
  }, [id]);
  
  const handleDelete = async () => {
    if (!id) {
      alert('ID de plantilla no proporcionat');
      return;
    }
    if (!confirm('Estàs segur que vols eliminar aquesta plantilla?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/delete-template/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      router.push('/plantilles');
    } catch (err) {
      alert(`Error eliminant plantilla: ${err instanceof Error ? err.message : 'Error desconegut'}`);
      console.error('Error eliminant plantilla:', err);
    }
  };
  
  if (isLoading) {
    return <div className="text-center py-12">Carregant...</div>;
  }
  
  if (error || !template) {
    return <div className="text-center py-12 text-red-500">Error: {error || 'Plantilla no trobada'}</div>;
  }
  
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-gray-100">
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Link href="/plantilles" className="text-blue-600 hover:underline mb-2 inline-block">
              &larr; Tornar a plantilles
            </Link>
            <h1 className="text-2xl font-semibold text-gray-800">{template.config_name}</h1>
          </div>
          <div className="flex space-x-3">
            <Link 
              href={`/edit/${template.id}`} 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Editar
            </Link>
            <Link 
              href={`/generar/${template.id}`} 
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Generar Informe
            </Link>
            <button 
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Eliminar
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-medium mb-3 text-gray-700">Informació General</h2>
              <p><strong>Nom:</strong> {template.config_name}</p>
              <p><strong>Document DOCX:</strong> {template.base_docx_name || 'No especificat'}</p>
              <p><strong>Fitxer Excel:</strong> {template.excel_file_name || 'No especificat'}</p>
              <p><strong>Creat:</strong> {new Date(template.created_at).toLocaleString()}</p>
              <p><strong>Actualitzat:</strong> {new Date(template.updated_at).toLocaleString()}</p>
            </div>
            
            <div>
              <h2 className="text-lg font-medium mb-3 text-gray-700">Capçaleres Excel</h2>
              {template.excel_headers && template.excel_headers.length > 0 ? (
                <ul className="list-disc list-inside">
                  {template.excel_headers.map((header, index) => (
                    <li key={index}>{header}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">No hi ha capçaleres d'Excel</p>
              )}
            </div>
          </div>
          
          <div className="mt-6">
            <h2 className="text-lg font-medium mb-3 text-gray-700">Vinculacions Excel</h2>
            {template.link_mappings && template.link_mappings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr>
                      <th className="py-2 px-4 border-b text-left">Text Seleccionat</th>
                      <th className="py-2 px-4 border-b text-left">Capçalera Excel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {template.link_mappings.map((link) => (
                      <tr key={link.id}>
                        <td className="py-2 px-4 border-b">{link.selectedText}</td>
                        <td className="py-2 px-4 border-b">{link.excelHeader}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 italic">No hi ha vinculacions amb Excel</p>
            )}
          </div>
          
          <div className="mt-6">
            <h2 className="text-lg font-medium mb-3 text-gray-700">Instruccions IA</h2>
            {template.ai_instructions && template.ai_instructions.length > 0 ? (
              <div className="space-y-3">
                {template.ai_instructions.map((instruction) => (
                  <div key={instruction.id} className="p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm text-gray-500">ID Paràgraf: {instruction.id}</p>
                    <p className="text-gray-800">{instruction.prompt}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No hi ha instruccions per a IA</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
