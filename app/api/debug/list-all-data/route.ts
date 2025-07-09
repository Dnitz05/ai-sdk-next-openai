/**
 * API Endpoint: /api/debug/list-all-data
 * 
 * Llista tots els projectes i plantilles disponibles per identificar
 * quin ID s'hauria d'estar utilitzant
 */

import { NextRequest, NextResponse } from 'next/server';
import supabaseServerClient from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    console.log(`🔍 [ListAllData] Llistant totes les dades disponibles...`);

    // 1. Obtenir tots els projectes
    const { data: projects, error: projectsError } = await supabaseServerClient
      .from('projects')
      .select('id, project_name, template_id, excel_filename, total_rows, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // 2. Obtenir totes les plantilles
    const { data: templates, error: templatesError } = await supabaseServerClient
      .from('plantilla_configs')
      .select('id, template_name, docx_filename, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    const result = {
      projects: {
        count: projects?.length || 0,
        data: projects || [],
        error: projectsError?.message || null
      },
      templates: {
        count: templates?.length || 0,
        data: templates || [],
        error: templatesError?.message || null
      },
      analysis: {
        suspiciousId: '5a50ed72-4ff4-4d6d-b495-bd90edf76256',
        foundInProjects: projects?.some(p => p.id === '5a50ed72-4ff4-4d6d-b495-bd90edf76256') || false,
        foundInTemplates: templates?.some(t => t.id === '5a50ed72-4ff4-4d6d-b495-bd90edf76256') || false,
        recommendations: [] as string[]
      }
    };

    // 3. Generar recomanacions
    if (result.projects.count === 0) {
      result.analysis.recommendations.push('❌ No hi ha projectes a la base de dades');
    } else {
      result.analysis.recommendations.push(`✅ Trobats ${result.projects.count} projectes`);
      result.analysis.recommendations.push(`💡 Projecte més recent: ${projects![0].project_name} (${projects![0].id})`);
    }

    if (result.templates.count === 0) {
      result.analysis.recommendations.push('❌ No hi ha plantilles a la base de dades');
    } else {
      result.analysis.recommendations.push(`✅ Trobades ${result.templates.count} plantilles`);
      result.analysis.recommendations.push(`💡 Plantilla més recent: ${templates![0].template_name} (${templates![0].id})`);
    }

    if (!result.analysis.foundInProjects && !result.analysis.foundInTemplates) {
      result.analysis.recommendations.push(`❌ L'ID ${result.analysis.suspiciousId} no existeix en cap taula`);
      result.analysis.recommendations.push('🔧 Comprova l\'URL o utilitza un ID vàlid dels llistats');
    }

    console.log(`✅ [ListAllData] Anàlisi completada:`, {
      projectsFound: result.projects.count,
      templatesFound: result.templates.count,
      suspiciousIdFound: result.analysis.foundInProjects || result.analysis.foundInTemplates
    });

    return NextResponse.json({
      success: true,
      result,
      summary: {
        totalProjects: result.projects.count,
        totalTemplates: result.templates.count,
        suspiciousIdExists: result.analysis.foundInProjects || result.analysis.foundInTemplates,
        hasData: result.projects.count > 0 || result.templates.count > 0
      }
    });

  } catch (error) {
    console.error(`❌ [ListAllData] Error:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error intern del llistat',
        details: error instanceof Error ? error.message : 'Error desconegut'
      },
      { status: 500 }
    );
  }
}
