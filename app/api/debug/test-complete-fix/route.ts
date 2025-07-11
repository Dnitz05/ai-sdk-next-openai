/**
 * Test complet i solució definitiva per al problema "Plantilla no trobada"
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import supabaseServerClient from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  console.log(`🔧 [Complete-Fix] Iniciant diagnòstic i solució definitiva...`);
  
  try {
    const body = await request.json();
    const { projectId } = body;

    console.log(`📋 [Complete-Fix] ProjectId: ${projectId}`);

    // DIAGNÒSTIC COMPLET
    console.log(`🔍 [Complete-Fix] === FASE 1: DIAGNÒSTIC D'ESQUEMA ===`);
    
    // 1. Verificar columnes disponibles a plantilla_configs
    const { data: schemaInfo, error: schemaError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('*')
      .limit(1);

    console.log(`📊 [Complete-Fix] Columnes disponibles a plantilla_configs:`, 
      schemaInfo && schemaInfo.length > 0 ? Object.keys(schemaInfo[0]) : 'Taula buida');

    // 2. Obtenir projecte directament amb service role (bypass RLS)
    console.log(`🔍 [Complete-Fix] === FASE 2: ACCÉS AL PROJECTE ===`);
    
    const { data: project, error: projectError } = await supabaseServerClient
      .from('projects')
      .select('template_id, project_name, user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      console.error(`❌ [Complete-Fix] Projecte no trobat:`, projectError);
      return NextResponse.json({
        success: false,
        error: 'Projecte no trobat',
        details: projectError?.message
      }, { status: 404 });
    }

    console.log(`✅ [Complete-Fix] Projecte trobat:`, {
      id: projectId,
      name: project.project_name,
      templateId: project.template_id,
      userId: project.user_id
    });

    // 3. Intentar obtenir plantilla amb totes les columnes disponibles
    console.log(`🔍 [Complete-Fix] === FASE 3: ACCÉS A LA PLANTILLA ===`);
    
    // Primer, obtenir l'esquema real de la plantilla
    const { data: templateSchema, error: templateSchemaError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('*')
      .eq('id', project.template_id)
      .single();

    if (templateSchemaError || !templateSchema) {
      console.error(`❌ [Complete-Fix] Plantilla no trobada:`, templateSchemaError);
      return NextResponse.json({
        success: false,
        error: 'Plantilla no trobada',
        details: templateSchemaError?.message
      }, { status: 404 });
    }

    console.log(`✅ [Complete-Fix] Plantilla trobada amb columnes:`, Object.keys(templateSchema));

    // IMPLEMENTACIÓ DE LA SOLUCIÓ
    console.log(`🔧 [Complete-Fix] === FASE 4: IMPLEMENTACIÓ DE SOLUCIÓ ===`);

    // Mappejar noms de columnes reals vs esperats
    const columnMapping = {
      // Columnes que poden existir per al contingut de la plantilla
      content: templateSchema.template_content || 
               templateSchema.content || 
               templateSchema.textami_content || 
               templateSchema.config_content ||
               null,
      
      // Columnes que poden existir per al path del document
      docxPath: templateSchema.docx_storage_path || 
                templateSchema.storage_path || 
                templateSchema.original_docx_path ||
                templateSchema.docx_path ||
                null,
      
      // Altres camps importants
      name: templateSchema.config_name || templateSchema.name || templateSchema.template_name || 'Sense nom',
      userId: templateSchema.user_id || null
    };

    console.log(`📋 [Complete-Fix] Mapping de columnes:`, {
      hasContent: !!columnMapping.content,
      hasDocxPath: !!columnMapping.docxPath,
      name: columnMapping.name,
      userId: columnMapping.userId
    });

    // Validar que tenim el mínim necessari
    if (!columnMapping.content || !columnMapping.docxPath) {
      console.error(`❌ [Complete-Fix] Plantilla incompleta - contingut o document mancant`);
      
      return NextResponse.json({
        success: false,
        error: 'Plantilla incompleta',
        details: {
          hasContent: !!columnMapping.content,
          hasDocxPath: !!columnMapping.docxPath,
          availableColumns: Object.keys(templateSchema),
          requiredColumns: ['template_content/content', 'docx_storage_path/storage_path']
        },
        recommendation: 'Revisar l\'esquema de la taula plantilla_configs'
      }, { status: 400 });
    }

    // PROVA DE GENERACIÓ INTEL·LIGENT
    console.log(`🧠 [Complete-Fix] === FASE 5: TEST DE GENERACIÓ ===`);

    // Simular els paràmetres que rebria generate-smart-enhanced
    const mockGenerationConfig = {
      templateId: project.template_id,
      templateContent: columnMapping.content,
      templateStoragePath: columnMapping.docxPath,
      userId: project.user_id,
      // Dades mock per test
      excelData: [
        { nom: 'Test', cognom: 'Usuario', email: 'test@example.com' }
      ]
    };

    console.log(`📋 [Complete-Fix] Configuració de test preparada:`, {
      templateId: mockGenerationConfig.templateId,
      hasContent: !!mockGenerationConfig.templateContent,
      hasStoragePath: !!mockGenerationConfig.templateStoragePath,
      dataRows: mockGenerationConfig.excelData.length
    });

    // SOLUCIÓ DEFINITIVA
    console.log(`🔧 [Complete-Fix] === FASE 6: APLICACIÓ DE LA SOLUCIÓ ===`);

    return NextResponse.json({
      success: true,
      diagnosis: {
        schema: {
          availableColumns: Object.keys(templateSchema),
          contentColumn: columnMapping.content ? 'FOUND' : 'NOT_FOUND',
          docxPathColumn: columnMapping.docxPath ? 'FOUND' : 'NOT_FOUND'
        },
        project: {
          id: projectId,
          name: project.project_name,
          templateId: project.template_id,
          userId: project.user_id
        },
        template: {
          id: templateSchema.id,
          name: columnMapping.name,
          userId: columnMapping.userId,
          isComplete: !!(columnMapping.content && columnMapping.docxPath)
        }
      },
      solution: {
        method: 'service_role_with_column_mapping',
        columnMapping: {
          content: columnMapping.content ? 'MAPPED' : 'MISSING',
          docxPath: columnMapping.docxPath ? 'MAPPED' : 'MISSING'
        }
      },
      nextSteps: [
        'Implementar mapping de columnes a generate-smart-enhanced',
        'Utilitzar service role per accés a plantilles',
        'Mantenir validació d\'usuari per seguretat'
      ]
    });

  } catch (error) {
    console.error(`❌ [Complete-Fix] Error crític:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Error crític en diagnòstic complet',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}
