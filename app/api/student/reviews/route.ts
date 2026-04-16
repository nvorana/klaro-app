import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/student/reviews
// Returns all module reviews for the currently logged-in student
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS policy ensures students can only read their own reviews
  const { data: reviews } = await supabase
    .from('module_reviews')
    .select('module_number, status, note, updated_at')
    .eq('student_id', user.id)
    .order('module_number', { ascending: true })

  return NextResponse.json({ reviews: reviews ?? [] })
}
