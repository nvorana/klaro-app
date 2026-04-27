// ─── Ebook Editor — Orchestrator ──────────────────────────────────────────────
// editChapter() takes an assembled standard chapter, runs validators, and
// (if needed) revises it in a single follow-up LLM call. Returns the chapter
// (revised or original) plus a debug-only EditReport for admin telemetry.
//
// Design:
// - Tier 1 validators (no LLM) ALWAYS run, in parallel
// - Tier 2 validators (LLM) run ONLY if Tier 1 flagged anything (conditional)
// - Reviser runs ONLY if any validator flagged
// - Single revision pass — never recursive — to bound cost and avoid loops
// - Any failure inside the editor never breaks the calling route; we fall
//   back to the original chapter and log the failure.

import { validateRegister } from './validators/register'
import { validateBannedWords } from './validators/bannedWords'
import { validateRepetition } from './validators/repetition'
import { validateLength } from './validators/length'
import { validatePromiseDelivery } from './validators/promiseDelivery'
import { validateConsistency } from './validators/consistency'
import { validateQuickWinViability } from './validators/quickWinViability'
import { reviseChapter, getReviserMarketHint } from './reviser'
import type {
  ChapterShape,
  EditContext,
  EditReport,
  EditedChapter,
  Issue,
  ValidatorResult,
} from './types'

// Re-export types so consumers only import from one path.
export type {
  ChapterShape,
  EditContext,
  EditReport,
  EditedChapter,
  Issue,
  ValidatorResult,
} from './types'

// Hard cap so a stuck validator never holds up the whole route.
const VALIDATOR_TIMEOUT_MS = 8000

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then(value => {
      clearTimeout(timer)
      resolve(value)
    }).catch(() => {
      clearTimeout(timer)
      resolve(fallback)
    })
  })
}

const okResult = (): ValidatorResult => ({ ok: true, issues: [], elapsed_ms: 0 })

export async function editChapter(
  chapter: ChapterShape,
  context: EditContext,
): Promise<EditedChapter> {
  const started = Date.now()
  const report: EditReport = {
    ran: true,
    tier1_results: {},
    reviser_ran: false,
    total_issues_found: 0,
    total_issues_remaining: 0,
    total_elapsed_ms: 0,
  }

  try {
    // ── Tier 1 (no LLM, parallel) ────────────────────────────────────────────
    // All four are synchronous in practice but wrapped in Promise.resolve so
    // the orchestration shape stays uniform.
    const [register, banned, repetition, length] = await Promise.all([
      Promise.resolve(validateRegister(chapter)),
      Promise.resolve(validateBannedWords(chapter)),
      Promise.resolve(validateRepetition(chapter)),
      Promise.resolve(validateLength(chapter)),
    ])
    report.tier1_results = {
      register,
      banned_words: banned,
      repetition,
      length,
    }

    const tier1Issues: Issue[] = [
      ...register.issues,
      ...banned.issues,
      ...repetition.issues,
      ...length.issues,
    ]
    let allIssues: Issue[] = [...tier1Issues]

    // ── Tier 2 (LLM, conditional) ────────────────────────────────────────────
    // Only run if Tier 1 flagged something. Each call is wrapped in a timeout
    // so a slow OpenAI response can't stall the route.
    if (tier1Issues.length > 0) {
      const [promise, consistency, qwViability] = await Promise.all([
        withTimeout(validatePromiseDelivery(chapter, context.outline), VALIDATOR_TIMEOUT_MS, okResult()),
        withTimeout(validateConsistency(chapter), VALIDATOR_TIMEOUT_MS, okResult()),
        withTimeout(validateQuickWinViability(chapter), VALIDATOR_TIMEOUT_MS, okResult()),
      ])
      report.tier2_results = {
        promise_delivery: promise,
        consistency,
        quick_win_viability: qwViability,
      }
      allIssues = [
        ...allIssues,
        ...promise.issues,
        ...consistency.issues,
        ...qwViability.issues,
      ]
    }

    report.total_issues_found = allIssues.length

    // ── Reviser (LLM, runs once if any issues) ───────────────────────────────
    if (allIssues.length === 0) {
      report.total_issues_remaining = 0
      report.total_elapsed_ms = Date.now() - started
      return { chapter, report }
    }

    report.reviser_ran = true
    const reviserStarted = Date.now()
    const marketHint = await getReviserMarketHint()
    const revised = await reviseChapter(chapter, allIssues, marketHint)
    report.reviser_elapsed_ms = Date.now() - reviserStarted
    report.reviser_succeeded = revised !== null

    if (!revised) {
      // Reviser failed — fall back to original chapter, log the failure.
      console.warn(`[ebookEditor] reviser failed; returning original chapter with ${allIssues.length} unresolved issues`)
      report.total_issues_remaining = allIssues.length
      report.total_elapsed_ms = Date.now() - started
      return { chapter, report }
    }

    // ── Re-run Tier 1 only on the revised chapter to count remaining issues
    // (telemetry — we don't run Tier 2 again or recurse into the reviser).
    const re_register = validateRegister(revised)
    const re_banned = validateBannedWords(revised)
    const re_repetition = validateRepetition(revised)
    const re_length = validateLength(revised)
    report.total_issues_remaining =
      re_register.issues.length +
      re_banned.issues.length +
      re_repetition.issues.length +
      re_length.issues.length

    report.total_elapsed_ms = Date.now() - started
    console.log(
      `[ebookEditor] chapter "${context.outline.title}" — ` +
      `${report.total_issues_found} found, ${report.total_issues_remaining} remaining, ` +
      `${report.total_elapsed_ms}ms total`
    )
    return { chapter: revised, report }
  } catch (err) {
    // Catastrophic failure — never break the calling route. Return the
    // original chapter with a report that records the failure.
    console.error('[ebookEditor] orchestrator threw:', err)
    report.total_elapsed_ms = Date.now() - started
    return { chapter, report }
  }
}
