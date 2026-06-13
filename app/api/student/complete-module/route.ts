import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/student/complete-module
// Body: { moduleNumber: number }
// Called by module pages after a student saves/completes a module.
//
// POLICY: Accelerator Program students do NOT auto-unlock the next module.
// Coach Edgar must manually unlock via /api/coach/unlock-modules. This is
// true for both partial-pay (enrolled) and fully-paid (full_access) AP
// students — payment status does not change the unlock policy.
//
// History: This endpoint previously auto-unlocked the next module for AP
// students. That violated the program's pacing model — partial-pay students
// could rush through all 7 modules without paying their installments, and
// even fully-paid students bypassed Coach Edgar's progression decisions.
// As of 2026-06-12, AP students are explicitly excluded from auto-unlock.
//
// No-op for:
// - Accelerator (paced by coach) — see policy above
// - TOPIS students (modules unlock weekly via time-based logic)
// - Tier/full_access non-AP students (modules unlock by tier limit)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { moduleNumber } = await request.json()

    if (!moduleNumber || moduleNumber < 1 || moduleNumber > 7) {
      return NextResponse.json({ error: 'Invalid module number' }, { status: 400 })
    }

    // If last module, nothing to unlock
    if (moduleNumber >= 7) {
      return NextResponse.json({ success: true, unlocked: null })
    }

    const admin = createAdminClient()

    // Get student's program type to enforce per-program unlock policy
    const { data: profile } = await admin
      .from('profiles')
      .select('program_type')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // ── AP: NO auto-unlock. Coach must call /api/coach/unlock-modules. ──
    if (profile.program_type === 'accelerator') {
      return NextResponse.json({
        success: true,
        unlocked: null,
        reason: 'ap_requires_coach_unlock',
      })
    }

    // ── Non-AP: also no-op here. TOPIS uses time-drip + cohort batch
    //    unlocks. Tier/legacy students have access_level-based gating.
    //    Module completion progression is purely informational for them. ──
    return NextResponse.json({
      success: true,
      unlocked: null,
      reason: 'no_auto_unlock_for_program',
      program_type: profile.program_type,
    })
  } catch (err) {
    console.error('[complete-module]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
