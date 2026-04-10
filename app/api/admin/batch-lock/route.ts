import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/batch-lock
// Body: { batchNumber: number, fromModule: number }
// Removes fromModule and all modules above it from every student in the batch.
// e.g. fromModule=3 → students keep [1,2], lose [3,4,5,6]

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()

    const { data: requester } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!requester || !['coach', 'admin'].includes(requester.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { batchNumber, fromModule } = await request.json()

    if (!batchNumber || !fromModule || fromModule < 1 || fromModule > 6) {
      return NextResponse.json({ error: 'Invalid batchNumber or fromModule' }, { status: 400 })
    }

    const { data: students } = await adminClient
      .from('profiles')
      .select('id')
      .eq('cohort_batch', batchNumber)
      .eq('program_type', 'topis')

    if (!students || students.length === 0) {
      return NextResponse.json({ success: true, updated: 0 })
    }

    const updates = students.map(({ id }) =>
      adminClient.rpc('lock_modules_from', {
        p_student_id: id,
        p_from_module: fromModule,
      })
    )

    await Promise.all(updates)

    return NextResponse.json({
      success: true,
      updated: students.length,
      batch: batchNumber,
      lockedFrom: fromModule,
    })
  } catch (err) {
    console.error('[batch-lock]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
