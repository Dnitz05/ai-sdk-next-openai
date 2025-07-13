import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import supabaseServerClient from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Funció per verificar un component i retornar un resultat estandarditzat
async function checkComponent(name: string, checkFunction: () => Promise<any>) {
  try {
    const result = await checkFunction();
    return { component: name, status: '✅ OK', details: result };
  } catch (error) {
    return { component: name, status: '❌ ERROR', details: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'projectId és obligatori' }, { status: 400 });
  }

  const diagnosisResults = [];

  // 1. Verificar connexió i autenticació amb Supabase
  diagnosisResults.push(await checkComponent('Supabase Auth', async () => {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll() } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error(`Error d'autenticació: ${error?.message || 'Usuari no trobat'}`);
    return `Usuari ${user.id} autenticat correctament.`;
  }));

  // 2. Verificar existència de la taula 'smart_generations'
  diagnosisResults.push(await checkComponent('Database: Taula smart_generations', async () => {
    const { data, error } = await supabaseServerClient
      .from('smart_generations')
      .select('id')
      .limit(1);
    if (error) throw new Error(`Error consultant 'smart_generations': ${error.message}`);
    return 'La taula existeix i és accessible.';
  }));

  // 3. Verificar existència del bucket 'documents' a Storage
  diagnosisResults.push(await checkComponent('Storage: Bucket documents', async () => {
    // Intentem llistar arxius en un path que probablement no existeix.
    // Si el bucket no existeix, l'error serà específic.
    const { data, error } = await supabaseServerClient.storage
      .from('documents')
      .list('test-path-no-existent', { limit: 1 });

    if (error && !error.message.includes('Bucket not found')) {
        // Un altre error que no sigui "Bucket not found"
        throw new Error(`Error inesperat al llistar el bucket: ${error.message}`);
    }
    if (error && error.message.includes('Bucket not found')) {
        throw new Error('El bucket "documents" no existeix.');
    }
    return 'El bucket "documents" existeix i és accessible.';
  }));

  // 4. Verificar dades del projecte i plantilla associada
  diagnosisResults.push(await checkComponent('Projecte i Plantilla', async () => {
    const { data: project, error: projectError } = await supabaseServerClient
      .from('projects')
      .select('template_id, excel_data, total_rows')
      .eq('id', projectId)
      .single();

    if (projectError || !project) throw new Error(`Projecte no trobat: ${projectError?.message}`);
    
    // Get template separately to avoid array type issues
    const { data: template, error: templateError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('id, config_name, docx_storage_path, base_docx_storage_path, placeholder_docx_storage_path, indexed_docx_storage_path')
      .eq('id', project.template_id)
      .single();

    if (templateError || !template) throw new Error('El projecte no té cap plantilla associada.');

    const docxPath = template.docx_storage_path || template.base_docx_storage_path || template.placeholder_docx_storage_path || template.indexed_docx_storage_path;
    if (!docxPath) throw new Error('La plantilla no té cap docx_storage_path configurat.');

    // Verificar que el document de la plantilla existeix a Storage
    const { error: docxError } = await supabaseServerClient.storage
      .from('template-docx')
      .download(docxPath);
    if (docxError) throw new Error(`El document de la plantilla a "${docxPath}" no es pot descarregar: ${docxError.message}`);

    // Verificar dades Excel
    const hasExcelData = project.excel_data && Array.isArray(project.excel_data) && project.excel_data.length > 0;
    if (!hasExcelData && (!project.total_rows || project.total_rows === 0)) {
      throw new Error('El projecte no té dades Excel (ni a la columna ni per lazy loading).');
    }

    return {
      projectId: projectId,
      templateId: template.id,
      templateName: template.config_name,
      docxPath: docxPath,
      excelStatus: hasExcelData ? `${project.excel_data.length} files a la columna.` : `Lazy loading per ${project.total_rows} files.`,
    };
  }));

  // 5. Verificar clau API de Mistral (si està disponible a Vercel, aquesta crida hauria de funcionar)
  diagnosisResults.push(await checkComponent('Mistral API', async () => {
    const mistralApiKey = process.env.MISTRAL_API_KEY;
    if (!mistralApiKey || mistralApiKey === 'placeholder') {
      return 'La clau MISTRAL_API_KEY no està configurada a l\'entorn del servidor (pot estar a Vercel). Fent una crida de prova...';
    }

    const response = await fetch('https://api.mistral.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${mistralApiKey}` }
    });

    if (!response.ok) {
      throw new Error(`La crida a Mistral ha fallat amb estat ${response.status}. La clau podria ser invàlida.`);
    }
    const data = await response.json();
    return `Crida a Mistral reeixida. ${data.data.length} models disponibles.`;
  }));

  return NextResponse.json(diagnosisResults);
}
