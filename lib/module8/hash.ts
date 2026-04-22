// ───────────────────────────────────────────────────────────────────────────
// Canonical JSON Serialization + SHA-256 Hash (Module 8)
// ───────────────────────────────────────────────────────────────────────────
//
// Per Document 5:
// - use SHA-256
// - canonical JSON serialization
// - object keys sorted alphabetically at every level
// - no whitespace
// - UTF-8 encoding before hashing
// - preserve array order
// - do NOT use native JSON.stringify()
//
// This is used for `read_only_context_hash` in `module8_revision_runs`.

import stringify from 'json-stable-stringify'
import { createHash } from 'crypto'

/**
 * Canonical JSON serialization: object keys sorted alphabetically at every
 * level, no whitespace, array order preserved. Deterministic output.
 */
export function canonicalJSON(value: unknown): string {
  const result = stringify(value)
  if (result === undefined) {
    throw new Error('canonicalJSON: input cannot be serialized (undefined result)')
  }
  return result
}

/**
 * SHA-256 hex digest of the canonical JSON representation of a value.
 * Use for read_only_context_hash.
 */
export function canonicalHash(value: unknown): string {
  const json = canonicalJSON(value)
  return createHash('sha256').update(json, 'utf8').digest('hex')
}
