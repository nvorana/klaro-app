import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/invite-coach
// Body: { fullName: string, email: string, programType: 'topis' | 'accelerator', tempPassword: string }
//
// Creates a coach account immediately with a temporary password.
// Sets must_change_password = true in user metadata so they are forced
// to change their password on first login.

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient()

    // Only admins can create coaches
    const { data: requester } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!requester || requester.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — admins only' }, { status: 403 })
    }

    const { fullName, email, programType, tempPassword } = await request.json()

    if (!fullName?.trim() || !email?.trim() || !programType || !tempPassword?.trim()) {
      return NextResponse.json({ error: 'fullName, email, programType, and tempPassword are required' }, { status: 400 })
    }

    if (!['topis', 'accelerator'].includes(programType)) {
      return NextResponse.json({ error: 'programType must be topis or accelerator' }, { status: 400 })
    }

    if (tempPassword.trim().length < 8) {
      return NextResponse.json({ error: 'Temporary password must be at least 8 characters' }, { status: 400 })
    }

    // Check if an account with this email already exists
    const { data: existing } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    // Create the coach account directly — no email invite needed
    // must_change_password = true forces them to change password on first login
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: tempPassword.trim(),
      email_confirm: true, // skip email verification
      user_metadata: {
        full_name: fullName.trim(),
        role: 'coach',
        program_type: programType,
        must_change_password: true,
      },
    })

    if (createError || !created?.user) {
      console.error('[invite-coach] Supabase createUser error:', createError)
      return NextResponse.json({ error: createError?.message || 'Failed to create account' }, { status: 500 })
    }

    const coachId = created.user.id

    // Upsert their profile so they appear in the admin dashboard immediately
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
      message: `Coach account created for ${email}. They can log in now with the temporary password.`,
    })

  } catch (err) {
    console.error('[invite-coach]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
