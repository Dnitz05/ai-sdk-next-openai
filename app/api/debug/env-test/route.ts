import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const workerToken = process.env.WORKER_SECRET_TOKEN
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  return NextResponse.json({
    workerTokenSet: !!workerToken,
    workerTokenPrefix: workerToken?.substring(0, 4) || null,
    siteUrl: siteUrl || 'Not Set',
    supabaseUrlIsSet: !!supabaseUrl,
    environment: process.env.VERCEL_ENV || 'local'
  })
}
