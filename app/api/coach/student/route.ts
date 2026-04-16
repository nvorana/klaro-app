import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get('id')
  if (!studentId) return NextResponse.json({ error: 'Missing student id' }, { status: 400 })

  // Verify requester is coach or admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!me || !['coach', 'admin'].includes(me.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use admin client to bypass RLS
  const admin = createAdminClient()

  const [
    { data: profile },
    { data: clarity },
    { data: ebook },
    { data: offer },
    { data: salesPage },
    { data: emailSeq },
    { data: leadMagnet },
    { data: posts },
    { data: reviews },
  ] = await Promise.all([
    admin.from('profiles').select('id, full_name, first_name, last_name, email, enrolled_at, last_active_at, coach_notes, dfy_flagged, access_level, phone, created_at, program_type, unlocked_modules').eq('id', studentId).maybeSingle(),
    admin.from('clarity_sentences').select('*').eq('user_id', studentId).order('created_at', { ascending: false }).limit(1),
    admin.from('ebooks').select('*').eq('user_id', studentId).eq('status', 'complete').order('created_at', { ascending: false }).limit(1),
    admin.from('offers').select('*').eq('user_id', studentId).order('created_at', { ascending: false }).limit(1),
    admin.from('sales_pages').select('*').eq('user_id', studentId).order('created_at', { ascending: false }).limit(1),
    admin.from('email_sequences').select('*').eq('user_id', studentId).order('created_at', { ascending: false }).limit(1),
    admin.from('lead_magnets').select('*').eq('user_id', studentId).order('created_at', { ascending: false }).limit(1),
    admin.from('content_posts').select('*').eq('user_id', studentId).order('created_at', { ascending: false }).limit(1),
    admin.from('module_reviews').select('*').eq('student_id', studentId).order('module_number', { ascending: true }),
  ])

  return NextResponse.json({
    profile,
    outputs: {
      clarity: clarity?.[0] ?? null,
      ebook: ebook?.[0] ?? null,
      offer: offer?.[0] ?? null,
      salesPage: salesPage?.[0] ?? null,
      emailSeq: emailSeq?.[0] ?? null,
      leadMagnet: leadMagnet?.[0] ?? null,
      posts: posts?.[0] ?? null,
    },
    reviews: reviews ?? [],
  })
}

export async function PATCH(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get('id')
  if (!studentId) return NextResponse.json({ error: 'Missing student id' }, { status: 400 })

  // Verify requester is coach or admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!me || !['coach', 'admin'].includes(me.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const admin = createAdminClient()
  await admin.from('profiles').update({ coach_notes: body.notes, dfy_flagged: body.dfy_flagged }).eq('id', studentId)

  return NextResponse.json({ ok: true })
}
