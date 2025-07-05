import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function DELETE(request: NextRequest) {
  try {
    console.log('🧹 Iniciant neteja de plantilles...');
    
    // Crear client de Supabase amb service role (sense autenticació)
    const supabase = createServerSupabaseClient(true); // true = usar service role
    
    // 1. Obtenir totes les plantilles
    const { data: templates, error: fetchError } = await supabase
      .from('templates')
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
        if (template.original_docx_path) {
          const { error: docxError } = await supabase.storage
            .from('templates')
            .remove([template.original_docx_path]);
          if (docxError) {
            console.warn(`⚠️ Error eliminant DOCX ${template.original_docx_path}:`, docxError);
            storageErrors.push({ file: template.original_docx_path, error: docxError });
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
    
