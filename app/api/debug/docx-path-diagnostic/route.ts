import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    const projectId = searchParams.get('projectId');

    console.log(`[DOCX Path Diagnostic] Iniciant diagnòstic per template: ${templateId}, project: ${projectId}`);

    let diagnosticResults: any = {
      timestamp: new Date().toISOString(),
      templateId,
      projectId,
      templateInfo: null,
      projectInfo: null,
      storageAnalysis: {},
      pathValidation: {},
      recommendations: []
    };

    // 1. ANALITZAR CONFIGURACIÓ DE PLANTILLA
    if (templateId) {
      const { data: template, error: templateError } = await supabaseAdmin
        .from('plantilla_configs')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) {
        diagnosticResults.templateInfo = { error: templateError.message };
      } else {
        diagnosticResults.templateInfo = {
          id: template.id,
          config_name: template.config_name,
          base_docx_storage_path: template.base_docx_storage_path,
          placeholder_docx_storage_path: template.placeholder_docx_storage_path,
          indexed_docx_storage_path: template.indexed_docx_storage_path,
          excel_storage_path: template.excel_storage_path
        };

        // Analitzar cada path de document
        const pathsToCheck = [
          { name: 'base_docx', path: template.base_docx_storage_path },
          { name: 'placeholder_docx', path: template.placeholder_docx_storage_path },
          { name: 'indexed_docx', path: template.indexed_docx_storage_path }
        ];

        for (const pathInfo of pathsToCheck) {
          if (pathInfo.path) {
            console.log(`[DOCX Diagnostic] Verificant path: ${pathInfo.name} -> ${pathInfo.path}`);
            
            try {
              // Intentar descarregar el fitxer
              const { data, error } = await supabaseAdmin.storage
                .from('template-docx')
                .download(pathInfo.path);

              if (error) {
                diagnosticResults.storageAnalysis[pathInfo.name] = {
                  path: pathInfo.path,
                  exists: false,
                  error: error.message,
                  status: 'ERROR'
                };
              } else {
                const buffer = await data.arrayBuffer();
                diagnosticResults.storageAnalysis[pathInfo.name] = {
                  path: pathInfo.path,
                  exists: true,
                  size: buffer.byteLength,
                  isValidSize: buffer.byteLength > 1000, // DOCX mínim ~1KB
                  status: buffer.byteLength > 1000 ? 'OK' : 'SUSPICIOUS_SIZE'
                };

                // Verificar si és un ZIP vàlid (DOCX és un ZIP)
                const uint8Array = new Uint8Array(buffer);
                const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B; // PK header
                diagnosticResults.storageAnalysis[pathInfo.name].isValidZip = isZip;
                if (!isZip) {
                  diagnosticResults.storageAnalysis[pathInfo.name].status = 'INVALID_ZIP';
                }
              }

              // Verificar estructura del directori
              const directoryPath = pathInfo.path.substring(0, pathInfo.path.lastIndexOf('/'));
              const fileName = pathInfo.path.substring(pathInfo.path.lastIndexOf('/') + 1);
              
              const { data: listData, error: listError } = await supabaseAdmin.storage
                .from('template-docx')
                .list(directoryPath, { limit: 100 });

              if (!listError && listData) {
                diagnosticResults.storageAnalysis[pathInfo.name].directoryContents = listData.map(f => f.name);
                diagnosticResults.storageAnalysis[pathInfo.name].fileExistsInDirectory = listData.some(f => f.name === fileName);
              }

            } catch (pathError: any) {
              diagnosticResults.storageAnalysis[pathInfo.name] = {
                path: pathInfo.path,
                exists: false,
                error: pathError.message,
                status: 'EXCEPTION'
              };
            }
          } else {
            diagnosticResults.storageAnalysis[pathInfo.name] = {
              path: null,
              exists: false,
              status: 'NOT_CONFIGURED'
            };
          }
        }
      }
    }

    // 2. ANALITZAR CONFIGURACIÓ DE PROJECTE I JOB
    if (projectId) {
      const { data: project, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('*, template:plantilla_configs(*)')
        .eq('id', projectId)
        .single();

      if (projectError) {
        diagnosticResults.projectInfo = { error: projectError.message };
      } else {
        diagnosticResults.projectInfo = {
          id: project.id,
          project_name: project.project_name,
          template_id: project.template_id,
          template_name: project.template?.config_name
        };

        // Buscar jobs associats
        const { data: jobs, error: jobsError } = await supabaseAdmin
          .from('generation_jobs')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(5);

        if (!jobsError && jobs) {
          diagnosticResults.projectInfo.recentJobs = jobs.map(job => ({
            id: job.id,
            status: job.status,
            created_at: job.created_at,
            error_message: job.error_message,
            job_config: job.job_config
          }));

          // Analitzar configuració del job més recent
          if (jobs.length > 0 && jobs[0].job_config) {
            const jobConfig = jobs[0].job_config as any;
            diagnosticResults.pathValidation = {
              context_document_path: jobConfig.context_document_path,
              template_document_path: jobConfig.template_document_path,
              paths_match_template: {
                context_matches_base: jobConfig.context_document_path === project.template?.base_docx_storage_path,
                template_matches_placeholder: jobConfig.template_document_path === project.template?.placeholder_docx_storage_path,
                template_matches_indexed: jobConfig.template_document_path === project.template?.indexed_docx_storage_path
              }
            };
          }
        }
      }
    }

    // 3. GENERAR RECOMANACIONS
    const recommendations = [];

    // Verificar paths problemàtics
    Object.entries(diagnosticResults.storageAnalysis).forEach(([name, analysis]: [string, any]) => {
      if (analysis.status === 'ERROR') {
        recommendations.push(`❌ ${name}: Fitxer no trobat a ${analysis.path}`);
      } else if (analysis.status === 'INVALID_ZIP') {
        recommendations.push(`⚠️ ${name}: Fitxer no és un ZIP vàlid (DOCX corrupte) a ${analysis.path}`);
      } else if (analysis.status === 'SUSPICIOUS_SIZE') {
        recommendations.push(`⚠️ ${name}: Fitxer massa petit (${analysis.size} bytes) a ${analysis.path}`);
      } else if (analysis.status === 'OK') {
        recommendations.push(`✅ ${name}: Fitxer vàlid a ${analysis.path}`);
      }
    });

    // Verificar configuració de paths
    if (diagnosticResults.pathValidation.context_document_path && diagnosticResults.pathValidation.template_document_path) {
      if (diagnosticResults.pathValidation.context_document_path === diagnosticResults.pathValidation.template_document_path) {
        recommendations.push(`⚠️ Context i template paths són idèntics - pot causar problemes`);
      }
    }

    diagnosticResults.recommendations = recommendations;

    console.log(`[DOCX Diagnostic] Diagnòstic completat amb ${recommendations.length} recomanacions`);

    return NextResponse.json(diagnosticResults, { status: 200 });

  } catch (error: any) {
    console.error('[DOCX Diagnostic] Error:', error);
    return NextResponse.json({
      error: 'Error en diagnòstic',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
