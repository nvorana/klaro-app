import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/toggle-suspension
// Body: { studentId: string, suspend: boolean }
// Manually suspend or restore a single student's access.

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

    const { studentId, suspend } = await request.json()
    if (!studentId || typeof suspend !== 'boolean') {
      return NextResponse.json({ error: 'Missing studentId or suspend flag' }, { status: 400 })
    }
    await adminClient
      .from('profiles')
      .update({ access_suspended: suspend, updated_at: new Date().toISOString() })
      .eq('id', studentId)

    return NextResponse.json({ success: true, studentId, suspended: suspend })
  } catch (err) {
    console.error('[toggle-suspension]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
