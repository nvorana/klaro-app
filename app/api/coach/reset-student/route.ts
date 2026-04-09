import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

    const { studentId } = await request.json()
    if (!studentId) return NextResponse.json({ error: 'Missing studentId' }, { status: 400 })

    const adminClient = createAdminClient()

    // Delete all module progress and outputs for the student
    await adminClient.from('module_progress').delete().eq('user_id', studentId)
    await adminClient.from('module_outputs').delete().eq('user_id', studentId)
    await adminClient.from('clarity_sentences').delete().eq('user_id', studentId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[reset-student]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
