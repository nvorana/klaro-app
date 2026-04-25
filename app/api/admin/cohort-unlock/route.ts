import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/cohort-unlock
// Body: { program_type: 'topis' | 'accelerator', cohort_batch: number, modules: number[] }
//
// Sets unlocked_modules to the given array for all enrolled students in
// the specified cohort. Admin-only.
//
// Used by the coach/admin to advance the class to a new module early
// (e.g., 'unlock module 3 for everyone in TOPIS 77').

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const { program_type, cohort_batch, modules } = await request.json()

  if (!program_type || !['topis', 'accelerator'].includes(program_type)) {
    return NextResponse.json({ error: 'program_type must be topis or accelerator' }, { status: 400 })
  }
  if (typeof cohort_batch !== 'number' || cohort_batch < 1) {
    return NextResponse.json({ error: 'cohort_batch must be a positive number' }, { status: 400 })
  }
  if (!Array.isArray(modules) || modules.length === 0 || modules.some(m => typeof m !== 'number' || m < 1 || m > 7)) {
    return NextResponse.json({ error: 'modules must be a non-empty array of numbers between 1 and 7' }, { status: 400 })
  }

  const sortedUnique = Array.from(new Set(modules)).sort((a, b) => a - b)

  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from('profiles')
    .update({ unlocked_modules: sortedUnique, updated_at: new Date().toISOString() })
    .eq('program_type', program_type)
    .eq('cohort_batch', cohort_batch)
    .eq('access_level', 'enrolled')  // skip suspended, full_access (those use different rules)
    .eq('access_suspended', false)
    .select('email')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    program_type,
    cohort_batch,
    unlocked_modules: sortedUnique,
    students_updated: updated?.length ?? 0,
    students: updated ?? [],
  })
}
