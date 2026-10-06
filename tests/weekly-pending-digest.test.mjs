import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(fs.readFileSync('app/api/cron/weekly-pending-digest/route.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const policy = ts.transpileModule(fs.readFileSync('lib/apKlaroPolicy.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText
const policyExports = {}
vm.runInNewContext(policy, { exports: policyExports })

async function run(profiles, contacts = {}, options = {}) {
  const writes = [], welcomes = [], messages = [], calls = []
  const admin = {
    rpc: async () => ({}),
    from: () => ({
      select: () => ({ eq: () => ({ lt: async () => ({ data: profiles, error: options.queryError }) }) }),
      update: payload => ({ eq: async (_, id) => {
        writes.push({ id, payload })
        return { error: id === 'fail' ? { message: '<database failure>' } : null }
      } }),
    }),
  }
  const exports = {}
  vm.runInNewContext(source, {
    exports, console: { log() {}, warn() {}, error() {} }, Date, URL,
    setTimeout: callback => { callback(); return 0 },
    process: { env: { CRON_SECRET: 'test', SYSTEME_API_KEY: options.noApiKey ? '' : 'test', RESEND_API_KEY: 'test' } },
    require: name => {
      if (name === 'next/server') return { NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) } }
      if (name === '@/lib/supabase/admin') return { createAdminClient: () => admin }
      if (name === '@/lib/apKlaroPolicy') return policyExports
      if (name === '@/lib/email/sendWelcomeEmail') return { sendWelcomeEmail: async args => {
        welcomes.push(args)
        if (options.welcomeError) throw Error('mail failure')
      } }
      throw Error(name)
    },
    fetch: async (url, init) => {
      if (url.includes('resend.com')) { messages.push(JSON.parse(init.body)); return { ok: true } }
      const email = new URL(url).searchParams.get('email')
      calls.push(email)
      const contact = contacts[email]
      if (contact === 'error') throw Error('network failure')
      if (contact === 'http') return { ok: false }
      return { ok: true, json: async () => ({ items: contact === undefined ? [] : [{ tags: contact.map(name => ({ name })) }] }) }
    },
  })
  const response = await exports.GET({ headers: { get: () => 'Bearer test' }, nextUrl: new URL('https://example.com') })
  // Normalize VM objects to the host realm for deep equality assertions.
  return JSON.parse(JSON.stringify({ ...response, writes, welcomes, messages, calls }))
}
const profile = (id, created_at = '2026-07-01T00:00:00Z') => ({ id, email: `${id}@example.com`, full_name: '<Name>', created_at })

test('October 4 regression: eight policy skips and two leads produce two manual reviews', async () => {
  const profiles = Array.from({ length: 10 }, (_, i) => profile(String(i)))
  const contacts = Object.fromEntries(profiles.map((p, i) => [p.email, i < 8 ? ['Accel-Enrolled'] : ['Newsletter']]))
  const result = await run(profiles, contacts)
  assert.equal(result.body.stuck, 2)
  assert.equal(result.body.manual_review, 2)
  assert.equal(result.body.activated, 0)
  assert.equal(result.body.counts.policy_skips, 8)
  assert.equal(result.body.counts.leads, 2)
  assert.deepEqual(result.body.stuck_accounts.map(a => a.finalStatus), ['lead_only', 'lead_only'])
  assert.equal(result.writes.length, 0)
  assert.equal(result.welcomes.length, 0)
  assert.match(result.messages[0].subject, /2 manual review, 8 policy skips/)
  assert.doesNotMatch(result.messages[0].html, /After 3 retry attempts.*no payment tags/)
  assert.match(result.messages[0].html, /&lt;Name&gt;/)
})

test('cutoff boundary, unaffected TOPIS/tier, update failure, and successful activations', async () => {
  const profiles = [profile('legacy', '2026-06-30T15:59:59Z'), profile('cutoff', '2026-06-30T16:00:00Z'), profile('topis'), profile('tier'), profile('fail')]
  const result = await run(profiles, {
    'legacy@example.com': ['Accel-Enrolled'], 'cutoff@example.com': ['Accel-Enrolled'],
    'topis@example.com': ['TOPIS | Student'], 'tier@example.com': ['Klaro-tier2'], 'fail@example.com': ['TOPIS | Student'],
  }, { welcomeError: true })
  assert.equal(result.body.activated, 3)
  assert.equal(result.body.counts.policy_skips, 1)
  assert.equal(result.body.counts.activation_failures, 1)
  assert.equal(result.body.stuck, 1)
  assert.equal(result.writes.length, 4)
  assert.equal(result.welcomes.length, 3)
  assert.ok(!result.writes.some(w => w.id === 'cutoff'))
  assert.match(result.messages[0].html, /&lt;database failure&gt;/)
})

test('tagless contacts are leads; absent contacts and failed lookups have distinct counts and retries', async () => {
  const result = await run(['tagless', 'missing', 'network', 'http'].map(id => profile(id)), {
    'tagless@example.com': [], 'network@example.com': 'error', 'http@example.com': 'http',
  })
  assert.deepEqual(result.body.counts, { policy_skips: 0, leads: 1, not_found: 1, lookup_failures: 2, activation_failures: 0, activations: 0 })
  assert.equal(result.calls.filter(email => email === 'tagless@example.com').length, 1)
  for (const id of ['missing', 'network', 'http']) assert.equal(result.calls.filter(email => email === `${id}@example.com`).length, 3)
  assert.match(result.messages[0].html, /Payment status is unknown/)
})

test('missing API key is a lookup failure, not a missing contact', async () => {
  const result = await run([profile('unknown')], {}, { noApiKey: true })
  assert.equal(result.body.counts.lookup_failures, 1)
  assert.equal(result.body.counts.not_found, 0)
  assert.equal(result.calls.length, 0)
})

test('policy-only, empty, and ignored batches have consistent counts and accurate clean copy', async () => {
  for (const profiles of [[], [profile('policy')], [profile('nvorana+test'), { ...profile('noemail'), email: null }]]) {
    const result = await run(profiles, { 'policy@example.com': ['Accel-Enrolled'] })
    assert.equal(result.body.manual_review, 0)
    assert.equal(result.body.stuck, 0)
    assert.equal(Object.values(result.body.counts).reduce((a, b) => a + b, 0) + result.body.ignored, result.body.scanned)
    assert.match(result.messages[0].html, /No manual-review exceptions/)
    assert.doesNotMatch(result.messages[0].html, /verified as not-in-Systeme/)
  }
})

test('query failure returns 500 and never sends a misleading clean audit', async () => {
  const result = await run(null, {}, { queryError: { message: 'database unavailable' } })
  assert.equal(result.status, 500)
  assert.equal(result.messages.length, 0)
})
