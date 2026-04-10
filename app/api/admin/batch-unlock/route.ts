import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/batch-unlock
// Body: { batchNumber: number, upToModule: number }
// Cumulatively unlocks modules 1 through upToModule for every
// non-suspended student in the given TOPIS batch.

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: requester } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!requester || !['coach', 'admin'].includes(requester.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { batchNumber, upToModule } = await request.json()

    if (!batchNumber || !upToModule || upToModule < 1 || upToModule > 6) {
      return NextResponse.json({ error: 'Invalid batchNumber or upToModule' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Get all active (non-suspended) students in this batch
    const { data: students } = await adminClient
      .from('profiles')
      .select('id')
      .eq('cohort_batch', batchNumber)
      .eq('program_type', 'topis')
      .neq('access_suspended', true)

    if (!students || students.length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: 'No active students in this batch' })
    }

    // Build the cumulative module array [1, 2, ..., upToModule]
    const moduleArray = Array.from({ length: upToModule }, (_, i) => i + 1)

    // Update all students: set unlocked_modules to [1..upToModule]
    // We use array_agg via a direct update rather than RPC so it's one operation per student.
    // For students who already have MORE modules unlocked, we take the union to never regress.
    const updates = students.map(({ id }) =>
      adminClient.rpc('unlock_modules_up_to', {
        p_student_id: id,
        p_up_to_module: upToModule,
      })
    )

    await Promise.all(updates)

    return NextResponse.json({
      success: true,
      updated: students.length,
      batch: batchNumber,
      unlockedUpTo: upToModule,
      modules: moduleArray,
    })
  } catch (err) {
    console.error('[batch-unlock]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
