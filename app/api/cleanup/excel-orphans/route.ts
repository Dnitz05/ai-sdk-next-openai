// app/api/cleanup/excel-orphans/route.ts
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

    console.log(`[CLEANUP Excel Orphans] Buscant carpetes Excel orfes per usuari: ${user.id}`);

    // Obtenir totes les plantilles existents de l'usuari
    const { data: templates, error: templatesError } = await supabase
      .from('plantilla_configs')
      .select('id')
      .eq('user_id', user.id);

    if (templatesError) {
      return NextResponse.json({ 
        error: 'Error obtenint plantilles', 
        details: templatesError.message 
      }, { status: 500 });
    }

    const validTemplateIds = new Set((templates || []).map(t => t.id));
    const userPrefix = `user-${user.id}/`;
    
    // Llistar totes les carpetes template- de l'usuari
    const { data: userFolders, error: listError } = await supabase.storage
      .from('template-docx')
      .list(userPrefix, { limit: 1000 });

    if (listError) {
      return NextResponse.json({ 
        error: 'Error llistant carpetes d\'usuari', 
        details: listError.message 
      }, { status: 500 });
    }

    const orphanedExcelFolders = [];
    const validTemplateFolders = [];

    // Verificar cada carpeta template-
    for (const folder of userFolders || []) {
      if (folder.name && folder.name.startsWith('template-')) {
        const templateId = folder.name.replace('template-', '');
        const templatePrefix = `${userPrefix}${folder.name}/`;
        
        if (!validTemplateIds.has(templateId)) {
          // Aquesta carpeta és òrfena - verificar si té subcarpeta excel
          const { data: excelFiles, error: excelError } = await supabase.storage
            .from('template-docx')
            .list(`${templatePrefix}excel`, { limit: 1000 });
          
          if (!excelError && excelFiles && excelFiles.length > 0) {
            orphanedExcelFolders.push({
              templateId,
              templatePrefix,
              excelFileCount: excelFiles.length,
              excelFiles: excelFiles.map(f => f.name)
            });
          }
        } else {
          validTemplateFolders.push({
            templateId,
            templatePrefix
          });
        }
      }
    }

    console.log(`[CLEANUP Excel Orphans] Trobades ${orphanedExcelFolders.length} carpetes Excel orfes`);

    return NextResponse.json({
      success: true,
      summary: {
        totalTemplateFolders: userFolders?.filter(f => f.name?.startsWith('template-')).length || 0,
        validTemplateFolders: validTemplateFolders.length,
        orphanedExcelFolders: orphanedExcelFolders.length,
        totalOrphanedExcelFiles: orphanedExcelFolders.reduce((sum, folder) => sum + folder.excelFileCount, 0)
      },
      orphanedExcelFolders,
      validTemplateFolders,
      message: orphanedExcelFolders.length > 0 
        ? `⚠️ Trobades ${orphanedExcelFolders.length} carpetes Excel orfes que es poden netejar`
        : '✅ No hi ha carpetes Excel orfes'
    });

  } catch (error) {
    console.error('[CLEANUP Excel Orphans] Error:', error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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

    console.log(`[CLEANUP Excel Orphans] Eliminant carpetes Excel orfes per usuari: ${user.id}`);

    // Primer, obtenir la llista de carpetes orfes (reutilitzant la lògica del GET)
    const { data: templates, error: templatesError } = await supabase
      .from('plantilla_configs')
      .select('id')
      .eq('user_id', user.id);

    if (templatesError) {
      return NextResponse.json({ 
        error: 'Error obtenint plantilles', 
        details: templatesError.message 
      }, { status: 500 });
    }

    const validTemplateIds = new Set((templates || []).map(t => t.id));
    const userPrefix = `user-${user.id}/`;
    
    const { data: userFolders, error: listError } = await supabase.storage
      .from('template-docx')
      .list(userPrefix, { limit: 1000 });

    if (listError) {
      return NextResponse.json({ 
        error: 'Error llistant carpetes d\'usuari', 
        details: listError.message 
      }, { status: 500 });
    }

    const filesToDelete: string[] = [];
    const orphanedFoldersProcessed = [];

    // Identificar i preparar eliminació de carpetes orfes
    for (const folder of userFolders || []) {
      if (folder.name && folder.name.startsWith('template-')) {
        const templateId = folder.name.replace('template-', '');
        const templatePrefix = `${userPrefix}${folder.name}/`;
        
        if (!validTemplateIds.has(templateId)) {
          // Aquesta carpeta és òrfena - eliminar tots els fitxers
          console.log(`[CLEANUP] Processant carpeta òrfena: ${templatePrefix}`);
          
          // Eliminar fitxers de totes les subcarpetes
          for (const subfolder of ['original', 'indexed', 'placeholder', 'excel']) {
            const { data: subFiles, error: subError } = await supabase.storage
              .from('template-docx')
              .list(`${templatePrefix}${subfolder}`, { limit: 1000 });
            
            if (!subError && subFiles) {
              subFiles.forEach(file => {
                filesToDelete.push(`${templatePrefix}${subfolder}/${file.name}`);
              });
            }
          }
          
          // Eliminar fitxers a l'arrel
          const { data: rootFiles, error: rootError } = await supabase.storage
            .from('template-docx')
            .list(templatePrefix, { limit: 1000 });
          
          if (!rootError && rootFiles) {
            rootFiles.forEach(file => {
              if (file.name && !['original', 'indexed', 'placeholder', 'excel'].includes(file.name)) {
                filesToDelete.push(`${templatePrefix}${file.name}`);
              }
            });
          }
          
          orphanedFoldersProcessed.push({
            templateId,
            templatePrefix
          });
        }
      }
    }

    // Executar eliminació
    let deletedFilesCount = 0;
    if (filesToDelete.length > 0) {
      console.log(`[CLEANUP] Eliminant ${filesToDelete.length} fitxers orfes...`);
      
      const { error: deleteError } = await supabase.storage
        .from('template-docx')
        .remove(filesToDelete);
      
      if (deleteError) {
        console.error('[CLEANUP] Error eliminant fitxers:', deleteError);
        return NextResponse.json({
          error: 'Error eliminant fitxers orfes',
          details: deleteError.message,
          partialSuccess: true,
          orphanedFoldersFound: orphanedFoldersProcessed.length
        }, { status: 500 });
      } else {
        deletedFilesCount = filesToDelete.length;
        console.log(`[CLEANUP] ✅ ${deletedFilesCount} fitxers orfes eliminats correctament`);
      }
    }

    return NextResponse.json({
      success: true,
      deletedFilesCount,
      orphanedFoldersProcessed: orphanedFoldersProcessed.length,
      orphanedFolders: orphanedFoldersProcessed,
      message: deletedFilesCount > 0 
        ? `✅ Eliminats ${deletedFilesCount} fitxers orfes de ${orphanedFoldersProcessed.length} carpetes`
        : 'ℹ️ No hi havia fitxers orfes per eliminar'
    });

  } catch (error) {
    console.error('[CLEANUP Excel Orphans] Error en eliminació:', error);
    return NextResponse.json({
      error: 'Error intern del servidor',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
