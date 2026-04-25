import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/admin/sweep-pending
// Mode: 'scan' (default) returns the diagnosis only, no changes.
// Mode: 'apply' activates paid students automatically + (optionally) deletes leads.
//
// Body: { mode: 'scan' | 'apply', delete_leads?: boolean }
//
// Admin-only.

interface PendingDiagnosis {
  id: string
  email: string
  full_name: string | null
  created_at: string
  status:
    | 'paid_topis'
    | 'paid_topis_full'
    | 'paid_accelerator'
    | 'paid_accelerator_full'
    | 'paid_tier'
    | 'lead_only'
    | 'not_in_systeme'
    | 'is_test_account'
  recommended_action: 'activate' | 'delete' | 'keep' | 'review'
  systeme_tags: string[]
  recommended_payload?: Record<string, unknown>
}

const EDGAR_COACH_ID = 'e5d6cc0d-ae70-4e58-967b-f61a957eb442'
const SYSTEME_API_BASE = process.env.SYSTEME_API_BASE_URL || 'https://api.systeme.io/api'

// Test account marker — emails matching these patterns are kept regardless
const TEST_ACCOUNT_PATTERNS = [/^nvorana\+/i, /\+test\d*@/i]

function isTestAccount(email: string): boolean {
  return TEST_ACCOUNT_PATTERNS.some(pattern => pattern.test(email))
}

async function fetchSystemeTags(email: string): Promise<string[] | null> {
  const apiKey = process.env.SYSTEME_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(`${SYSTEME_API_BASE}/contacts?email=${encodeURIComponent(email)}`, {
      headers: { 'X-API-Key': apiKey, accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.items || data.items.length === 0) return []  // empty = not in Systeme
    const tags = (data.items[0].tags ?? []) as Array<{ name: string }>
    return tags.map(t => t.name)
  } catch {
    return null
  }
}

function diagnose(tags: string[] | null): {
  status: PendingDiagnosis['status']
  recommended_action: PendingDiagnosis['recommended_action']
  recommended_payload?: Record<string, unknown>
} {
  if (tags === null) {
    return { status: 'not_in_systeme', recommended_action: 'review' }
  }
  if (tags.length === 0) {
    return { status: 'not_in_systeme', recommended_action: 'delete' }
  }

  const lowerTags = tags.map(t => t.toLowerCase())

  // Detect TOPIS batch number from tags
  const batchTag = tags.find(t => /^TOPIS \| (\d+) \| /.test(t)) ||
                   tags.find(t => /^TOPIS\s*\|\s*\d+/.test(t))
  let cohortBatch: number | null = null
  if (batchTag) {
    const m = batchTag.match(/(\d+)/)
    if (m) cohortBatch = parseInt(m[1])
  }

  // Try fallback patterns for batch number (e.g., "TOPIS 77 Student")
  if (!cohortBatch) {
    for (const t of tags) {
      const m = t.match(/TOPIS\s*(\d+)/i)
      if (m) {
        cohortBatch = parseInt(m[1])
        break
      }
    }
  }

  // Check for AP enrollment
  const isAccelEnrolled = lowerTags.some(t => t === 'accel-enrolled' || t === 'accelerator-enrolled' || t === 'accelerator-program')
  const isAccelFullPaid = lowerTags.some(t => /accel.*full.*payment/i.test(t))

  if (isAccelEnrolled) {
    const payload: Record<string, unknown> = {
      access_level: isAccelFullPaid ? 'full_access' : 'enrolled',
      program_type: 'accelerator',
      coach_id: EDGAR_COACH_ID,
      unlocked_modules: [1, 2],
      enrolled_at: new Date().toISOString(),
    }
    if (isAccelFullPaid) payload.full_access_granted_at = new Date().toISOString()
    return {
      status: isAccelFullPaid ? 'paid_accelerator_full' : 'paid_accelerator',
      recommended_action: 'activate',
      recommended_payload: payload,
    }
  }

  // Check for TOPIS enrollment
  const isTopisStudent = tags.some(t =>
    /^TOPIS \| Student$/i.test(t) ||
    /^TOPIS-Student$/i.test(t) ||
    /^TOPIS \d+ Student$/i.test(t)
  )
  const isTopisFullyPaid = tags.some(t => /TOPIS \| \d+ \| PAYMENT \| FULLY_PAID/i.test(t)) ||
                           tags.some(t => /TOPIS-\d+-Full-Payment/i.test(t))
  const isTopisManualOrOnlinePaid = tags.some(t =>
    /TOPIS \d+ (Manual|Online) Paid/i.test(t) ||
    /TOPIS \| \d+ \| PAYMENT \| (MANUAL_PAID|ONLINE_PAID|PAY_)/i.test(t)
  )

  if (isTopisStudent || isTopisFullyPaid || isTopisManualOrOnlinePaid) {
    const payload: Record<string, unknown> = {
      access_level: isTopisFullyPaid ? 'full_access' : 'enrolled',
      program_type: 'topis',
      enrolled_at: new Date().toISOString(),
      coach_id: null,
    }
    if (cohortBatch) payload.cohort_batch = cohortBatch
    if (isTopisFullyPaid) payload.full_access_granted_at = new Date().toISOString()
    return {
      status: isTopisFullyPaid ? 'paid_topis_full' : 'paid_topis',
      recommended_action: 'activate',
      recommended_payload: payload,
    }
  }

  // Check for tier purchases
  const tierTag = tags.find(t => /^Klaro-tier(\d+)$/i.test(t)) || tags.find(t => /KLARO-FULLPAY/i.test(t))
  if (tierTag) {
    const tierMatch = tierTag.match(/tier(\d+)/i)
    const tierLevel = tierMatch ? `tier${tierMatch[1]}` : 'full_access'
    return {
      status: 'paid_tier',
      recommended_action: 'activate',
      recommended_payload: {
        access_level: tierLevel,
        enrolled_at: new Date().toISOString(),
      },
    }
  }

  // Lead only — no purchase tags found
  return { status: 'lead_only', recommended_action: 'delete' }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const mode: 'scan' | 'apply' = body.mode === 'apply' ? 'apply' : 'scan'
  const deleteLeads: boolean = body.delete_leads === true

  const admin = createAdminClient()

  // Get all pending profiles
  const { data: pending } = await admin
    .from('profiles')
    .select('id, email, full_name, created_at')
    .eq('access_level', 'pending')
    .order('created_at', { ascending: false })

  if (!pending || pending.length === 0) {
    return NextResponse.json({ mode, total: 0, results: [] })
  }

  // Diagnose each pending account
  const results: PendingDiagnosis[] = []
  for (const p of pending) {
    if (isTestAccount(p.email)) {
      results.push({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        created_at: p.created_at,
        status: 'is_test_account',
        recommended_action: 'keep',
        systeme_tags: [],
      })
      continue
    }

    const tags = await fetchSystemeTags(p.email)
    const diagnosis = diagnose(tags)
    results.push({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      created_at: p.created_at,
      status: diagnosis.status,
      recommended_action: diagnosis.recommended_action,
      systeme_tags: tags ?? [],
      recommended_payload: diagnosis.recommended_payload,
    })
  }

  if (mode === 'scan') {
    return NextResponse.json({
      mode: 'scan',
      total: results.length,
      activate_count: results.filter(r => r.recommended_action === 'activate').length,
      delete_count: results.filter(r => r.recommended_action === 'delete').length,
      keep_count: results.filter(r => r.recommended_action === 'keep').length,
      review_count: results.filter(r => r.recommended_action === 'review').length,
      results,
    })
  }

  // mode === 'apply' — execute recommendations
  let activated = 0
  let deleted = 0
  let kept = 0
  let skipped = 0
  const errors: { id: string; email: string; error: string }[] = []

  for (const r of results) {
    try {
      if (r.recommended_action === 'activate' && r.recommended_payload) {
        const { error } = await admin
          .from('profiles')
          .update(r.recommended_payload)
          .eq('id', r.id)
        if (error) {
          errors.push({ id: r.id, email: r.email, error: error.message })
        } else {
          activated++
        }
      } else if (r.recommended_action === 'delete' && deleteLeads) {
        const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supaUrl || !supaKey) {
          errors.push({ id: r.id, email: r.email, error: 'Missing service role config' })
          continue
        }
        const delRes = await fetch(`${supaUrl}/auth/v1/admin/users/${r.id}`, {
          method: 'DELETE',
          headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
        })
        if (delRes.ok) {
          deleted++
        } else {
          errors.push({ id: r.id, email: r.email, error: `HTTP ${delRes.status}` })
        }
      } else if (r.recommended_action === 'keep') {
        kept++
      } else {
        skipped++
      }
    } catch (e) {
      errors.push({ id: r.id, email: r.email, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({
    mode: 'apply',
    total: results.length,
    activated,
    deleted,
    kept,
    skipped,
    errors,
    delete_leads_setting: deleteLeads,
    results,
  })
}
