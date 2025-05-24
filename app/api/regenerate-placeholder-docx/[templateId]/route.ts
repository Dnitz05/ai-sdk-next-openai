import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { ExcelLinkMapping, AIInstruction } from '@/app/types';
import { indexDocxWithSdts, isDocxIndexed } from '@/util/docx/indexDocxWithSdts';
import { generatePlaceholderDocxWithIds } from '@/util/docx/generatePlaceholderDocxWithIds';

/**
 * API per regenerar el placeholder DOCX d'una plantilla específica
 * 
 * Aquesta ruta permet regenerar el documento placeholder per a una plantilla existent,
 * utilitzant els linkMappings i aiInstructions de la configuració actual,
 * però aplicant-los sobre una versió indexada del document original (amb SDTs)
 * per garantir la precisió en la generació de placeholders.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  console.log(`[API regenerate-placeholder-docx] Inici amb ID: ${params.templateId}`);
  
  try {
    // Crear el client Supabase amb les credencials de service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    
    // 1. Obtenir les dades de la plantilla
    const { data: template, error: templateError } = await supabase
      .from('plantilles')
      .select('*')
      .eq('id', params.templateId)
      .single();
    
    if (templateError || !template) {
      console.error(`[API regenerate-placeholder-docx] Error obtenint plantilla:`, templateError);
      return NextResponse.json({ error: 'No s\'ha trobat la plantilla' }, { status: 404 });
    }
    
    const { data: originalDocxData, error: originalDocxError } = await supabase
      .storage
      .from('plantilles')
      .download(`original_docs/${template.docx_path}`);
    
    if (originalDocxError || !originalDocxData) {
      console.error(`[API regenerate-placeholder-docx] Error obtenint document original:`, originalDocxError);
      return NextResponse.json({ error: 'No s\'ha pogut obtenir el document original' }, { status: 404 });
    }
    
    // Convertir el Blob a Buffer utilitzant Uint8Array per evitar problemes de tipus
    const arrayBuffer = await originalDocxData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const originalDocxBuffer = Buffer.from(uint8Array);
    console.log(`[API regenerate-placeholder-docx] Document original obtingut, mida: ${originalDocxBuffer.length} bytes`);
    
    // 2. Obtenir les configuracions de link mappings i AI instructions
    const configuration = template.configuration || {};
    const linkMappings = configuration.linkMappings || [];
    const aiInstructions = configuration.aiInstructions || [];
    
    console.log(`[API regenerate-placeholder-docx] Configuració obtinguda:`, {
      linkMappingsCount: linkMappings.length,
      aiInstructionsCount: aiInstructions.length
    });
    
    // 3. Verificar si el document ja està indexat
    const isIndexed = await isDocxIndexed(originalDocxBuffer);
    
    let indexedDocxBuffer = originalDocxBuffer;
    
    // Si no està indexat, indexar-lo primer
    if (!isIndexed.indexed) {
      console.log(`[API regenerate-placeholder-docx] Document no indexat. Procedint a indexar...`);
      
      try {
        const indexResult = await indexDocxWithSdts(originalDocxBuffer);
        indexedDocxBuffer = indexResult.indexedBuffer;
        console.log(`[API regenerate-placeholder-docx] Document indexat correctament amb ${Object.keys(indexResult.idMap).length} IDs`);
      } catch (indexError) {
        console.error(`[API regenerate-placeholder-docx] Error indexant document:`, indexError);
        return NextResponse.json({ error: 'No s\'ha pogut indexar el document' }, { status: 500 });
      }
    } else {
      console.log(`[API regenerate-placeholder-docx] Document ja indexat amb ${isIndexed.sdtCount} SDTs`);
    }
    
    // 4. Generar el nou placeholder utilitzant generatePlaceholderDocxWithIds
    let placeholderBuffer: Buffer;
    
    try {
      console.log(`[API regenerate-placeholder-docx] Generant placeholder amb el nou algoritme basat en IDs...`);
      placeholderBuffer = await generatePlaceholderDocxWithIds(
        indexedDocxBuffer,
        linkMappings as ExcelLinkMapping[],
        aiInstructions as AIInstruction[]
      );
      
      console.log(`[API regenerate-placeholder-docx] Placeholder generat correctament, mida: ${placeholderBuffer.length} bytes`);
    } catch (placeholderError) {
      console.error(`[API regenerate-placeholder-docx] Error generant placeholder:`, placeholderError);
      return NextResponse.json({ error: 'No s\'ha pogut generar el placeholder' }, { status: 500 });
    }
    
    // 5. Pujar el nou placeholder a Supabase Storage
    const placeholderPath = `placeholder_docs/${template.docx_path}`;
    
    try {
      const { error: uploadError } = await supabase
        .storage
        .from('plantilles')
        .upload(placeholderPath, placeholderBuffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true
        });
      
      if (uploadError) {
        console.error(`[API regenerate-placeholder-docx] Error pujant placeholder:`, uploadError);
        return NextResponse.json({ error: 'No s\'ha pogut pujar el placeholder' }, { status: 500 });
      }
      
      console.log(`[API regenerate-placeholder-docx] Placeholder pujat correctament a ${placeholderPath}`);
      
      // Si hem hagut d'indexar el document, també desem la versió indexada
      if (!isIndexed.indexed) {
        const indexedPath = `indexed_docs/${template.docx_path}`;
        
        const { error: indexedUploadError } = await supabase
          .storage
          .from('plantilles')
          .upload(indexedPath, indexedDocxBuffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            upsert: true
          });
        
        if (indexedUploadError) {
          console.warn(`[API regenerate-placeholder-docx] Avís: No s'ha pogut pujar el document indexat:`, indexedUploadError);
        } else {
          console.log(`[API regenerate-placeholder-docx] Document indexat desat a ${indexedPath}`);
          
          // Actualitzar la referència al document indexat a la base de dades
          const { error: updateError } = await supabase
            .from('plantilles')
            .update({
              indexed_docx_path: indexedPath.replace('indexed_docs/', '')
            })
            .eq('id', params.templateId);
          
          if (updateError) {
            console.warn(`[API regenerate-placeholder-docx] Avís: No s'ha pogut actualitzar la referència al document indexat:`, updateError);
          }
        }
      }
    } catch (storageError) {
      console.error(`[API regenerate-placeholder-docx] Error amb l'emmagatzematge:`, storageError);
      return NextResponse.json({ error: 'Error d\'emmagatzematge' }, { status: 500 });
    }
    
    // 6. Retornar resposta d'èxit
    return NextResponse.json({
      success: true,
      message: 'Placeholder regenerat correctament',
      placeholderSize: placeholderBuffer.length
    }, { status: 200 });
  } catch (error) {
    console.error(`[API regenerate-placeholder-docx] Error no controlat:`, error);
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 });
  }
}
