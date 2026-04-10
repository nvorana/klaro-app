import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/invite-coach
// Body: { fullName: string, email: string, programType: 'topis' | 'accelerator' }
//
// 1. Verifies the requester is an admin
// 2. Uses Supabase Admin API to invite the user (sends them a setup email)
// 3. Immediately creates/upserts their profile with role = 'coach' and their program

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()

    // Only admins can invite coaches
    const { data: requester } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!requester || requester.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — admins only' }, { status: 403 })
    }

    const { fullName, email, programType } = await request.json()

    if (!fullName?.trim() || !email?.trim() || !programType) {
      return NextResponse.json({ error: 'fullName, email, and programType are required' }, { status: 400 })
    }

    if (!['topis', 'accelerator'].includes(programType)) {
      return NextResponse.json({ error: 'programType must be topis or accelerator' }, { status: 400 })
    }

    // Check if a user with this email already exists
    const { data: existing } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        error: 'An account with this email already exists.',
      }, { status: 409 })
    }

    // Invite the user via Supabase — this sends them a "Set up your account" email
    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      {
        data: {
          full_name: fullName.trim(),
          role: 'coach',
          program_type: programType,
        },
      }
    )

    if (inviteError || !invited?.user) {
      console.error('[invite-coach] Supabase invite error:', inviteError)
      return NextResponse.json({ error: inviteError?.message || 'Failed to send invite' }, { status: 500 })
    }

    const coachId = invited.user.id

    // Immediately upsert their profile so they're visible in the admin dashboard
    // before they even click the email link
    await adminClient.from('profiles').upsert({
      id:           coachId,
      email:        email.trim().toLowerCase(),
      full_name:    fullName.trim(),
      first_name:   fullName.trim().split(' ')[0],
      role:         'coach',
      program_type: programType,
      access_level: 'full_access',
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'id' })

    return NextResponse.json({
      success: true,
      coachId,
      message: `Invite sent to ${email}. They will receive an email to set up their password.`,
    })

  } catch (err) {
    console.error('[invite-coach]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
