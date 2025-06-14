import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/debug/env
 * Diagnostic endpoint to check environment variable loading
 */
export async function GET(request: NextRequest) {
  console.log("[DEBUG ENV] Checking environment variables...");
  
  const mistralKey = process.env.MISTRAL_API_KEY;
  const allEnvKeys = Object.keys(process.env);
  
  // Filter relevant environment variables
  const relevantKeys = allEnvKeys.filter(key => 
    key.includes('MISTRAL') || 
    key.includes('NEXT_') || 
    key.includes('SUPABASE') ||
    key.includes('OPENAI')
  );
  
  const diagnosticInfo = {
    timestamp: new Date().toISOString(),
    mistral_api_key: {
      exists: !!mistralKey,
      length: mistralKey?.length || 0,
      first_chars: mistralKey ? mistralKey.substring(0, 8) + '...' : 'NOT_FOUND',
      is_placeholder: mistralKey === 'xxxxxxx'
    },
    environment: {
      node_env: process.env.NODE_ENV,
      vercel: !!process.env.VERCEL,
      total_env_vars: allEnvKeys.length,
      relevant_keys: relevantKeys
    },
    env_file_check: {
      // This helps identify if .env.local is being read
      has_next_public_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_supabase_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_openai_key: !!process.env.OPENAI_API_KEY
    }
  };
  
  console.log("[DEBUG ENV] Diagnostic results:", JSON.stringify(diagnosticInfo, null, 2));
  
  return NextResponse.json(diagnosticInfo, { status: 200 });
}
