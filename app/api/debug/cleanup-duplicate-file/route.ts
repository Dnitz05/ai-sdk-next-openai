import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Verificar variables d'entorn
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL no està definida');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY no està definida');
}

// Utilitzar clau anònima per diagnòstic (amb permisos limitats)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function DELETE(request: NextRequest) {
  try {
    console.log('[cleanup-duplicate-file] Iniciant neteja de fitxer duplicat...');
    
    // Fitxer duplicat problemàtic identificat
    const duplicateFilePath = 'user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-d338ef63-7656-4d16-a373-6d988b1fe73e/indexed/original.docx';
    
    console.log(`[cleanup-duplicate-file] Eliminant fitxer duplicat: ${duplicateFilePath}`);
    
    // Verificar que el fitxer existeix abans d'eliminar
    const { data: listData, error: listError } = await supabaseAdmin.storage
      .from('template-docx')
      .list('user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-d338ef63-7656-4d16-a373-6d988b1fe73e/indexed', {
        limit: 10
      });
    
    if (listError) {
      console.error('[cleanup-duplicate-file] Error llistant fitxers:', listError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error llistant fitxers',
        details: listError 
      }, { status: 500 });
    }
    
    console.log('[cleanup-duplicate-file] Fitxers a /indexed/:', listData?.map(f => f.name));
    
    const duplicateExists = listData?.some(f => f.name === 'original.docx');
    
    if (!duplicateExists) {
      console.log('[cleanup-duplicate-file] El fitxer duplicat ja no existeix');
      return NextResponse.json({ 
        success: true, 
        message: 'El fitxer duplicat ja no existeix',
        files_in_indexed: listData?.map(f => f.name) || []
      });
    }
    
    // Eliminar el fitxer duplicat
    const { data, error } = await supabaseAdmin.storage
      .from('template-docx')
      .remove([duplicateFilePath]);
    
    if (error) {
      console.error('[cleanup-duplicate-file] Error eliminant fitxer:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Error eliminant fitxer duplicat',
        details: error 
      }, { status: 500 });
    }
    
    console.log('[cleanup-duplicate-file] Fitxer duplicat eliminat correctament:', data);
    
    // Verificar que s'ha eliminat
    const { data: listDataAfter, error: listErrorAfter } = await supabaseAdmin.storage
      .from('template-docx')
      .list('user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-d338ef63-7656-4d16-a373-6d988b1fe73e/indexed', {
        limit: 10
      });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Fitxer duplicat eliminat correctament',
      removed_files: data,
      files_remaining_in_indexed: listDataAfter?.map(f => f.name) || []
    });
    
  } catch (error) {
    console.error('[cleanup-duplicate-file] Error inesperat:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error inesperat',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('[cleanup-duplicate-file] Verificant estat dels fitxers...');
    
    // Llistar fitxers a /indexed/
    const { data: indexedFiles, error: indexedError } = await supabaseAdmin.storage
      .from('template-docx')
      .list('user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-d338ef63-7656-4d16-a373-6d988b1fe73e/indexed', {
        limit: 10
      });
    
    // Llistar fitxers a /original/
    const { data: originalFiles, error: originalError } = await supabaseAdmin.storage
      .from('template-docx')
      .list('user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-d338ef63-7656-4d16-a373-6d988b1fe73e/original', {
        limit: 10
      });
    
    // Llistar fitxers a /placeholder/
    const { data: placeholderFiles, error: placeholderError } = await supabaseAdmin.storage
      .from('template-docx')
      .list('user-2c439ad3-2097-4f17-a1a3-1b4fa8967075/template-d338ef63-7656-4d16-a373-6d988b1fe73e/placeholder', {
        limit: 10
      });
    
    const duplicateExists = indexedFiles?.some(f => f.name === 'original.docx');
    
    return NextResponse.json({
      success: true,
      duplicate_file_exists: duplicateExists,
      files: {
        indexed: indexedFiles?.map(f => ({ name: f.name, size: f.metadata?.size })) || [],
        original: originalFiles?.map(f => ({ name: f.name, size: f.metadata?.size })) || [],
        placeholder: placeholderFiles?.map(f => ({ name: f.name, size: f.metadata?.size })) || []
      },
      errors: {
        indexed: indexedError,
        original: originalError,
        placeholder: placeholderError
      }
    });
    
  } catch (error) {
    console.error('[cleanup-duplicate-file] Error verificant fitxers:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error verificant fitxers',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
