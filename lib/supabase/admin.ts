import { createClient } from '@supabase/supabase-js'

// Admin client — uses service role key. Only use in server-side API routes.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
