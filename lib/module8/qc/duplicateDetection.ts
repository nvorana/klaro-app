// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Duplicate Detection
// ───────────────────────────────────────────────────────────────────────────
//
// Per Doc 5:
// - Use normalized cosine similarity on embeddings, flag if similarity > 0.85
// - Fallback to token-level Jaccard > 0.70 if embeddings unavailable
// - Scope: peer sets only (lesson-to-lesson within module, module-to-module
//   within course)

import { openai } from '@/lib/openai'
import { HARD_RULES, HardRuleId } from '../types'

const EMBEDDING_MODEL = 'text-embedding-3-small'
const COSINE_THRESHOLD = 0.85
const JACCARD_THRESHOLD = 0.70

export interface DuplicateFlag {
  rule_id: HardRuleId
  field: string
  item_a: { index: number; text: string }
  item_b: { index: number; text: string }
  similarity: number
  method: 'cosine' | 'jaccard'
  message: string
}

export interface DuplicateCheckOptions {
  fieldName: string
  scope: string  // e.g. 'module_to_module_within_course'
}

/**
 * Detects duplicate/near-duplicate titles within a peer set.
 * Prefers embeddings-based cosine similarity; falls back to Jaccard if
 * embedding call fails.
 */
export async function detectDuplicates(
  titles: string[],
  options: DuplicateCheckOptions
): Promise<DuplicateFlag[]> {
  if (titles.length < 2) return []

  // Try embeddings first
  try {
    const embeddings = await getEmbeddings(titles)
    return findDuplicatesCosine(titles, embeddings, options)
  } catch (err) {
    console.warn('[Module 8 duplicate detection] Embeddings failed, falling back to Jaccard:', err)
    return findDuplicatesJaccard(titles, options)
  }
}

// ─── Cosine similarity ─────────────────────────────────────────────────────

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  })
  return response.data.map(d => d.embedding as number[])
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function findDuplicatesCosine(
  titles: string[],
  embeddings: number[][],
  options: DuplicateCheckOptions
): DuplicateFlag[] {
  const flags: DuplicateFlag[] = []
  for (let i = 0; i < titles.length; i++) {
    for (let j = i + 1; j < titles.length; j++) {
      const sim = cosineSimilarity(embeddings[i], embeddings[j])
      if (sim > COSINE_THRESHOLD) {
        flags.push({
          rule_id: HARD_RULES.REJECT_DUPLICATE_TITLES,
          field: options.fieldName,
          item_a: { index: i, text: titles[i] },
          item_b: { index: j, text: titles[j] },
          similarity: Number(sim.toFixed(4)),
          method: 'cosine',
          message: `Items ${i + 1} and ${j + 1} are too similar (cosine ${sim.toFixed(3)} > ${COSINE_THRESHOLD}). "${titles[i]}" ↔ "${titles[j]}"`,
        })
      }
    }
  }
  return flags
}

// ─── Jaccard fallback ──────────────────────────────────────────────────────

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2)
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  const intersection = new Set([...a].filter(x => b.has(x)))
  const union = new Set([...a, ...b])
  return intersection.size / union.size
}

function findDuplicatesJaccard(
  titles: string[],
  options: DuplicateCheckOptions
): DuplicateFlag[] {
  const tokens = titles.map(tokenize)
  const flags: DuplicateFlag[] = []
  for (let i = 0; i < titles.length; i++) {
    for (let j = i + 1; j < titles.length; j++) {
      const sim = jaccard(tokens[i], tokens[j])
      if (sim > JACCARD_THRESHOLD) {
        flags.push({
          rule_id: HARD_RULES.REJECT_DUPLICATE_TITLES,
          field: options.fieldName,
          item_a: { index: i, text: titles[i] },
          item_b: { index: j, text: titles[j] },
          similarity: Number(sim.toFixed(4)),
          method: 'jaccard',
          message: `Items ${i + 1} and ${j + 1} have too many shared tokens (Jaccard ${sim.toFixed(3)} > ${JACCARD_THRESHOLD}). "${titles[i]}" ↔ "${titles[j]}"`,
        })
      }
    }
  }
  return flags
}
