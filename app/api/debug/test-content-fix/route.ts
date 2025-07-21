import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: NextRequest) {
  const { projectId, generationId } = await request.json();

  if (!projectId || !generationId) {
    return NextResponse.json({ error: 'projectId and generationId are required' }, { status: 400 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
        },
      },
    }
  );

  try {
    // Fetch generation data to check if it's a smart generation
    const { data: generation, error: generationError } = await supabase
      .from('generations')
      .select('row_data')
      .eq('id', generationId)
      .single();

    if (generationError) throw generationError;

    const isSmart = generation.row_data && (generation.row_data as any).smart_generation_id;

    // Call the content API
    const url = new URL(request.url);
    const contentResponse = await fetch(`${url.origin}/api/reports/content?generation_id=${generationId}`, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    });

    if (!contentResponse.ok) {
      const errorText = await contentResponse.text();
      return NextResponse.json({ 
        error: `Failed to fetch content: ${contentResponse.statusText}`,
        details: errorText 
      }, { status: contentResponse.status });
    }

    const contentData = await contentResponse.json();

    return NextResponse.json({
      message: `Test successful for ${isSmart ? 'SMART' : 'TRADITIONAL'} generation.`,
      isSmart,
      contentFound: contentData.content.length > 0,
      content: contentData.content,
    });

  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
