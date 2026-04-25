import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateMarketLanguage } from '@/lib/marketLanguage'

// Warm-cache endpoint. Module 1 fires this fire-and-forget after the user
// saves their clarity sentence so the niche language pack is generated
// proactively. If the user runs a downstream module before this finishes,
// that module's lazy backfill picks it up — same end result, just slower.

export const maxDuration = 60

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const language = await getOrCreateMarketLanguage(supabase, user.id)
  if (!language) {
    return NextResponse.json({ ok: false, reason: 'no_clarity_or_generation_failed' }, { status: 200 })
  }
  const total = language.everyday_phrases.length
    + language.emotional_words.length
    + language.world_references.length
    + language.jargon.length
  return NextResponse.json({ ok: true, total })
}
