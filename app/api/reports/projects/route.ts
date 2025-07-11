import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Generation } from '@/app/types';
import { readExcelFromStorage, getExcelInfoFromTemplate } from '@/util/excel/readExcelFromStorage';

/**
 * GET /api/reports/projects
 * Retorna tots els projectes de l'usuari actual amb informació resumida
 */
export async function GET(request: NextRequest) {
  console.log("[API reports/projects] Rebuda petició GET");
  
  try {
    // Crear client SSR per autenticació
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => {
            return request.cookies.getAll().map(cookie => ({
              name: cookie.name,
              value: cookie.value,
            }))
          },
          setAll: () => {
            // No necessitem setAll en aquest context
          }
        }
      }
    );

    // Obtenir userId de la sessió
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[API reports/projects] Error obtenint informació de l'usuari:", authError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    const userId = user.id;
    console.log("[API reports/projects] Usuari autenticat:", userId);
    
    // Verificar variables d'entorn críticas
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error("[API reports/projects] ❌ NEXT_PUBLIC_SUPABASE_URL no està configurada");
      return NextResponse.json({ error: 'Error de configuració del servidor' }, { status: 500 });
    }
    
    console.log("[API reports/projects] ✅ Variables d'entorn correctes");
    
    console.log("[API reports/projects] Intent d'obtenir projectes per usuari:", userId);
    
    // Primer, intentem una consulta simple per verificar l'accés bàsic (RLS filtra automàticament)
    const { data: simpleProjects, error: simpleError } = await supabase
      .from('projects')
      .select('id, project_name, template_id, created_at')
      .order('created_at', { ascending: false });
      
    if (simpleError) {
      console.error("[API reports/projects] ❌ Error en consulta simple:", simpleError);
      return NextResponse.json({ 
        error: 'Error accedint a projectes (consulta bàsica).',
        details: simpleError.message 
      }, { status: 500 });
    }
    
    console.log(`[API reports/projects] ✅ Consulta simple OK: ${simpleProjects?.length || 0} projectes trobats`);
    
    // Ara intentem la consulta complexa (RLS filtra automàticament)
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        *,
        plantilla_configs!inner(
          config_name,
          base_docx_name
        ),
        generations(
          id,
          status
        )
      `)
      .order('created_at', { ascending: false });
    
    if (projectsError) {
      console.error("[API reports/projects] Error obtenint projectes:", projectsError);
      return NextResponse.json({ 
        error: 'Error obtenint projectes.',
        details: projectsError.message 
      }, { status: 500 });
    }
    
    // Processar dades per afegir estadístiques
    const projectsWithStats = projects.map(project => {
      const generations: Generation[] = project.generations || [];
      const totalGenerations = generations.length;
      const completedGenerations = generations.filter((g: Generation) => g.status === 'generated' || g.status === 'completed').length;
      const pendingGenerations = generations.filter((g: Generation) => g.status === 'pending').length;
      const errorGenerations = generations.filter((g: Generation) => g.status === 'error').length;
      
      // 🚀 ARQUITECTURA HÍBRIDA: Càrrega intel·ligent d'excel_data
      const excelDataSize = project.excel_data?.length || 0;
      const isLargeExcelData = excelDataSize > 100;
      
      return {
        id: project.id,
        project_name: project.project_name,
        excel_filename: project.excel_filename,
        total_rows: project.total_rows,
        template_id: project.template_id, // ✅ AFEGIT: Necessari per al botó intel·ligent
        template_name: project.plantilla_configs?.config_name || 'Plantilla desconeguda',
        template_docx_name: project.plantilla_configs?.base_docx_name || null,
        created_at: project.created_at,
        updated_at: project.updated_at,
        // 🎯 SOLUCIÓ ESCALABLE: Càrrega condicional d'excel_data
        excel_data: isLargeExcelData ? null : project.excel_data, // ✅ Només projectes petits
        excel_data_size: excelDataSize, // ✅ Informació de mida
        has_large_excel_data: isLargeExcelData, // ✅ Flag per lazy loading futur
        stats: {
          total: totalGenerations,
          completed: completedGenerations,
          pending: pendingGenerations,
          errors: errorGenerations,
          progress: totalGenerations > 0 ? Math.round((completedGenerations / totalGenerations) * 100) : 0
        }
      };
    });
    
    console.log(`[API reports/projects] ✅ Retornant ${projectsWithStats.length} projectes`);
    
    return NextResponse.json({
      projects: projectsWithStats
    }, { status: 200 });
    
  } catch (err) {
    console.error("[API reports/projects] Error general:", err);
    return NextResponse.json(
      { error: 'Error intern del servidor.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports/projects
 * Crea un nou projecte llegint l'Excel automàticament de la plantilla
 */
export async function POST(request: NextRequest) {
  console.log("[API reports/projects] Rebuda petició POST");
  
  try {
    const { template_id, project_name } = await request.json();
    
    // Validacions bàsiques
    if (!template_id || !project_name) {
      return NextResponse.json({ error: 'template_id i project_name són obligatoris.' }, { status: 400 });
    }
    
    // Crear client SSR per autenticació
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => {
            return request.cookies.getAll().map(cookie => ({
              name: cookie.name,
              value: cookie.value,
            }))
          },
          setAll: () => {
            // No necessitem setAll en aquest context
          }
        }
      }
    );

    // Obtenir userId de la sessió
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[API reports/projects] Error obtenint informació de l'usuari:", authError);
      return NextResponse.json({ error: 'Usuari no autenticat.' }, { status: 401 });
    }
    
    const userId = user.id;
    console.log(`[API reports/projects] Usuari autenticat: ${userId}, llegint Excel de plantilla: ${template_id}`);
    
    // Verificar que la plantilla existeix i té Excel associat (RLS filtra automàticament)
    const { data: template, error: templateError } = await supabase
      .from('plantilla_configs')
      .select('excel_storage_path, excel_file_name')
      .eq('id', template_id)
      .single();
    
    if (templateError) {
      console.error("[API reports/projects] Error obtenint plantilla:", templateError);
      return NextResponse.json({ 
        error: 'Plantilla no trobada o no accessible.',
        details: templateError.message 
      }, { status: 404 });
    }
    
    if (!template.excel_storage_path) {
      return NextResponse.json({ 
        error: 'La plantilla seleccionada no té un fitxer Excel associat. Puja un Excel a la plantilla primer.' 
      }, { status: 400 });
    }
    
    // Llegir les dades de l'Excel des de Storage
    let excelData;
    try {
      excelData = await readExcelFromStorage(template.excel_storage_path);
      console.log(`[API reports/projects] ✅ Excel llegit: ${excelData.totalRows} files, ${excelData.headers.length} columnes`);
    } catch (excelError) {
      console.error("[API reports/projects] Error llegint Excel:", excelError);
      return NextResponse.json({ 
        error: 'Error llegint el fitxer Excel de la plantilla.',
        details: excelError instanceof Error ? excelError.message : String(excelError)
      }, { status: 500 });
    }
    
    if (excelData.totalRows === 0) {
      return NextResponse.json({ 
        error: 'El fitxer Excel de la plantilla està buit o no conté dades vàlides.' 
      }, { status: 400 });
    }
    
    // Crear el projecte amb les dades llegides de l'Excel (RLS filtra automàticament)
    const { data: newProject, error: projectError } = await supabase
      .from('projects')
      .insert([{
        user_id: userId,
        template_id,
        project_name,
        excel_filename: template.excel_file_name || 'data.xlsx',
        excel_data: excelData.rows,
        total_rows: excelData.totalRows
      }])
      .select()
      .single();
    
    if (projectError) {
      console.error("[API reports/projects] Error creant projecte:", projectError);
      return NextResponse.json({ 
        error: 'Error creant projecte.',
        details: projectError.message 
      }, { status: 500 });
    }
    
    // Crear registres de generació per a cada fila de l'Excel (RLS filtra automàticament via project_id)
    const generationRecords = excelData.rows.map((rowData, index) => ({
      project_id: newProject.id,
      excel_row_index: index,
      row_data: rowData,
      status: 'pending'
    }));
    
    const { error: generationsError } = await supabase
      .from('generations')
      .insert(generationRecords);
    
    if (generationsError) {
      console.warn("[API reports/projects] Error creant registres de generació:", generationsError);
      // No fallem completament, el projecte ja està creat
    } else {
      console.log(`[API reports/projects] ✅ Creats ${generationRecords.length} registres de generació`);
    }
    
    console.log(`[API reports/projects] ✅ Projecte creat amb ID: ${newProject.id}`);
    
    return NextResponse.json({
      message: 'Projecte creat correctament!',
      project: newProject,
      excelInfo: {
        filename: template.excel_file_name,
        totalRows: excelData.totalRows,
        headers: excelData.headers
      }
    }, { status: 201 });
    
  } catch (err) {
    console.error("[API reports/projects] Error general:", err);
    return NextResponse.json(
      { error: 'Error intern del servidor.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
