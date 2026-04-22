import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/module8-beta
// Body: { email: string, enabled: boolean }
// Admin-only. Toggles the module8_beta flag for a specific user by email.

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, enabled } = await request.json()
  if (!email || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'Missing email or enabled (boolean)' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .update({ module8_beta: enabled, updated_at: new Date().toISOString() })
    .eq('email', email)
    .select('id, email, module8_beta')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'user_not_found' }, { status: 404 })

  return NextResponse.json({ success: true, profile: data })
}
