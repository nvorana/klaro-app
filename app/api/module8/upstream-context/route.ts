import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveSession } from '@/lib/module8/persistence'
import { resolveRequiredContext } from '@/lib/module8/context'

// GET /api/module8/upstream-context
// Returns the upstream KLARO context (clarity + ebook) so the client can
// pre-fill form fields. Read-only — no state changes.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await getActiveSession(user.id)
  if (!session) return NextResponse.json({ error: 'no_active_session' }, { status: 400 })

  const resolution = await resolveRequiredContext(user.id, session.id, [
    'clarity_sentence',
    'target_market',
    'core_problem',
    'unique_mechanism',
    'ebook_title',
    'ebook_chapters',
  ])

  return NextResponse.json(resolution)
}
