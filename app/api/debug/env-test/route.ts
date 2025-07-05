import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log(`[EnvTest] Verificant variables d'entorn...`);
    
    // Verificar variables d'entorn sense crear client Supabase
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: {
        present: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        value: process.env.NEXT_PUBLIC_SUPABASE_URL ? 
          `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 20)}...` : 
          'MISSING'
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        present: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        value: process.env.SUPABASE_SERVICE_ROLE_KEY ? 
          `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...` : 
          'MISSING'
      },
      MISTRAL_API_KEY: {
        present: !!process.env.MISTRAL_API_KEY,
        value: process.env.MISTRAL_API_KEY ? 
          `${process.env.MISTRAL_API_KEY.substring(0, 20)}...` : 
          'MISSING'
      }
    };
    
    console.log(`[EnvTest] Variables d'entorn:`, envCheck);
    
    // Verificar si les variables semblen vàlides
    const validationResults = {
      NEXT_PUBLIC_SUPABASE_URL: {
        present: envCheck.NEXT_PUBLIC_SUPABASE_URL.present,
        validFormat: process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('supabase.co') || false
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        present: envCheck.SUPABASE_SERVICE_ROLE_KEY.present,
        validFormat: process.env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('eyJ') || false
      },
      MISTRAL_API_KEY: {
        present: envCheck.MISTRAL_API_KEY.present,
        validFormat: (process.env.MISTRAL_API_KEY?.length || 0) > 10
      }
    };
    
    console.log(`[EnvTest] Validació de format:`, validationResults);
    
    // Determinar l'estat general
    const allPresent = Object.values(envCheck).every(v => v.present);
    const allValidFormat = Object.values(validationResults).every(v => v.validFormat);
    
    return NextResponse.json({
      success: true,
      message: 'Test de variables d\'entorn completat',
      environment: {
        variables: envCheck,
        validation: validationResults,
        summary: {
          allPresent,
          allValidFormat,
          status: allPresent && allValidFormat ? 'VALID' : 'INVALID'
        }
      },
      timestamp: new Date().toISOString(),
      deployment: {
        vercel: !!process.env.VERCEL,
        region: process.env.VERCEL_REGION || 'unknown',
        environment: process.env.VERCEL_ENV || 'unknown'
      }
    });
    
  } catch (error: any) {
    console.error('[EnvTest] Error durant el test:', error);
    return NextResponse.json({
      success: false,
      error: 'Error durant el test de variables d\'entorn',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
