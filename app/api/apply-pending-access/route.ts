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

    // Look for most recent pending tier grant for this email
    const { data: logs } = await supabase
      .from('webhook_logs')
      .select('action')
      .eq('contact_email', email)
      .like('action', 'tier_access_pending_signup_%')
      .order('created_at', { ascending: false })
      .limit(1)

    if (!logs || logs.length === 0) {
      return NextResponse.json({ applied: false })
    }

    // Extract tier level from action string e.g. "tier_access_pending_signup_tier1"
    const action = logs[0].action as string
    const tierLevel = action.replace('tier_access_pending_signup_', '')

    const validTiers = ['tier1', 'tier2', 'tier3', 'enrolled', 'full_access']
    if (!validTiers.includes(tierLevel)) {
      return NextResponse.json({ applied: false })
    }

    // Apply the tier to the newly created profile
    await supabase
      .from('profiles')
      .update({
        access_level:     tierLevel,
        enrolled_at:      new Date().toISOString(),
        access_suspended: false,
        updated_at:       new Date().toISOString(),
      })
      .eq('id', userId)

    // Log that the pending access was applied
    await supabase.from('webhook_logs').insert({
      contact_email: email,
      action:        `pending_access_applied_${tierLevel}`,
      tag_name:      null,
      payload:       { userId, tierLevel, source: 'signup_check' },
    })

    return NextResponse.json({ applied: true, tierLevel })

  } catch (error) {
    console.error('Apply pending access error:', error)
    return NextResponse.json({ applied: false })
  }
}
