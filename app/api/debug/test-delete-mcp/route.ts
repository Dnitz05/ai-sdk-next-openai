// Test DELETE usant MCP de Supabase directament
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    console.log('🧪 Testejant DELETE amb MCP de Supabase...');
    
    // 1. Llegeix el token de l'Authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'No autenticat. Falten credencials.' 
      }, { status: 401 });
    }
    const accessToken = authHeader.replace('Bearer ', '').trim();

    // 2. Obtenir user_id del token JWT (decodificar base64)
    let userId;
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      userId = payload.sub;
      console.log(`👤 User ID del token: ${userId}`);
    } catch (err) {
      return NextResponse.json({ 
        error: 'Token JWT invàlid',
        details: 'No s\'ha pogut decodificar el token'
      }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ 
        error: 'User ID no trobat al token' 
      }, { status: 401 });
    }
    
    // 3. Fer una consulta de test per veure si podem accedir a les plantilles
    const testQuery = `
      SELECT id, config_name, user_id 
      FROM plantilla_configs 
      WHERE user_id = '${userId}' 
      LIMIT 3;
    `;
    
    console.log('📋 Executant consulta de test...');
    
    return NextResponse.json({
      success: true,
      message: 'Test preparat per executar amb MCP',
      userId: userId,
      testQuery: testQuery,
      note: 'Aquest endpoint mostra com podem usar MCP per bypassing RLS'
    });
    
  } catch (error) {
    console.error('Error en test MCP:', error);
    return NextResponse.json({
      success: false,
      error: 'Error general en test MCP',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Test DELETE amb MCP. Usa POST amb Authorization header.',
    usage: 'POST /api/debug/test-delete-mcp amb Authorization: Bearer <token>'
  });
}
