import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/coach/review?studentId=xxx
// Fetch all module reviews for a student
export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get('studentId')
  if (!studentId) return NextResponse.json({ error: 'Missing studentId' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!me || !['coach', 'admin'].includes(me.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: reviews } = await admin
    .from('module_reviews')
    .select('*')
    .eq('student_id', studentId)
    .order('module_number', { ascending: true })

  return NextResponse.json({ reviews: reviews ?? [] })
}

// POST /api/coach/review
// Create or update a module review (approve or request revision)
// Auto-unlocks next module on approval for AP students
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!me || !['coach', 'admin'].includes(me.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { studentId, moduleNumber, status, note } = body

  if (!studentId || !moduleNumber || !status) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!['pending', 'approved', 'needs_revision'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  if (moduleNumber < 1 || moduleNumber > 7) {
    return NextResponse.json({ error: 'Invalid module number' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Upsert the review (one review per student per module)
  const { data: review, error: reviewError } = await admin
    .from('module_reviews')
    .upsert({
      student_id:    studentId,
      coach_id:      user.id,
      module_number: moduleNumber,
      status,
      note:          note || null,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'student_id,module_number' })
    .select()
    .single()

  if (reviewError) {
    console.error('Review upsert error:', reviewError)
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 })
  }

  // Auto-unlock next module on approval (AP students only)
  if (status === 'approved' && moduleNumber < 7) {
    const { data: studentProfile } = await admin
      .from('profiles')
      .select('program_type, unlocked_modules')
      .eq('id', studentId)
      .maybeSingle()

    if (studentProfile?.program_type === 'accelerator') {
      const nextModule = moduleNumber + 1
      const currentUnlocked = studentProfile.unlocked_modules ?? []

      if (!currentUnlocked.includes(nextModule)) {
        await admin
          .from('profiles')
          .update({
            unlocked_modules: [...currentUnlocked, nextModule],
            updated_at: new Date().toISOString(),
          })
          .eq('id', studentId)
      }
    }
  }

  return NextResponse.json({ success: true, review })
}
