'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TemplateEditor, { TemplateData } from '@/components/TemplateEditor';
import { createBrowserSupabaseClient } from '@/lib/supabase/browserClient';

export default function EditarPlantilla() {
  const { id } = useParams() as { id: string };
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemplate() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
          setError("No s'ha trobat la sessió d'usuari. Torna a iniciar sessió.");
          setLoading(false);
          return;
        }
        const response = await fetch(`/api/get-template/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
          const err = await response.json();
          setError(err.error || 'Error carregant la plantilla');
          setLoading(false);
          return;
        }
        const data = await response.json();
        setTemplate(data.template);
      } catch (err: any) {
        setError(err.message || 'Error desconegut');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchTemplate();
  }, [id]);

  if (loading) return <div className="text-center py-12">Carregant plantilla...</div>;
  if (error) return <div className="text-center py-12 text-red-500">Error: {error}</div>;
  if (!template) return <div className="text-center py-12 text-red-500">No s'ha trobat la plantilla.</div>;

  return <TemplateEditor initialTemplateData={template} mode="edit" />;
}