'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TemplateEditor from '../../../../components/TemplateEditor';

export default function EditarPlantilla() {
  const { id } = useParams();
  const [template, setTemplate] = useState<any>(null);

  useEffect(() => {
    // Crida real a l'API per obtenir la plantilla
    // TODO: substituir per la crida real
    setTemplate({
      id,
      config_name: 'Plantilla demo',
      base_docx_name: 'demo.docx',
      excel_file_name: 'demo.xlsx',
      excel_headers: ['Nom', 'Cognoms', 'Data'],
      link_mappings: [],
      ai_instructions: [],
      final_html: '<p>Contingut demo</p>',
    });
  }, [id]);

  if (!template) return <div>Carregant plantilla...</div>;

  return <TemplateEditor initialTemplateData={template} mode="edit" />;
}