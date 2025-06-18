/**
 * Webhook Trigger Endpoint
 * Aquest endpoint s'invoca automàticament quan es crea un nou job a la base de dades
 * mitjançant un webhook de Supabase Database
 */

import { NextRequest, NextResponse } from 'next/server';
import { DocumentProcessor } from '@/lib/workers/documentProcessor';

export async function POST(request: NextRequest) {
  try {
    console.log('[Webhook] Rebent trigger automàtic de Supabase...');
    
    // Verificar que la crida ve de Supabase (opcional: implementar verificació de signature)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.includes('Bearer')) {
      console.warn('[Webhook] ⚠️ Crida sense autorització, processant igualment...');
    }
    
    // Extreure el payload del webhook
    const payload = await request.json();
    console.log('[Webhook] Payload rebut:', JSON.stringify(payload, null, 2));
    
    // El payload de Supabase per a un INSERT té aquesta estructura:
    // {
    //   "type": "INSERT",
    //   "table": "generation_jobs", 
    //   "record": { ... les dades del nou job ... },
    //   "schema": "public"
    // }
    
    if (payload.type !== 'INSERT') {
      console.log(`[Webhook] Ignorant event de tipus: ${payload.type}`);
      return NextResponse.json({
        success: true,
        message: `Event ${payload.type} ignorat - només processem INSERTs`
      });
    }
    
    if (payload.table !== 'generation_jobs') {
      console.log(`[Webhook] Ignorant event de taula: ${payload.table}`);
      return NextResponse.json({
        success: true,
        message: `Event de taula ${payload.table} ignorat`
      });
    }
    
    const newJob = payload.record;
    if (!newJob || !newJob.id) {
      throw new Error('Job ID no trobat al payload del webhook');
    }
    
    const jobId = newJob.id;
    console.log(`[Webhook] 🚀 Iniciant worker automàticament per al job: ${jobId}`);
    console.log(`[Webhook] Job details:`, {
      id: newJob.id,
      status: newJob.status,
      generation_id: newJob.generation_id,
      user_id: newJob.user_id
    });
    
    // Verificar que el job està en estat 'pending'
    if (newJob.status !== 'pending') {
      console.log(`[Webhook] Job ${jobId} no està en estat 'pending' (estat actual: ${newJob.status}). Ignorant.`);
      return NextResponse.json({
        success: true,
        message: `Job ${jobId} no està pendent, estat: ${newJob.status}`
      });
    }
    
    // Iniciar el processament en background (no bloquejar la resposta del webhook)
    const processor = new DocumentProcessor();
    
    // Executar de manera asíncrona
    processor.processJob(jobId)
      .then(() => {
        console.log(`[Webhook] ✅ Worker completat amb èxit per al job: ${jobId}`);
      })
      .catch((error) => {
        console.error(`[Webhook] ❌ Worker fallit per al job: ${jobId}`, error);
      });
    
    // Respondre immediatament al webhook de Supabase
    return NextResponse.json({
      success: true,
      message: `Worker iniciat automàticament per al job ${jobId}`,
      jobId: jobId,
      triggeredAt: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Webhook] Error processant trigger automàtic:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error processant webhook trigger',
      details: error.message,
      timestamp: new Date().toISOString()
    }, { 
      status: 500 
    });
  }
}

/**
 * Endpoint GET per verificar que el webhook està funcionant
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/worker/trigger',
    message: 'Webhook trigger endpoint està operatiu',
    expectedPayload: {
      type: 'INSERT',
      table: 'generation_jobs',
      record: {
        id: 'job_id_here',
        status: 'pending',
        generation_id: 'generation_id_here'
      }
    },
    timestamp: new Date().toISOString()
  });
}
