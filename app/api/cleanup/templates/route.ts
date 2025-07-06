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
    
    // 2. Eliminar fitxers de Storage per cada plantilla
    const storageErrors: any[] = [];
    for (const template of templates) {
      try {
        // Eliminar DOCX original si existeix
        if (template.base_docx_storage_path) {
          const { error: docxError } = await supabase.storage
            .from('templates')
            .remove([template.base_docx_storage_path]);
          if (docxError) {
            console.warn(`⚠️ Error eliminant DOCX ${template.base_docx_storage_path}:`, docxError);
            storageErrors.push({ file: template.base_docx_storage_path, error: docxError });
          }
        }
        
        // Eliminar Excel si existeix
        if (template.excel_storage_path) {
          const { error: excelError } = await supabase.storage
            .from('templates')
            .remove([template.excel_storage_path]);
          if (excelError) {
            console.warn(`⚠️ Error eliminant Excel ${template.excel_storage_path}:`, excelError);
            storageErrors.push({ file: template.excel_storage_path, error: excelError });
          }
        }
        
        // Eliminar DOCX de placeholders si existeix
        if (template.placeholder_docx_storage_path) {
          const { error: placeholderError } = await supabase.storage
            .from('templates')
            .remove([template.placeholder_docx_storage_path]);
          if (placeholderError) {
            console.warn(`⚠️ Error eliminant placeholder DOCX ${template.placeholder_docx_storage_path}:`, placeholderError);
            storageErrors.push({ file: template.placeholder_docx_storage_path, error: placeholderError });
          }
        }
        
        console.log(`🗑️ Fitxers eliminats per plantilla ${template.id}`);
      } catch (err) {
        console.error(`Error eliminant fitxers per plantilla ${template.id}:`, err);
        storageErrors.push({ template: template.id, error: err });
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
