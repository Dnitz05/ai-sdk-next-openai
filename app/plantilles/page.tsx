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
  
  // Carregar plantilles
  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoading(true);
      try {
        // Obtenir el token JWT de Supabase (browser client)
        const { createBrowserSupabaseClient } = await import('@/lib/supabase/browserClient');
        const supabase = createBrowserSupabaseClient();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log('Resultat de getSession():', session, 'Error:', sessionError);
        if (sessionError || !session) {
          console.error('No autenticat. Torna a iniciar sessió.');
          throw new Error('No autenticat. Torna a iniciar sessió.');
        }
        const accessToken = session.access_token;
        console.log('accessToken obtingut:', accessToken);
        // LOG DEL USER_ID AUTENTICAT
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          console.warn('No s’ha pogut obtenir el user_id autenticat:', userError);
        } else {
          console.log('user_id autenticat (frontend):', userData.user.id);
        }
        // Log de l'objecte headers
        const headers = {
          Authorization: `Bearer ${accessToken}`,
        };
        console.log('Headers passats al fetch:', headers);
        // Fer fetch passant el token al header Authorization
        const response = await fetch(
          `/api/get-templates${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`,
          {
            headers,
          }
        );
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
            {templates.map((template, idx) => {
              console.log('DEBUG plantilla:', idx, template);
              return (
                <div key={template.id} className="bg-white p-4 rounded shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-medium text-gray-800">
                        {typeof template.config_name === 'string' ? template.config_name : JSON.stringify(template.config_name)}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {template.base_docx_name && `DOCX: ${typeof template.base_docx_name === 'string' ? template.base_docx_name : JSON.stringify(template.base_docx_name)}`}
                        {template.excel_file_name && ` | Excel: ${typeof template.excel_file_name === 'string' ? template.excel_file_name : JSON.stringify(template.excel_file_name)}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Creat: {template.created_at ? new Date(template.created_at).toLocaleDateString() : 'Data invàlida'}
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
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
