import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/coach/lock-modules
// Body: { studentIds: string[], moduleNumber: number }
// Removes moduleNumber from unlocked_modules array for each student

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify requester is coach or admin
    const { data: requester } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!requester || !['coach', 'admin'].includes(requester.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { studentIds, moduleNumber } = await request.json()

    if (!studentIds?.length || !moduleNumber) {
      return NextResponse.json({ error: 'Missing studentIds or moduleNumber' }, { status: 400 })
    }

    if (moduleNumber < 1 || moduleNumber > 8) {
      return NextResponse.json({ error: 'Invalid module number' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // For each student, remove moduleNumber from their unlocked_modules array
    const results = await Promise.all(
      studentIds.map((id: string) =>
        adminClient.rpc('lock_module_for_student', {
          p_student_id: id,
          p_module_number: moduleNumber,
        })
      )
    )

    // Surface any RPC failures (previous version silently returned success
    // even when the underlying function call errored — masked a missing-RPC
    // bug for weeks. Don't repeat that.)
    const failures = results.filter(r => r.error).map(r => r.error?.message)
    if (failures.length > 0) {
      console.error('[lock-modules] RPC errors:', failures)
      return NextResponse.json(
        { error: 'lock_failed', detail: failures[0], failures },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, updated: studentIds.length, moduleNumber })
  } catch (err) {
    console.error('[lock-modules]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
