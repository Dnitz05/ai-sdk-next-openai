import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

export async function DELETE(request: NextRequest) {
  try {
    console.log('🧹 Iniciant neteja de plantilles...');
    
    // 1. Llegeix el token de l'Authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
    }
    const accessToken = authHeader.replace('Bearer ', '').trim();

    // 2. Crea el client Supabase autenticat amb el token de l'usuari
    const supabase = createUserSupabaseClient(accessToken);
    
    // 1. Obtenir totes les plantilles
    const { data: templates, error: fetchError } = await supabase
      .from('plantilla_configs')
      .select('*');
    
    if (fetchError) {
      console.error('Error obtenint plantilles:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error obtenint plantilles',
        details: fetchError 
      }, { status: 500 });
    }
    
    console.log(`📋 Trobades ${templates?.length || 0} plantilles per eliminar`);
    
    if (!templates || templates.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hi ha plantilles per eliminar',
        deleted: 0
      });
    }
    
    // 2. Eliminar carpetes completes de Storage per cada plantilla
    const storageErrors: any[] = [];
    
    // Obtenir l'usuari actual per construir el path correcte
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn('No s\'ha pogut obtenir l\'usuari per eliminar fitxers del Storage');
    } else {
      const userPrefix = `user-${user.id}/`;
      
      for (const template of templates) {
        try {
          // Construir el prefix de la carpeta de la plantilla
          const templatePrefix = `${userPrefix}template-${template.id}/`;
          
          // Llistar tots els fitxers de la carpeta de la plantilla
          const { data: files, error: listError } = await supabase.storage
            .from('template-docx')
            .list(templatePrefix, { limit: 1000 });
          
          if (listError) {
            console.warn(`⚠️ Error llistant fitxers per plantilla ${template.id}:`, listError);
            storageErrors.push({ template: template.id, error: listError });
            continue;
          }
          
          if (files && files.length > 0) {
            // Obtenir tots els fitxers recursivament
            const allFiles: string[] = [];
            
            // Llistar fitxers en subcarpetes
            for (const subfolder of ['original', 'indexed', 'placeholder']) {
              const { data: subFiles } = await supabase.storage
                .from('template-docx')
                .list(`${templatePrefix}${subfolder}`, { limit: 1000 });
              
              if (subFiles) {
                subFiles.forEach(file => {
                  allFiles.push(`${templatePrefix}${subfolder}/${file.name}`);
                });
              }
            }
            
            // Eliminar tots els fitxers
            if (allFiles.length > 0) {
              const { error: deleteError } = await supabase.storage
                .from('template-docx')
                .remove(allFiles);
              
              if (deleteError) {
                console.warn(`⚠️ Error eliminant fitxers per plantilla ${template.id}:`, deleteError);
                storageErrors.push({ template: template.id, error: deleteError });
              } else {
                console.log(`🗑️ ${allFiles.length} fitxers eliminats per plantilla ${template.id}`);
              }
            }
          }
        } catch (err) {
          console.error(`Error eliminant fitxers per plantilla ${template.id}:`, err);
          storageErrors.push({ template: template.id, error: err });
        }
      }
    }
    
    // 3. Eliminar registres de la base de dades
    const { error: deleteError } = await supabase
      .from('plantilla_configs')
      .delete()
      .neq('id', 'impossible-id'); // Elimina tots els registres
    
    if (deleteError) {
      console.error('Error eliminant plantilles de la BD:', deleteError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error eliminant plantilles de la base de dades',
        details: deleteError,
        storageErrors 
      }, { status: 500 });
    }
    
    console.log('✅ Neteja completada amb èxit');
    
    return NextResponse.json({ 
      success: true, 
      message: `S'han eliminat ${templates.length} plantilles correctament`,
      deleted: templates.length,
      storageErrors: storageErrors.length > 0 ? storageErrors : undefined
    });
    
  } catch (error) {
    console.error('Error general en la neteja:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error general en la neteja',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Endpoint de neteja de plantilles. Usa DELETE per eliminar totes les plantilles.',
    usage: 'DELETE /api/cleanup/templates'
  });
}
