# Supabase RLS Policy and Authentication Notes

## Common Issues and Solutions

### 1. RLS Policies in Route Handlers

When working with Supabase Row Level Security (RLS) policies in Next.js Route Handlers, there are two distinct ways to handle authentication:

#### For SSR Cookie-Based Auth (createServerSupabaseClient):

```typescript
// 1. Create SSR client with cookies
const supabase = await createServerSupabaseClient()

// 2. Get session and access token
const { data: { session }, error: sessionError } = await supabase.auth.getSession()
if (sessionError || !session) {
  return NextResponse.json({ error: 'Sessió no trobada.' }, { status: 401 })
}

// 3. Create authenticated client with token for database operations
import { createClient } from '@supabase/supabase-js'
const authenticatedSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: {
      headers: { Authorization: `Bearer ${session.access_token}` }
    },
    auth: { persistSession: false }
  }
)

// 4. Use this client for database operations
const { data, error } = await authenticatedSupabase
  .from('table_name')
  .insert([data])
  .select()
```

**Important**: The SSR client (`createServerSupabaseClient`) works for auth operations but **does not** pass the JWT token automatically for database operations, causing RLS policy failures.

#### For Auth Header Token-Based (createUserSupabaseClient):

```typescript
// 1. Extract token from Authorization header
const authHeader = request.headers.get('authorization')
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return NextResponse.json({ error: 'No autenticat.' }, { status: 401 })
}
const accessToken = authHeader.replace('Bearer ', '').trim()

// 2. Create authenticated client
const supabase = createUserSupabaseClient(accessToken)

// 3. Use this client for database operations
const { data, error } = await supabase
  .from('table_name')
  .select('*')
```

**Note**: This approach is typically used in API routes called from client components.

### 2. Common Error Codes

- **403 Forbidden**: RLS policy rejecting access (usually missing/invalid token)
- **42501**: "new row violates row-level security policy" (token not passed properly)
- Syntax errors may be misreported when the actual issue is related to RLS permissions

## Best Practices

1. **For writes with SSR client**: Always create a separate authenticated client using the session token
2. **For reads with SSR client**: Same approach recommended for consistency
3. **For API routes**: Use the `createUserSupabaseClient` with a token from the Authorization header
4. **Middleware**: Can use cookies directly with `createServerClient` for auth checks

## Examples in this Project

- **save-configuration/route.ts**: Uses SSR client + explicit token-based client for database operations
- **get-templates/route.ts**: Uses Authorization header with `createUserSupabaseClient`
- **get-template/[id]/route.ts**: Uses Authorization header with `createUserSupabaseClient`
- **delete-template/[id]/route.ts**: Uses Authorization header with `createUserSupabaseClient`
