import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🔍 Debug URL Resolution');
  console.log('Request URL:', request.url);
  console.log('Request headers:', Object.fromEntries(request.headers.entries()));
  console.log('Request nextUrl:', request.nextUrl);
  console.log('Process env VERCEL_URL:', process.env.VERCEL_URL);
  console.log('Process env NODE_ENV:', process.env.NODE_ENV);
  console.log('Process env NEXT_PUBLIC_VERCEL_URL:', process.env.NEXT_PUBLIC_VERCEL_URL);

  return NextResponse.json({
    success: true,
    debug: {
      requestUrl: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      nextUrl: request.nextUrl,
      env: {
        VERCEL_URL: process.env.VERCEL_URL,
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
      }
    }
  });
}
