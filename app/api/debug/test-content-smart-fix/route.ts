import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 [Test Content Smart Fix] Testejant endpoint content/route.ts amb generació SMART...');
    
    const { searchParams } = new URL(request.url);
    const generationId = searchParams.get('generationId') || 'test-generation-id';
    
    // Test GET /api/reports/content amb mock
    const testUrl = new URL('/api/reports/content', request.url);
    testUrl.searchParams.set('generation_id', generationId);
    
    console.log(`📞 Testing GET ${testUrl.pathname}${testUrl.search}`);
    
    const mockRequest = new NextRequest(testUrl, {
      method: 'GET',
      headers: request.headers
    });
    
    // Copiar cookies
    request.cookies.getAll().forEach(cookie => {
      mockRequest.cookies.set(cookie.name, cookie.value);
    });
    
    const { GET } = await import('@/app/api/reports/content/route');
    const response = await GET(mockRequest);
    const result = await response.json();
    
    console.log('📋 Response status:', response.status);
    console.log('📋 Response body:', result);
    
    return NextResponse.json({
      success: true,
      test: 'content-smart-fix',
      endpoint_tested: '/api/reports/content',
      generation_id: generationId,
      response_status: response.status,
      response_data: result,
      message: response.status === 401 ? 'Autenticació requerida (normal)' : 'Endpoint funciona correctament'
    });
    
  } catch (error) {
    console.error('❌ [Test Content Smart Fix] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Error testejant endpoint',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
