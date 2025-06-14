import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/debug/mistral-test
 * Test endpoint to verify Mistral AI connectivity
 */
export async function GET(request: NextRequest) {
  console.log("[DEBUG MISTRAL] Testing Mistral AI connectivity...");
  
  const mistralKey = process.env.MISTRAL_API_KEY;
  
  if (!mistralKey) {
    return NextResponse.json({ 
      error: 'MISTRAL_API_KEY not found',
      debug: 'Environment variable check failed'
    }, { status: 500 });
  }
  
  try {
    console.log("[DEBUG MISTRAL] Making test request to Mistral API...");
    
    const response = await fetch('https://api.mistral.ai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${mistralKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const responseData = await response.json();
    
    console.log("[DEBUG MISTRAL] Mistral API response status:", response.status);
    console.log("[DEBUG MISTRAL] Mistral API response:", responseData);
    
    if (!response.ok) {
      return NextResponse.json({
        error: 'Mistral API authentication failed',
        status: response.status,
        response: responseData,
        debug: {
          key_length: mistralKey.length,
          key_prefix: mistralKey.substring(0, 8),
          api_url: 'https://api.mistral.ai/v1/models'
        }
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Mistral API connectivity test successful',
      models_count: responseData.data?.length || 0,
      available_models: responseData.data?.slice(0, 3).map((model: any) => model.id) || [],
      debug: {
        key_length: mistralKey.length,
        key_prefix: mistralKey.substring(0, 8),
        response_status: response.status
      }
    }, { status: 200 });
    
  } catch (error) {
    console.error("[DEBUG MISTRAL] Error testing Mistral API:", error);
    
    return NextResponse.json({
      error: 'Failed to connect to Mistral API',
      details: error instanceof Error ? error.message : String(error),
      debug: {
        key_exists: !!mistralKey,
        key_length: mistralKey?.length,
        error_type: error instanceof Error ? error.constructor.name : typeof error
      }
    }, { status: 500 });
  }
}
