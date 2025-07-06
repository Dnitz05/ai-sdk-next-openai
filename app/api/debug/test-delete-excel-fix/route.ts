// app/api/debug/test-delete-excel-fix/route.ts
import { NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();

  try {
    const supabase = createUserSupabaseClient(accessToken);
    
    // Obtenir l'usuari actual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Error obtenint usuari' }, { status: 401 });
    }

    console.log(`[TEST Delete Excel Fix] Verificant eliminació completa per usuari: ${user.id}`);

    // Obtenir totes les plantilles de l'usuari
    const { data: templates, error: templatesError } = await supabase
      .from('plantilla_configs')
      .select('id, config_name')
      .eq('user_id', user.id);

    if (templatesError) {
      return NextResponse.json({ 
        error: 'Error obtenint plantilles', 
        details: templatesError.message 
      }, { status: 500 });
    }

    const results = [];
    const userPrefix = `user-${user.id}/`;

    // Verificar cada plantilla
    for (const template of templates || []) {
      const templatePrefix = `${userPrefix}template-${template.id}/`;
      
      console.log(`[TEST] Verificant plantilla: ${template.config_name} (${template.id})`);
      
      const templateResult = {
        templateId: template.id,
        templateName: template.config_name,
        folders: {} as Record<string, any>,
        totalFiles: 0,
        hasExcelFolder: false
      };

      // Verificar cada subcarpeta
      for (const subfolder of ['original', 'indexed', 'placeholder', 'excel']) {
        const { data: subFiles, error: listError } = await supabase.storage
          .from('template-docx')
          .list(`${templatePrefix}${subfolder}`, { limit: 1000 });
        
        if (listError) {
          templateResult.folders[subfolder] = { error: listError.message };
        } else {
          const fileCount = subFiles?.length || 0;
          templateResult.folders[subfolder] = {
            fileCount,
            files: subFiles?.map(f => f.name) || []
          };
          templateResult.totalFiles += fileCount;
          
          if (subfolder === 'excel' && fileCount > 0) {
            templateResult.hasExcelFolder = true;
          }
        }
      }

      // Verificar fitxers a l'arrel
      const { data: rootFiles, error: rootError } = await supabase.storage
        .from('template-docx')
        .list(templatePrefix, { limit: 1000 });
      
      if (!rootError && rootFiles) {
        const rootFileCount = rootFiles.filter(f => 
          f.name && !['original', 'indexed', 'placeholder', 'excel'].includes(f.name)
        ).length;
        
        templateResult.folders['root'] = {
          fileCount: rootFileCount,
          files: rootFiles.filter(f => 
            f.name && !['original', 'indexed', 'placeholder', 'excel'].includes(f.name)
          ).map(f => f.name)
        };
        templateResult.totalFiles += rootFileCount;
      }

      results.push(templateResult);
    }

    // Resum general
    const summary = {
      totalTemplates: templates?.length || 0,
      templatesWithExcelFiles: results.filter(r => r.hasExcelFolder).length,
      templatesWithAnyFiles: results.filter(r => r.totalFiles > 0).length,
      potentialProblems: results.filter(r => r.hasExcelFolder).map(r => ({
        id: r.templateId,
        name: r.templateName,
        excelFiles: r.folders.excel?.fileCount || 0
      }))
    };

    console.log(`[TEST Delete Excel Fix] Resum:`, summary);

    return NextResponse.json({
      success: true,
      summary,
      detailedResults: results,
      message: summary.templatesWithExcelFiles > 0 
        ? `⚠️ Trobades ${summary.templatesWithExcelFiles} plantilles amb fitxers Excel que podrien causar problemes d'eliminació`
        : '✅ No s\'han trobat plantilles amb fitxers Excel orfes'
    });

  } catch (error) {
    console.error('[TEST Delete Excel Fix] Error:', error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
  }
  const accessToken = authHeader.replace('Bearer ', '').trim();

  try {
    const { templateId } = await request.json();
    
    if (!templateId) {
      return NextResponse.json({ error: 'templateId requerit' }, { status: 400 });
    }

    console.log(`[TEST Delete Excel Fix] Simulant eliminació de plantilla: ${templateId}`);

    const supabase = createUserSupabaseClient(accessToken);
    
    // Obtenir l'usuari actual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Error obtenint usuari' }, { status: 401 });
    }

    const userPrefix = `user-${user.id}/`;
    const templatePrefix = `${userPrefix}template-${templateId}/`;
    
    // Simular el procés d'eliminació amb la nova lògica
    const allFiles: string[] = [];
    const folderResults = {} as Record<string, any>;

    // Llistar fitxers en TOTES les subcarpetes (incloent excel)
    for (const subfolder of ['original', 'indexed', 'placeholder', 'excel']) {
      const { data: subFiles, error: listError } = await supabase.storage
        .from('template-docx')
        .list(`${templatePrefix}${subfolder}`, { limit: 1000 });
      
      if (listError) {
        folderResults[subfolder] = { error: listError.message };
      } else {
        const fileCount = subFiles?.length || 0;
        folderResults[subfolder] = {
          fileCount,
          files: subFiles?.map(f => f.name) || []
        };
        
        if (subFiles) {
          subFiles.forEach(file => {
            allFiles.push(`${templatePrefix}${subfolder}/${file.name}`);
          });
        }
      }
    }
    
    // També llistar fitxers a l'arrel
    const { data: rootFiles, error: rootError } = await supabase.storage
      .from('template-docx')
      .list(templatePrefix, { limit: 1000 });
    
    if (!rootError && rootFiles) {
      const relevantRootFiles = rootFiles.filter(file => 
        file.name && !['original', 'indexed', 'placeholder', 'excel'].includes(file.name)
      );
      
      folderResults['root'] = {
        fileCount: relevantRootFiles.length,
        files: relevantRootFiles.map(f => f.name)
      };
      
      relevantRootFiles.forEach(file => {
        allFiles.push(`${templatePrefix}${file.name}`);
      });
    }

    return NextResponse.json({
      success: true,
      simulation: true,
      templateId,
      templatePrefix,
      folderResults,
      totalFilesToDelete: allFiles.length,
      filesToDelete: allFiles,
      message: allFiles.length > 0 
        ? `✅ La nova lògica eliminaria ${allFiles.length} fitxers correctament (incloent Excel)`
        : 'ℹ️ No hi ha fitxers per eliminar'
    });

  } catch (error) {
    console.error('[TEST Delete Excel Fix] Error en simulació:', error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
