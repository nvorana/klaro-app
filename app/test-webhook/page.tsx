'use client'

import { useState } from 'react'

// ─── Scenarios ────────────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: 'enroll',
    label: 'Enroll as TOPIS Student',
    description: 'Simulates the TOPIS-Student tag being added. Should set program_type = topis and access_level = enrolled.',
    color: 'bg-blue-500',
    tag: 'TOPIS-Student',
    event: 'contact.tag_added',
  },
  {
    id: 'suspend',
    label: 'Suspend (UNSETTLED — missed payment)',
    description: 'Simulates TOPIS-77-UNSETTLED being added. Should set access_suspended = true. Student will see the suspension screen.',
    color: 'bg-red-500',
    tag: 'TOPIS-77-UNSETTLED',
    event: 'contact.tag_added',
  },
  {
    id: 'restore_unsettled',
    label: 'Restore (UNSETTLED removed)',
    description: 'Simulates TOPIS-77-UNSETTLED being removed. Should set access_suspended = false.',
    color: 'bg-green-500',
    tag: 'TOPIS-77-UNSETTLED',
    event: 'contact.tag_removed',
  },
  {
    id: 'second_pay',
    label: '2nd Payment Settled',
    description: 'Simulates TOPIS-77-2nd-Pay-Settled being added. Should set access_suspended = false and store cohort_batch = 77.',
    color: 'bg-amber-500',
    tag: 'TOPIS-77-2nd-Pay-Settled',
    event: 'contact.tag_added',
  },
  {
    id: 'full_pay',
    label: 'Full Payment Received',
    description: 'Simulates TOPIS-77-Full-Payment being added. Should set access_suspended = false and access_level = full_access.',
    color: 'bg-emerald-600',
    tag: 'TOPIS-77-Full-Payment',
    event: 'contact.tag_added',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function TestWebhookPage() {
  const [email, setEmail] = useState('')
  const [results, setResults] = useState<{ scenario: string; status: 'ok' | 'error'; message: string; time: string }[]>([])
  const [loading, setLoading] = useState<string | null>(null)

  async function runScenario(scenario: typeof SCENARIOS[0]) {
    if (!email.trim()) {
      alert('Enter a test email address first.')
      return
    }

    setLoading(scenario.id)

    const payload = {
      event_type: scenario.event,
      contact: { email: email.trim() },
      tag: { name: scenario.tag },
    }

    try {
      const res = await fetch('/api/webhooks/systeme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      const time = new Date().toLocaleTimeString()

      setResults(prev => [{
        scenario: scenario.label,
        status: res.ok ? 'ok' : 'error',
        message: res.ok
          ? `✓ Webhook accepted. Tag: ${scenario.tag} | Event: ${scenario.event}`
          : `✗ Error ${res.status}: ${JSON.stringify(data)}`,
        time,
      }, ...prev])
    } catch (err) {
      setResults(prev => [{
        scenario: scenario.label,
        status: 'error',
        message: `✗ Network error: ${err}`,
        time: new Date().toLocaleTimeString(),
      }, ...prev])
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="inline-block bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
            Internal Tool
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Webhook Tester</h1>
          <p className="text-gray-400 text-sm">
            Simulates Systeme.io tag events against your webhook. Use this to verify that tagging a student correctly suspends or restores their KLARO access.
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6 text-sm text-gray-300 leading-relaxed">
          <p className="font-semibold text-white mb-2">Before you start:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-400">
            <li>Sign up a test account at your KLARO signup page (use a real email you control).</li>
            <li>Paste that email below.</li>
            <li>Run each scenario in order — Enroll first, then Suspend, then Restore.</li>
            <li>After each step, log in as that test account to verify the result.</li>
          </ol>
        </div>

        {/* Email input */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            Test Account Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="yourname+test1@gmail.com"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Scenario buttons */}
        <div className="space-y-3 mb-8">
          {SCENARIOS.map(s => (
            <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white mb-1">{s.label}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{s.description}</p>
                  <p className="text-xs text-gray-600 mt-1 font-mono">
                    Tag: {s.tag} · {s.event === 'contact.tag_added' ? 'Added' : 'Removed'}
                  </p>
                </div>
                <button
                  onClick={() => runScenario(s)}
                  disabled={loading === s.id}
                  className={`${s.color} text-white text-xs font-bold px-4 py-2 rounded-lg flex-shrink-0 disabled:opacity-50 transition-opacity`}
                >
                  {loading === s.id ? 'Running...' : 'Run'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Results log */}
        {results.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Results Log</p>
              <button
                onClick={() => setResults([])}
                className="text-xs text-gray-600 hover:text-gray-400"
              >
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-xl px-4 py-3 border text-sm ${
                    r.status === 'ok'
                      ? 'bg-green-950/50 border-green-800 text-green-300'
                      : 'bg-red-950/50 border-red-800 text-red-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs">{r.scenario}</span>
                    <span className="text-xs opacity-60">{r.time}</span>
                  </div>
                  <p className="text-xs opacity-80 font-mono">{r.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What to check */}
        <div className="mt-8 bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm">
          <p className="font-semibold text-white mb-2">What to verify after each scenario:</p>
          <ul className="space-y-1.5 text-gray-400 text-xs">
            <li><span className="text-blue-400 font-semibold">After Enroll:</span> Log in as the test account → should reach the dashboard normally.</li>
            <li><span className="text-red-400 font-semibold">After Suspend:</span> Log in → should see the &quot;Account on hold&quot; screen instead of the dashboard.</li>
            <li><span className="text-green-400 font-semibold">After Restore:</span> Log in → dashboard is back, all previous work is still there.</li>
            <li><span className="text-amber-400 font-semibold">After 2nd Pay:</span> Same as Restore — dashboard accessible, cohort_batch = 77 stored.</li>
            <li><span className="text-emerald-400 font-semibold">After Full Payment:</span> Dashboard accessible, access_level upgraded to full_access.</li>
          </ul>
        </div>

      </div>
    </div>
  )
}
