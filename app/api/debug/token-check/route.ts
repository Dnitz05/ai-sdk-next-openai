import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.WORKER_SECRET_TOKEN;
  
  // Verificació bàsica sense exposar el token complet
  const checks = {
    exists: !!token,
    correctLength: token?.length === 29, // longitud esperada
    startsCorrectly: token?.startsWith('estaEs'),
    endsCorrectly: token?.endsWith('98734'),
    noSpaces: token === token?.trim(),
    noSpecialChars: /^[a-zA-Z0-9]+$/.test(token || '')
  };
  
  const allGood = Object.values(checks).every(v => v === true);
  
  return NextResponse.json({
    status: allGood ? 'OK' : 'ERROR',
    checks,
    tokenLength: token?.length,
    tokenPrefix: token?.substring(0, 10),
    tokenSuffix: token?.substring(-5),
    message: allGood ? 'Token configurat correctament' : 'Problema amb el token'
  });
}
