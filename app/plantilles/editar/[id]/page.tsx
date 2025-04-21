'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TemplateEditor from '../../../../components/TemplateEditor';

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
        const response = await fetch(`/api/get-template/${id}`, { credentials: 'include' });
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