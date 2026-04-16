import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/student/program-type
// Returns the current student's program type (topis or accelerator)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('program_type')
    .eq('id', user.id)
    .maybeSingle()

  return NextResponse.json({ programType: profile?.program_type ?? null })
}
