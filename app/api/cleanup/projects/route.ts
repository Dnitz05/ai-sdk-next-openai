import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';

export async function DELETE(request: NextRequest) {
  try {
    console.log('🧹 Iniciant neteja de projectes...');
    
    // 1. Llegeix el token de l'Authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticat. Falten credencials.' }, { status: 401 });
    }
    const accessToken = authHeader.replace('Bearer ', '').trim();

    // 2. Crea el client Supabase autenticat amb el token de l'usuari
    const supabase = createUserSupabaseClient(accessToken);
    
    // 1. Obtenir tots els projectes
    const { data: projects, error: fetchError } = await supabase
      .from('projects')
      .select('*');
    
    if (fetchError) {
      console.error('Error obtenint projectes:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error obtenint projectes',
        details: fetchError 
      }, { status: 500 });
    }
    
    console.log(`📋 Trobats ${projects?.length || 0} projectes per eliminar`);
    
    if (!projects || projects.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No hi ha projectes per eliminar',
        deleted: 0
      });
    }
    
    // 2. Eliminar registres relacionats primer (generations, generation_jobs, generated_content)
    console.log('🗑️ Eliminant registres relacionats...');
    
    // Eliminar generated_content relacionat amb generations dels projectes
    for (const project of projects) {
      try {
        // Obtenir generations del projecte
        const { data: generations } = await supabase
          .from('generations')
          .select('id')
          .eq('project_id', project.id);
        
        if (generations && generations.length > 0) {
          const generationIds = generations.map(g => g.id);
          
          // Eliminar generated_content
          await supabase
            .from('generated_content')
            .delete()
            .in('generation_id', generationIds);
          
          // Eliminar generation_jobs
          await supabase
            .from('generation_jobs')
            .delete()
            .in('generation_id', generationIds);
          
          // Eliminar generations
          await supabase
            .from('generations')
            .delete()
            .eq('project_id', project.id);
        }
        
        console.log(`🗑️ Registres relacionats eliminats per projecte ${project.id}`);
      } catch (err) {
        console.error(`Error eliminant registres relacionats per projecte ${project.id}:`, err);
      }
    }
    
    // 3. Eliminar registres de projectes de la base de dades
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .neq('id', 'impossible-id'); // Elimina tots els registres
    
    if (deleteError) {
      console.error('Error eliminant projectes de la BD:', deleteError);
      return NextResponse.json({ 
        success: false, 
        error: 'Error eliminant projectes de la base de dades',
        details: deleteError
      }, { status: 500 });
    }
    
    console.log('✅ Neteja de projectes completada amb èxit');
    
    return NextResponse.json({ 
      success: true, 
      message: `S'han eliminat ${projects.length} projectes correctament`,
      deleted: projects.length
    });
    
  } catch (error) {
    console.error('Error general en la neteja de projectes:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error general en la neteja de projectes',
      details: error instanceof Error ? error.message : 'Error desconegut'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Endpoint de neteja de projectes. Usa DELETE per eliminar tots els projectes.',
    usage: 'DELETE /api/cleanup/projects'
  });
}
