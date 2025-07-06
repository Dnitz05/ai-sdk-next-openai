import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabaseClient } from '@/lib/supabase/userClient';
import supabaseServerClient from '@/lib/supabase/server';

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
    
    // 3. Obtenir l'usuari autenticat per seguretat
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ 
        success: false,
        error: 'Error obtenint usuari autenticat',
        details: userError?.message 
      }, { status: 401 });
    }
    
    console.log(`👤 Usuari autenticat: ${user.id}`);
    
    // 4. Obtenir tots els projectes DE L'USUARI AUTENTICAT
    const { data: projects, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id); // SEGURETAT: només projectes de l'usuari
    
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
    
    const relatedErrors: any[] = [];
    
    // Eliminar generated_content relacionat amb generations dels projectes
    for (const project of projects) {
      try {
        // Obtenir generations del projecte
        const { data: generations, error: genError } = await supabaseServerClient
          .from('generations')
          .select('id')
          .eq('project_id', project.id)
          .eq('user_id', user.id); // Seguretat extra
        
        if (genError) {
          console.error(`Error obtenint generations per projecte ${project.id}:`, genError);
          relatedErrors.push({ project: project.id, step: 'get_generations', error: genError });
          continue;
        }
        
        if (generations && generations.length > 0) {
          const generationIds = generations.map(g => g.id);
          
          // Eliminar generated_content (usar server client per bypassing RLS)
          const { error: contentError } = await supabaseServerClient
            .from('generated_content')
            .delete()
            .in('generation_id', generationIds);
          
          if (contentError) {
            console.error(`Error eliminant generated_content per projecte ${project.id}:`, contentError);
            relatedErrors.push({ project: project.id, step: 'delete_content', error: contentError });
          }
          
          // Eliminar generation_jobs (usar server client per bypassing RLS)
          const { error: jobsError } = await supabaseServerClient
            .from('generation_jobs')
            .delete()
            .in('generation_id', generationIds);
          
          if (jobsError) {
            console.error(`Error eliminant generation_jobs per projecte ${project.id}:`, jobsError);
            relatedErrors.push({ project: project.id, step: 'delete_jobs', error: jobsError });
          }
          
          // Eliminar generations (usar server client per bypassing RLS)
          const { error: generationsError } = await supabaseServerClient
            .from('generations')
            .delete()
            .eq('project_id', project.id)
            .eq('user_id', user.id); // Seguretat extra
          
          if (generationsError) {
            console.error(`Error eliminant generations per projecte ${project.id}:`, generationsError);
            relatedErrors.push({ project: project.id, step: 'delete_generations', error: generationsError });
          }
        }
        
        console.log(`🗑️ Registres relacionats eliminats per projecte ${project.id}`);
      } catch (err) {
        console.error(`Error eliminant registres relacionats per projecte ${project.id}:`, err);
        relatedErrors.push({ project: project.id, step: 'general', error: err });
      }
    }
    
    // 3. Eliminar registres de projectes de la base de dades
    // SEGURETAT: Usar server client amb filtres explícits per user_id
    const { error: deleteError } = await supabaseServerClient
      .from('projects')
      .delete()
      .eq('user_id', user.id); // SEGURETAT: només eliminar projectes de l'usuari autenticat
    
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
      deleted: projects.length,
      relatedErrors: relatedErrors.length > 0 ? relatedErrors : undefined
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
