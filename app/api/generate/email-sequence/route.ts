import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'
import { writeEmail } from '@/lib/emails/sequence'

// gpt-5.6-sol plus up to two rewrites when the code checks reject a draft.
export const maxDuration = 300

// POST /api/generate/email-sequence
// Body: { target_market, problem, mechanism, ebook_title, sales_page_url, day }
// Writes a SINGLE email for the given day (1-7). The offer (price, bonuses,
// guarantee) and the student's ebook are loaded server-side in
// lib/emails/sequence.ts, so the body fields are only fallbacks.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser()
    if (!auth.ok) return auth.response

    const body = await request.json()
    const day = Math.min(7, Math.max(1, Number(body.day) || 1))
    const email = await writeEmail(auth.user.id, {
      day,
      target_market: String(body.target_market || ''),
      problem: String(body.problem || ''),
      mechanism: String(body.mechanism || ''),
      ebook_title: String(body.ebook_title || ''),
      sales_page_url: String(body.sales_page_url || ''),
    })
    return NextResponse.json({ data: { email } })
  } catch (error) {
    console.error('Email generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
