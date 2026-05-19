import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface AuditRow {
  id: number
  profile_id: string
  field: string
  before_value: unknown
  after_value: unknown
  changed_by: string | null
  source: string
  changed_at: string
}

interface ProfileLite {
  id: string
  full_name: string | null
  email: string | null
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; field?: string; source?: string; limit?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!me || !['admin', 'coach'].includes(me.role)) redirect('/dashboard')

  const params = await searchParams
  const emailFilter = params.email?.trim().toLowerCase() ?? ''
  const fieldFilter = params.field ?? ''
  const sourceFilter = params.source ?? ''
  const limit = Math.min(parseInt(params.limit ?? '100', 10) || 100, 500)

  const admin = createAdminClient()

  // ── Build the audit query ──────────────────────────────────────────────────
  let auditQuery = admin
    .from('profile_audit_log')
    .select('id, profile_id, field, before_value, after_value, changed_by, source, changed_at')
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (fieldFilter) auditQuery = auditQuery.eq('field', fieldFilter)
  if (sourceFilter) auditQuery = auditQuery.eq('source', sourceFilter)

  // Email filter requires a profile lookup first
  if (emailFilter) {
    const { data: matched } = await admin
      .from('profiles')
      .select('id')
      .ilike('email', `%${emailFilter}%`)
      .limit(50)
    const ids = (matched ?? []).map(m => m.id)
    if (ids.length === 0) {
      // No matches → return empty audit
      auditQuery = auditQuery.in('profile_id', ['00000000-0000-0000-0000-000000000000'])
    } else {
      auditQuery = auditQuery.in('profile_id', ids)
    }
  }

  const { data: rows } = await auditQuery
  const audit = (rows ?? []) as AuditRow[]

  // ── Look up profile names + actor names in batch ───────────────────────────
  const profileIds = Array.from(new Set(audit.map(r => r.profile_id)))
  const actorIds = Array.from(new Set(audit.map(r => r.changed_by).filter(Boolean) as string[]))

  const [{ data: profileRows }, { data: actorRows }] = await Promise.all([
    profileIds.length > 0
      ? admin.from('profiles').select('id, full_name, email').in('id', profileIds)
      : Promise.resolve({ data: [] as ProfileLite[] }),
    actorIds.length > 0
      ? admin.from('profiles').select('id, full_name, email').in('id', actorIds)
      : Promise.resolve({ data: [] as ProfileLite[] }),
  ])

  const profileMap = new Map((profileRows ?? []).map(p => [p.id, p as ProfileLite]))
  const actorMap = new Map((actorRows ?? []).map(p => [p.id, p as ProfileLite]))

  const fmtValue = (v: unknown): string => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'string') return `"${v}"`
    return JSON.stringify(v)
  }

  const fmtTime = (iso: string): string => {
    const d = new Date(iso)
    return d.toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'medium' })
  }

  const sourceBadge = (s: string): string => {
    if (s.startsWith('coach_')) return 'bg-yellow-50 text-yellow-700 border-yellow-200'
    if (s.startsWith('webhook_')) return 'bg-blue-50 text-blue-700 border-blue-200'
    if (s === 'sweep_pending' || s === 'claim_pending') return 'bg-green-50 text-green-700 border-green-200'
    if (s === 'cohort_unlock' || s === 'batch_unlock') return 'bg-purple-50 text-purple-700 border-purple-200'
    if (s === 'unknown' || s === 'direct_db') return 'bg-red-50 text-red-700 border-red-200'
    return 'bg-gray-50 text-gray-700 border-gray-200'
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="bg-[#1A1F36] text-white px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-[#F4B942] text-sm hover:underline">← Back to Admin</Link>
            <h1 className="text-2xl font-bold mt-1">Access Audit Log</h1>
            <p className="text-white/60 text-sm mt-1">
              Every change to <code className="text-[#F4B942]">unlocked_modules</code>,{' '}
              <code className="text-[#F4B942]">access_level</code>, and{' '}
              <code className="text-[#F4B942]">access_suspended</code>. Append-only.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <form className="max-w-7xl mx-auto flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Student email (partial match)
            </label>
            <input
              type="text"
              name="email"
              defaultValue={emailFilter}
              placeholder="e.g. wendy or @gmail.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:border-[#1A1F36] focus:outline-none"
            />
          </div>
          <div className="min-w-[170px]">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Field</label>
            <select name="field" defaultValue={fieldFilter} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white">
              <option value="">All fields</option>
              <option value="unlocked_modules">unlocked_modules</option>
              <option value="access_level">access_level</option>
              <option value="access_suspended">access_suspended</option>
            </select>
          </div>
          <div className="min-w-[170px]">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Source</label>
            <select name="source" defaultValue={sourceFilter} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white">
              <option value="">All sources</option>
              <option value="coach_unlock_api">coach_unlock_api</option>
              <option value="coach_lock_api">coach_lock_api</option>
              <option value="webhook_systeme">webhook_systeme</option>
              <option value="sweep_pending">sweep_pending</option>
              <option value="claim_pending">claim_pending</option>
              <option value="cohort_unlock">cohort_unlock</option>
              <option value="batch_unlock">batch_unlock</option>
              <option value="unknown">unknown</option>
            </select>
          </div>
          <div className="min-w-[100px]">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Limit</label>
            <select name="limit" defaultValue={String(limit)} className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white">
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
          <button type="submit" className="bg-[#1A1F36] text-white font-bold px-5 py-2 rounded-lg text-sm hover:bg-[#2d3458]">
            Filter
          </button>
          {(emailFilter || fieldFilter || sourceFilter) && (
            <Link href="/admin/audit-log" className="text-gray-400 text-sm underline">Clear</Link>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto p-6">
        <p className="text-sm text-gray-500 mb-3">
          Showing <span className="font-bold text-[#1A1F36]">{audit.length}</span> change{audit.length === 1 ? '' : 's'}
          {limit === audit.length && ' (limit reached — narrow filters for more)'}
        </p>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Field</th>
                <th className="px-4 py-3">Before → After</th>
                <th className="px-4 py-3">By</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {audit.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No audit entries match these filters.</td></tr>
              ) : audit.map(row => {
                const profile = profileMap.get(row.profile_id)
                const actor = row.changed_by ? actorMap.get(row.changed_by) : null
                return (
                  <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">{fmtTime(row.changed_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#1A1F36]">{profile?.full_name ?? '?'}</div>
                      <div className="text-gray-400 text-xs">{profile?.email ?? row.profile_id}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#1A1F36]">{row.field}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <span className="text-red-600">{fmtValue(row.before_value)}</span>
                      <span className="text-gray-400 mx-1">→</span>
                      <span className="text-green-600">{fmtValue(row.after_value)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {actor ? (
                        <>
                          <div className="font-semibold text-[#1A1F36]">{actor.full_name ?? '?'}</div>
                          <div className="text-gray-400">{actor.email}</div>
                        </>
                      ) : (
                        <span className="text-gray-400 italic">system</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-md text-xs font-mono border ${sourceBadge(row.source)}`}>
                        {row.source}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
