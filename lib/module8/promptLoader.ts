// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Prompt Loader
// ───────────────────────────────────────────────────────────────────────────
//
// Loads creator / validator / reviser prompts from markdown files in
// /prompts/module8/. Prompt version is derived from content hash (first 8
// hex chars of SHA-256) and recorded in audit log + step_outputs.

import { readFile } from 'fs/promises'
import path from 'path'
import { createHash } from 'crypto'

const PROMPT_ROOT = path.join(process.cwd(), 'prompts')

const promptCache = new Map<string, { content: string; version: string }>()

export async function loadPrompt(ref: string): Promise<{ content: string; version: string }> {
  // Cache by ref for single request efficiency
  const cached = promptCache.get(ref)
  if (cached) return cached

  const filepath = path.join(PROMPT_ROOT, `${ref}.md`)
  const content = await readFile(filepath, 'utf-8')
  const version = createHash('sha256').update(content, 'utf8').digest('hex').substring(0, 8)

  const result = { content, version }
  promptCache.set(ref, result)
  return result
}

export function clearPromptCache() {
  promptCache.clear()
}
