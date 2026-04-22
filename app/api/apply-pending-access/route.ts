import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/apply-pending-access
// Called during signup to apply any tier access that Systeme.io already sent
// before the student created their KLARO account.
//
// Looks up the most recent webhook_log entry for this email with an action
// matching tier_access_pending_signup_* and applies the tier to the profile.

export async function POST(request: NextRequest) {
  try {
    const { email, userId } = await request.json()
    if (!email || !userId) {
      return NextResponse.json({ applied: false })
    }

    const supabase = createAdminClient()

    // Look for pending tier grant OR accelerator enrollment for this email
    const { data: logs } = await supabase
      .from('webhook_logs')
      .select('action')
      .eq('contact_email', email)
      .or('action.like.tier_access_pending_signup_%,action.eq.accelerator_enrolled_pending_signup,action.eq.topis_enrolled_pending_signup')
      .order('created_at', { ascending: false })
      .limit(5)

    if (!logs || logs.length === 0) {
      return NextResponse.json({ applied: false })
    }

    const updates: Record<string, unknown> = {
      enrolled_at:      new Date().toISOString(),
      access_suspended: false,
      updated_at:       new Date().toISOString(),
    }
    let appliedAction = ''

    for (const log of logs) {
      const action = log.action as string

      // Tier access (e.g. tier_access_pending_signup_tier1)
      if (action.startsWith('tier_access_pending_signup_')) {
        const tierLevel = action.replace('tier_access_pending_signup_', '')
        if (['tier1', 'tier2', 'tier3', 'enrolled', 'full_access'].includes(tierLevel)) {
          updates.access_level = tierLevel
          appliedAction = `pending_access_applied_${tierLevel}`
        }
      }

      // Accelerator enrollment
      if (action === 'accelerator_enrolled_pending_signup') {
        updates.program_type = 'accelerator'
        updates.coach_id = 'e5d6cc0d-ae70-4e58-967b-f61a957eb442' // Edgar
        updates.unlocked_modules = [1, 2] // AP students get modules 1 and 2 unlocked by default
        if (!updates.access_level) updates.access_level = 'enrolled'
        appliedAction = appliedAction || 'pending_access_applied_accelerator'
      }

      // TOPIS enrollment
      if (action === 'topis_enrolled_pending_signup') {
        updates.program_type = 'topis'
        if (!updates.access_level) updates.access_level = 'enrolled'
        appliedAction = appliedAction || 'pending_access_applied_topis'
      }
    }

    if (!appliedAction) {
      return NextResponse.json({ applied: false })
    }

    await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    await supabase.from('webhook_logs').insert({
      contact_email: email,
      action:        appliedAction,
      tag_name:      null,
      payload:       { userId, updates, source: 'signup_check' },
    })

    return NextResponse.json({ applied: true, action: appliedAction })

  } catch (error) {
    console.error('Apply pending access error:', error)
    return NextResponse.json({ applied: false })
  }
}
