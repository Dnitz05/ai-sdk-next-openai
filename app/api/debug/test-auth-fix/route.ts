import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
        console.error('Error getting user:', error)
        return NextResponse.json({ success: false, error: 'Supabase error getting user', details: error.message }, { status: 500 })
    }

    if (!user) {
      return NextResponse.json({ success: false, error: 'No active user session found' }, { status: 401 })
    }

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email } })
  } catch (e) {
    console.error('Catch block error:', e)
    return NextResponse.json({ success: false, error: 'An unexpected error occurred.', details: (e as Error).message }, { status: 500 })
  }
}
