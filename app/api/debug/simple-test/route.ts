import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Test super simple que només retorna informació bàsica
  return NextResponse.json({
    success: true,
    message: 'Endpoint de debug funcionant correctament',
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_REGION: process.env.VERCEL_REGION
    }
  });
}
