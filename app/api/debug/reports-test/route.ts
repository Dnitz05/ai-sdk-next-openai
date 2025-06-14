import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/debug/reports-test
 * Test endpoint to simulate reports/generate call and check environment variables
 */
export async function POST(request: NextRequest) {
  console.log("[DEBUG REPORTS TEST] Testing reports/generate environment loading...");
  
  // Debug environment variables exactly like in reports/generate
  const mistralKey = process.env.MISTRAL_API_KEY;
  console.log("[DEBUG REPORTS TEST] MISTRAL_API_KEY check:", {
    exists: !!mistralKey,
    length: mistralKey?.length || 0,
    first_chars: mistralKey ? mistralKey.substring(0, 8) + '...' : 'NOT_FOUND',
    typeof: typeof mistralKey,
    all_mistral_keys: Object.keys(process.env).filter(k => k.includes('MISTRAL'))
  });
  
  try {
    const body = await request.json();
    console.log("[DEBUG REPORTS TEST] Request body:", body);
    
    // Test the same check as in reports/generate
    if (!process.env.MISTRAL_API_KEY) {
      console.error("[DEBUG REPORTS TEST] MISTRAL_API_KEY no configurada");
      console.error("[DEBUG REPORTS TEST] Environment debug:", {
        total_env_vars: Object.keys(process.env).length,
        node_env: process.env.NODE_ENV,
        has_supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        relevant_keys: Object.keys(process.env).filter(k => 
          k.includes('MISTRAL') || k.includes('NEXT_') || k.includes('SUPABASE')
        ).slice(0, 10)
      });
      return NextResponse.json({ error: 'Mistral AI no està configurat.' }, { status: 500 });
    }
    
    console.log("[DEBUG REPORTS TEST] ✅ MISTRAL_API_KEY verified successfully");
    
    return NextResponse.json({
      success: true,
      message: 'Environment test successful!',
      mistral_key_info: {
        exists: !!mistralKey,
        length: mistralKey?.length || 0,
        prefix: mistralKey ? mistralKey.substring(0, 8) : 'NOT_FOUND'
      },
      environment_info: {
        total_env_vars: Object.keys(process.env).length,
        node_env: process.env.NODE_ENV,
        has_supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error("[DEBUG REPORTS TEST] Error:", error);
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
