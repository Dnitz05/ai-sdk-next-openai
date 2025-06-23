/**
 * Endpoint de debug per executar el Worker MVP manualment
 * Permet provar el processament de jobs específics
 */

import { documentProcessor } from '@/lib/workers/documentProcessor'; // Canviat DocumentProcessor a documentProcessor
import { NextResponse } from 'next/server';

export async function GET(
  request: Request, 
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  try {
    if (!resolvedParams.jobId) {
      return new NextResponse('Job ID no proporcionat', { status: 400 });
    }

    console.log(`[Debug] Iniciant worker per al job: ${resolvedParams.jobId}`);

    // Verificar que el job existeix abans de processar
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: job, error } = await supabase
      .from('generation_jobs')
      .select('id, status, generation_id')
      .eq('id', resolvedParams.jobId)
      .single();

    if (error) {
      console.error(`[Debug] Error verificant job:`, error);
      return new NextResponse(
        `Error verificant job: ${error.message}`, 
        { status: 404 }
      );
    }

    if (!job) {
      return new NextResponse(
        `Job amb ID ${resolvedParams.jobId} no trobat`, 
        { status: 404 }
      );
    }

    console.log(`[Debug] Job trobat:`, {
      id: job.id,
      status: job.status,
      generation_id: job.generation_id
    });

    // Executar el worker en segon pla (no bloquejar la resposta)
    // const processor = new DocumentProcessor(); // Eliminat - utilitzem la instància importada
    
    // Executar de manera asíncrona
    documentProcessor.processJob(resolvedParams.jobId) // Canviat processor a documentProcessor
      .then(() => {
        console.log(`[Debug] ✅ Worker completat amb èxit per al job: ${resolvedParams.jobId}`);
      })
      .catch((error) => {
        console.error(`[Debug] ❌ Worker fallit per al job: ${resolvedParams.jobId}`, error);
      });

    return new NextResponse(
      JSON.stringify({
        message: `Worker iniciat per al job ${resolvedParams.jobId}`,
        status: 'started',
        jobId: resolvedParams.jobId,
        originalStatus: job.status,
        instructions: [
          'Revisa els logs del servidor per veure el progrés',
          'Comprova la base de dades per veure l\'actualització de l\'estat',
          'El document final apareixerà a Supabase Storage quan estigui completat'
        ]
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error: any) {
    console.error(`[Debug] Error inicial executant worker:`, error);
    return new NextResponse(
      JSON.stringify({
        error: 'Error iniciant el worker',
        details: error.message,
        jobId: resolvedParams.jobId
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}

/**
 * Endpoint POST per forçar la re-execució d'un job
 */
export async function POST(
  request: Request, 
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  try {
    if (!resolvedParams.jobId) {
      return new NextResponse('Job ID no proporcionat', { status: 400 });
    }

    console.log(`[Debug] FORÇANT re-execució del job: ${resolvedParams.jobId}`);

    // Reset del job a estat 'pending' abans de re-executar
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: resetError } = await supabase
      .from('generation_jobs')
      .update({
        status: 'pending',
        progress: 0,
        completed_placeholders: 0,
        error_message: null,
        started_at: null,
        completed_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', resolvedParams.jobId);

    if (resetError) {
      console.error(`[Debug] Error resetejant job:`, resetError);
      return new NextResponse(
        `Error resetejant job: ${resetError.message}`, 
        { status: 500 }
      );
    }

    console.log(`[Debug] Job resetejat a 'pending', iniciant worker...`);

    // Executar el worker
    // const processor = new DocumentProcessor(); // Eliminat - utilitzem la instància importada
    documentProcessor.processJob(resolvedParams.jobId) // Canviat processor a documentProcessor
      .then(() => {
        console.log(`[Debug] ✅ Worker RE-executat amb èxit per al job: ${resolvedParams.jobId}`);
      })
      .catch((error) => {
        console.error(`[Debug] ❌ Worker RE-executat fallit per al job: ${resolvedParams.jobId}`, error);
      });

    return new NextResponse(
      JSON.stringify({
        message: `Job ${resolvedParams.jobId} resetejat i worker iniciat`,
        status: 'restarted',
        jobId: resolvedParams.jobId
      }),
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error: any) {
    console.error(`[Debug] Error re-executant worker:`, error);
    return new NextResponse(
      JSON.stringify({
        error: 'Error re-executant el worker',
        details: error.message,
        jobId: resolvedParams.jobId
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
