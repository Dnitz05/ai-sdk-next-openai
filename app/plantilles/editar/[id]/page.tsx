'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TemplateEditor from '../../../../components/TemplateEditor';
import { createBrowserSupabaseClient } from '../../../../lib/supabase/browserClient';

export default function EditarPlantilla() {
  const { id } = useParams();
  const [template, setTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemplate() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createBrowserSupabaseClient();
        // Refresca la sessió per obtenir el token més recent
        await supabase.auth.refreshSession();
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const response = await fetch(`/api/get-template/${id}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (!response.ok) throw new Error('No s\'ha trobat la plantilla');
        const data = await response.json();
        setTemplate(data.template);
      } catch (err: any) {
        setError('Error carregant la plantilla');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchTemplate();
  }, [id]);

  if (loading) return <div>Carregant plantilla...</div>;
  if (error || !template) return <div className="text-red-600">{error || 'No s\'ha trobat la plantilla.'}</div>;

  return <TemplateEditor initialTemplateData={template} mode="edit" />;
}