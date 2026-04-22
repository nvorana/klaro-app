// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Drift Check
// ───────────────────────────────────────────────────────────────────────────
//
// Per Doc 4:
// "The lightweight drift check is concrete and deterministic:
//  - use the step's Required Context table from Document 3 to identify
//    approved upstream fields that must remain unchanged
//  - run string equality comparison on those approved upstream values
//    against the revised draft
//  - if any approved upstream value has been modified inside the revised
//    draft, reject the revision as `drift_detected`
//  - return the revision to the Revision Agent with the instruction:
//    `Do not modify approved upstream values.`
//
// This drift check is not an LLM judgment call. It is a rule-based
// comparison against approved upstream context."

import { canonicalJSON } from '../hash'

export interface DriftCheckResult {
  drift_detected: boolean
  drifted_fields: string[]
  message?: string
}

/**
 * Compares the revised draft against the approved upstream context.
 * If any value in the upstream context has been modified inside the revised
 * draft, flag it as drift.
 *
 * Since upstream context values are typically referenced (not embedded) in
 * draft payloads, drift usually means the reviser tried to smuggle changes
 * via the writable fields. The merge layer in reviser.ts already strips
 * non-writable-field changes, so this function mostly audits that merge
 * worked correctly.
 */
export function checkDrift(
  revisedDraft: Record<string, unknown>,
  readOnlyContext: Record<string, unknown>
): DriftCheckResult {
  const driftedFields: string[] = []

  for (const [key, expectedValue] of Object.entries(readOnlyContext)) {
    if (!(key in revisedDraft)) continue  // if not embedded, no drift to check

    const actualValue = revisedDraft[key]
    const expectedJSON = canonicalJSON(expectedValue)
    const actualJSON = canonicalJSON(actualValue)

    if (expectedJSON !== actualJSON) {
      driftedFields.push(key)
    }
  }

  if (driftedFields.length > 0) {
    return {
      drift_detected: true,
      drifted_fields: driftedFields,
      message: `Drift detected in ${driftedFields.length} read-only field(s): ${driftedFields.join(', ')}`,
    }
  }

  return { drift_detected: false, drifted_fields: [] }
}
