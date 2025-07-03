import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Analitzar el problema basant-se en el codi existent
    const analysis = {
      problem_description: "[Worker] template_document_path és null o undefined per al job 19c9a134-7e62-4d63-99a3-c1de2ec0e497",
      
      error_location: {
        file: "lib/workers/documentProcessor.ts",
        line: "~44",
        code: `if (!config.template_document_path) {
  throw new Error(\`[Worker] template_document_path és null o undefined per al job \${jobId}. No es pot continuar.\`);
}`
      },
      
      template_document_path_creation: {
        file: "app/api/reports/generate-async/route.ts",
        lines: "72-76",
        logic: `template_document_path: (project.template.placeholder_docx_storage_path && project.template.placeholder_docx_storage_path.trim() !== '') 
                                ? project.template.placeholder_docx_storage_path 
                                : project.template.base_docx_storage_path,`
      },
      
      possible_causes: [
        {
          cause: "Plantilla sense rutes de documents configurades",
          description: "Tant placeholder_docx_storage_path com base_docx_storage_path són null/undefined/buits",
          likelihood: "Alta",
          fix: "Configurar almenys un dels camps de ruta de document a la plantilla"
        },
        {
          cause: "Job creat abans d'implementar les validacions",
          description: "El job es va crear quan no hi havia validacions adequades",
          likelihood: "Mitjana", 
          fix: "Regenerar el job amb la configuració actual"
        },
        {
          cause: "Corrupció de dades al job_config",
          description: "El camp template_document_path s'ha perdut o corromput",
          likelihood: "Baixa",
          fix: "Recalcular i actualitzar el job_config"
        }
      ],
      
      resolution_steps: [
        {
          step: 1,
          action: "Consultar la base de dades per obtenir detalls del job i plantilla",
          sql: "SELECT id, job_config FROM generation_jobs WHERE id = '19c9a134-7e62-4d63-99a3-c1de2ec0e497'"
        },
        {
          step: 2, 
          action: "Verificar l'estat de la plantilla associada",
          note: "Comprovar els camps base_docx_storage_path i placeholder_docx_storage_path"
        },
        {
          step: 3,
          action: "Segons el resultat, aplicar una de les següents solucions",
          options: [
            "Actualitzar la plantilla amb rutes vàlides",
            "Regenerar el job amb la configuració corregida", 
            "Marcar el job com a fallit si no es pot recuperar"
          ]
        }
      ],
      
      immediate_action_needed: "Accés a la base de dades per diagnosticar l'estat real del job i plantilla",
      
      prevention_measures: [
        "Afegir validació més estricta en crear jobs",
        "Verificar que la plantilla té documents configurats abans de crear jobs",
        "Afegir logs més detallats en la creació de jobs"
      ]
    };

    return NextResponse.json({
      analysis,
      environment_status: {
        supabase_configured: process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://your-supabase-project.supabase.co',
        can_investigate_database: false,
        reason: "Credencials de Supabase no configurades (valors de placeholder)"
      },
      next_steps: [
        "Configurar credencials de Supabase reals al .env.local",
        "Executar l'endpoint d'investigació amb accés a base de dades",
        "Aplicar la solució adequada segons els resultats"
      ]
    });

  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Error en l\'anàlisi', 
      details: error.message 
    }, { status: 500 });
  }
}
