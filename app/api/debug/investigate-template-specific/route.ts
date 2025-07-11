/**
 * Endpoint específic per investigar l'error "Plantilla no trobada"
 * Investiga detalls de la plantilla amb ID: 365429f4-25b3-421f-a04e-b646d1e3939d
 */

import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const targetTemplateId = '365429f4-25b3-421f-a04e-b646d1e3939d';
  
  try {
    console.log(`🔍 [Debug] Investigant plantilla específica: ${targetTemplateId}`);

    // 1. Verificar si la plantilla existeix
    const { data: template, error: templateError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('*')
      .eq('id', targetTemplateId)
      .single();

    const templateExists = !templateError && template;

    // 2. Obtenir totes les plantilles per comparar
    const { data: allTemplates, error: allError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('id, user_id, name, created_at, template_content, docx_storage_path')
      .limit(10);

    // 3. Buscar plantilles similars o relacionades
    const { data: similarTemplates, error: similarError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('id, name, user_id')
      .ilike('id', '%365429f4%');

    // 4. Verificar permisos RLS
    const { data: currentUser } = await supabaseServerClient.auth.getUser();

    const debugInfo = {
      investigation: {
        targetTemplateId,
        templateExists,
        templateError: templateError?.message || null,
        currentUser: currentUser?.user?.id || 'No autenticat',
      },
      templateDetails: template || null,
      allTemplatesCount: allTemplates?.length || 0,
      allTemplatesPreview: allTemplates?.slice(0, 5).map(t => ({
        id: t.id,
        name: t.name,
        hasContent: !!t.template_content,
        hasStoragePath: !!t.docx_storage_path,
      })) || [],
      similarTemplates: similarTemplates || [],
      possibleCauses: [
        templateExists ? null : "Plantilla no existeix a la base de dades",
        !template?.template_content ? "Plantilla sense contingut" : null,
        !template?.docx_storage_path ? "Plantilla sense path de storage" : null,
        templateError?.message?.includes('permission') ? "Problema de permisos RLS" : null,
        !currentUser.user ? "Usuari no autenticat" : null,
      ].filter(Boolean),
    };

    console.log(`📊 [Debug] Resultats d'investigació:`, debugInfo);

    return NextResponse.json({
      success: true,
      ...debugInfo,
      recommendation: templateExists 
        ? "La plantilla existeix. Verificar què està causant l'error en producció."
        : "La plantilla no existeix. Verificar si l'ID és correcte o si ha estat eliminada.",
    });

  } catch (error) {
    console.error(`❌ [Debug] Error investigant plantilla:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Error en investigació',
      details: error instanceof Error ? error.message : 'Error desconegut',
      targetTemplateId,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId = '365429f4-25b3-421f-a04e-b646d1e3939d', action } = body;

    if (action === 'test-smart-generation') {
      // Test del sistema smart amb dades simulades
      console.log(`🧪 [Debug] Testejant sistema smart amb plantilla: ${templateId}`);

      const testExcelData = [
        { contractista: "Test Contractista 1", obra: "Obra de prova 1", import: 1000 },
        { contractista: "Test Contractista 2", obra: "Obra de prova 2", import: 2000 },
      ];

      // Simular crida al sistema smart
      const response = await fetch(`${request.nextUrl.origin}/api/reports/generate-smart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          excelData: testExcelData,
          userId: 'test-user-id',
        }),
      });

      const result = await response.json();

      return NextResponse.json({
        success: true,
        testResult: result,
        templateIdTested: templateId,
        message: response.ok 
          ? 'Test del sistema smart completat amb èxit'
          : 'Test del sistema smart fallit',
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Acció no reconeguda',
      validActions: ['test-smart-generation'],
    }, { status: 400 });

  } catch (error) {
    console.error(`❌ [Debug] Error en test POST:`, error);
    return NextResponse.json({
      success: false,
      error: 'Error en test',
      details: error instanceof Error ? error.message : 'Error desconegut',
    }, { status: 500 });
  }
}
