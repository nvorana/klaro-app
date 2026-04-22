import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/student/complete-module
// Body: { moduleNumber: number }
// Called by module pages after a student saves/completes a module.
// Auto-unlocks the next module for Accelerator Program students so they
// can continuously progress without waiting for coach approval.
//
// No-op for:
// - TOPIS students (modules unlock weekly via time-based logic)
// - Tier/full_access students (modules unlock by tier limit)

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

    // Get student's program type + current unlocked_modules
    const { data: profile } = await admin
      .from('profiles')
      .select('program_type, unlocked_modules')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Only auto-unlock for AP students. Other tiers use different logic.
    if (profile.program_type !== 'accelerator') {
      return NextResponse.json({ success: true, unlocked: null, reason: 'not_ap' })
    }

    const nextModule = moduleNumber + 1
    const currentUnlocked: number[] = profile.unlocked_modules ?? []

    // Already unlocked — no-op
    if (currentUnlocked.includes(nextModule)) {
      return NextResponse.json({ success: true, unlocked: nextModule, alreadyUnlocked: true })
    }

    const { error: updateErr } = await admin
      .from('profiles')
      .update({
        unlocked_modules: [...currentUnlocked, nextModule].sort((a, b) => a - b),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateErr) {
      console.error('[complete-module] Update error:', updateErr)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, unlocked: nextModule })
  } catch (err) {
    console.error('[complete-module]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
