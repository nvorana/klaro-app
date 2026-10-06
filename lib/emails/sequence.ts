// ─── Module 5: the 7-day email sequence ───────────────────────────────────────
//
// Rebuilt 2026-10-06. Audit of all 68 saved sequences found:
//   - Day 7 quoted prices and bonuses the model was never given. One student
//     selling at ₱297 had "₱450 lang", "total value mahigit ₱4,000" (real:
//     ₱2,488) and an "exclusive community" that does not exist; another at
//     ₱297 had "₱1,500". Buyers saw a different price than the sales page.
//   - Example lines were copied: "7:43" in 58/68 sequences, "I need to tell
//     you something personal" in 59/68 Day 5s, "This is my last email about
//     this" in 67/68 Day 7s.
//   - Day 5/6 asked for the author's personal struggles, "Ganyan din ako
//     dati" and social proof with numbers: invented under the student's name.
//   - Seven independent gpt-4o calls with no shared plan repeated each other.
// Now: the real offer (price, value, bonuses, guarantee) and the student's
// ebook are loaded server-side; each value email teaches a different chapter
// so the seven don't overlap; nothing personal or numeric is invented; peso
// amounts in selling emails are checked against the offer in code; gpt-5.6-sol
// writes in the same voice as the ebook.

import { openai, modelForRoute, samplingParams, tokenLimit } from '@/lib/openai'
import { logAiUsage } from '@/lib/aiUsage'
import { findBannedWords } from '@/lib/bannedWords'
import { createClient } from '@/lib/supabase/server'

const EMAIL_MODEL = modelForRoute('email-sequence', 'creative', 'gpt-5.6-sol')
// Selling days get a third try: a wrong price is never returned.
const attemptsFor = (type: 'value' | 'selling') => (type === 'selling' ? 3 : 2)

export interface EmailRequest {
  day: number
  target_market: string
  problem: string
  mechanism: string
  ebook_title: string
  sales_page_url: string
}

export interface Email {
  day: number
  type: 'value' | 'selling'
  subject_a: string
  subject_b: string
  body: string
  cta: string | null
}

interface Bonus { name: string; value: number; description: string; objection: string }
interface Chapter { number: number; title: string; win: string; winResult: string }

interface Material {
  author: string
  market: string
  problem: string
  mechanism: string
  ebookTitle: string
  price: number | null
  totalValue: number | null
  ebookValue: number | null
  guarantee: string
  bonuses: Bonus[]
  chapters: Chapter[]
  theirWords: string[]
  alreadyTry: string[]
  alreadySpend: string
  transformation: string
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const n = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null)
const peso = (x: number) => `₱${x.toLocaleString('en-US')}`

// "Ma. Theresa Cruz" -> "Ma. Theresa"; "Nolasco Orana" -> "Nolasco".
function firstName(full: string): string {
  const parts = full.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  return /\.$/.test(parts[0]) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0]
}

// Every peso amount the text states, however it is written: ₱297, P297,
// PHP 297, Php297, 297 pesos.
function statedPesos(text: string): number[] {
  const re = /(?:₱|\bPHP|\bP(?=\d))\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?pesos?\b/gi
  return [...text.matchAll(re)].map(x => Number((x[1] || x[2]).replace(/,/g, '')))
}

async function loadMaterial(userId: string, req: EmailRequest): Promise<Material> {
  const supabase = await createClient()
  const [{ data: profile }, { data: clarity }, { data: offer }, { data: ebook }] = await Promise.all([
    supabase.from('profiles').select('first_name, full_name').eq('id', userId).maybeSingle(),
    supabase.from('clarity_sentences').select('target_market, core_problem, unique_mechanism, validation_feedback, market_language').eq('user_id', userId).maybeSingle(),
    supabase.from('offers').select('ebook_title, selling_price, total_value, ebook_value, guarantee, bonuses, transformation').eq('user_id', userId).maybeSingle(),
    supabase.from('ebooks').select('title, chapters').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const vf = (clarity?.validation_feedback ?? {}) as { existing_solutions?: string[]; buying_behavior?: string }
  const ml = (clarity?.market_language ?? {}) as { emotional_words?: string[]; everyday_phrases?: string[] }
  const rawBonuses = Array.isArray(offer?.bonuses) ? offer!.bonuses as Array<Record<string, unknown>> : []
  const rawChapters = Array.isArray(ebook?.chapters) ? ebook!.chapters as Array<Record<string, unknown>> : []
  return {
    author: s(profile?.first_name) || firstName(s(profile?.full_name)),
    market: s(clarity?.target_market) || req.target_market,
    problem: s(clarity?.core_problem) || req.problem,
    mechanism: s(clarity?.unique_mechanism) || req.mechanism,
    ebookTitle: s(offer?.ebook_title) || s(ebook?.title) || req.ebook_title,
    price: n(offer?.selling_price),
    totalValue: n(offer?.total_value),
    ebookValue: n(offer?.ebook_value),
    guarantee: s(offer?.guarantee).replace(/\s*—\s*/g, ', '),
    bonuses: rawBonuses.map(b => ({
      name: s(b.bonus_name) || s(b.name) || s(b.title),
      value: n(b.value_peso) ?? n(b.value) ?? 0,
      description: s(b.description),
      objection: s(b.objection_addressed),
    })).filter(b => b.name),
    chapters: rawChapters.map((c, i) => {
      const qw = (c.quick_win ?? {}) as Record<string, unknown>
      return { number: Number(c.number) || i + 1, title: s(c.title), win: s(qw.name), winResult: s(qw.immediate_result) }
    }).filter(c => c.title),
    theirWords: [...(ml.emotional_words ?? []), ...(ml.everyday_phrases ?? [])].slice(0, 12),
    alreadyTry: vf.existing_solutions ?? [],
    alreadySpend: s(vf.buying_behavior),
    transformation: s(offer?.transformation),
  }
}

// The only peso amounts a selling email may state.
function allowedPesos(m: Material): Set<number> {
  const set = new Set<number>()
  for (const v of [m.price, m.totalValue, m.ebookValue]) if (v) set.add(v)
  for (const b of m.bonuses) if (b.value) set.add(b.value)
  const bonusSum = m.bonuses.reduce((a, b) => a + (b.value || 0), 0)
  if (bonusSum) set.add(bonusSum)
  if (m.price && m.totalValue) set.add(m.totalValue - m.price) // "you save ₱X"
  return set
}

// ── The plan: each value email teaches a different chapter ────────────────────

function valueChapter(m: Material, day: number): Chapter | null {
  if (m.chapters.length === 0) return null
  // Spread days 1-4 across the book so the four value emails never overlap.
  const idx = Math.min(m.chapters.length - 1, Math.round(((day - 1) * (m.chapters.length - 1)) / 3))
  return m.chapters[idx]
}

function dayBrief(m: Material, day: number): { type: 'value' | 'selling'; brief: string } {
  const ch = day <= 4 ? valueChapter(m, day) : null
  const teach = ch
    ? `Teach ONE idea from the book: Chapter ${ch.number}, "${ch.title}".${ch.win ? ` End by giving them its small win to try today: "${ch.win}"${ch.winResult ? ` (they end with: ${ch.winResult})` : ''}.` : ''}`
    : 'Teach ONE practical idea that helps with the problem today.'
  switch (day) {
    case 1: return { type: 'value', brief: `DAY 1, VALUE. Open with an everyday moment where this problem shows up in their life, so they feel seen. ${teach} No selling, no link.` }
    case 2: return { type: 'value', brief: `DAY 2, VALUE. Show the root cause they haven't considered, the reason the usual fixes don't stick. ${teach} No selling, no link.` }
    case 3: return { type: 'value', brief: `DAY 3, VALUE. Bust one common belief or piece of advice this market follows that keeps them stuck. ${teach} No selling, no link.` }
    case 4: return { type: 'value', brief: `DAY 4, VALUE. The shift in thinking that makes the way forward obvious, tied to the book's method (${m.mechanism}). ${teach} End with one line saying tomorrow you'll share something that pulls it all together. No selling, no link.` }
    case 5: return { type: 'selling', brief: `DAY 5, SOFT INTRODUCTION. Introduce the ebook "${m.ebookTitle}": who it is for, the problem it solves, and what they will be able to do after reading (use the real chapters below). Mention the price once and the link once. Low pressure.` }
    case 6: return { type: 'selling', brief: `DAY 6, THE BIGGEST OBJECTION. Name the objection this market is most likely to have (time, money, "baka hindi para sa akin", or having tried other things). Answer it with the book's real contents, the guarantee, and how the price compares to what they already spend trying to fix this. Link once.` }
    default: return { type: 'selling', brief: `DAY 7, FINAL EMAIL. Recap exactly what they get: the ebook and EVERY bonus with its value, the total value, the price, and the guarantee, using ONLY the OFFER FACTS. Describe their next three months with and without acting. Honest urgency only: the cost of waiting, never a fake deadline or limited stock. Clear link.` }
  }
}

function prompt(m: Material, req: EmailRequest, problems: string): string {
  const { type, brief } = dayBrief(m, req.day)
  const bonusLines = m.bonuses.map(b => `- ${b.name}${b.value ? ` (value ${peso(b.value)})` : ''}${b.description ? `: ${b.description}` : ''}`).join('\n')
  const offerFacts = type === 'selling' ? `
OFFER FACTS (use exactly; never change, round, or add to them):
- Ebook: "${m.ebookTitle}"${m.ebookValue ? ` (value ${peso(m.ebookValue)})` : ''}
${bonusLines ? `- Bonuses:\n${bonusLines}` : '- Bonuses: none'}
${m.totalValue ? `- Total value: ${peso(m.totalValue)}` : ''}
${m.price ? `- Price: ${peso(m.price)}` : ''}
${m.guarantee ? `- Guarantee: ${m.guarantee}` : ''}
- Link: ${req.sales_page_url}
` : ''

  return `You are writing ONE email in a 7-day sequence, in the first-person voice of ${m.author || 'the author'}, who wrote an ebook for this market.

THE READER: ${m.market}
THEIR PROBLEM: ${m.problem}
${m.theirWords.length ? `THEIR OWN WORDS: ${m.theirWords.join(', ')}` : ''}
${m.alreadyTry.length ? `WHAT THEY ALREADY TRY: ${m.alreadyTry.join('; ')}` : ''}
${m.alreadySpend ? `WHAT THEY ALREADY SPEND ON: ${m.alreadySpend}` : ''}
THE BOOK'S METHOD: ${m.mechanism}
${m.chapters.length ? `THE BOOK'S CHAPTERS:\n${m.chapters.map(c => `- ${c.number}. ${c.title}${c.win ? ` (win: ${c.win})` : ''}`).join('\n')}` : ''}
${offerFacts}
TODAY: ${brief}

HONESTY (strict):
- Never invent the author's personal experiences, struggles, results, or backstory ("I've been there", "ganyan din ako dati", "when I wrote this book I…"). Write about the reader's life, not an invented one for the author.
- Never invent testimonials, students, results, statistics, studies, or income claims.
- In selling emails, never state a price, value, bonus, discount, community, or feature that is not in OFFER FACTS. The ONLY peso amounts allowed are the ones in OFFER FACTS; describe anything else they spend in words, without a peso figure.

VOICE:
- A trusted friend one step ahead, talking to one person. Not a marketer, not a motivational speaker.
- Conversational Taglish: Tagalog can carry everyday moments and feelings, English carries the insight and the advice. Switch at sentence or phrase boundaries. Never sprinkle Tagalog for flavor and never force a ratio.
- One-line paragraphs, heavy white space, written for a phone screen.
- Show, don't tell: what they see, do, and say. Concrete details from their world, but no invented statistics.
- Never reuse stock lines such as "I need to tell you something personal", "This is my last email about this", "There was a day when everything changed", "I hope this email finds you well", and never use a clock time like 7:43 PM. Find a fresh opening that fits THIS reader.
- Casual forms (yung, di, wag, pag, kasi, naman). No apostrophes on shortened Tagalog words (yan, yung, di, wag, to); English contractions keep theirs. No em dashes. No hype words (unlock, unleash, discover, transform, game-changing, ultimate, amazing).

LENGTH: 200 to 320 words in the body.
SUBJECT LINES: two options for A/B testing, each a complete thought in 2 to 6 words (under 40 characters), curiosity-driven, no clickbait.
SIGN-OFF: "To your (a short aspiration that fits this reader)," then on the next line "${m.author || '[Your Name]'}".
${problems ? `\nYour previous draft was rejected. Fix these problems:\n${problems}\n` : ''}
Return ONLY JSON:
{ "email": { "day": ${req.day}, "type": "${type}", "subject_a": "...", "subject_b": "...", "body": "use \\n between lines", "cta": ${type === 'selling' ? `"${req.sales_page_url}"` : 'null'} } }`
}

function cleanText(t: string): string {
  return t
    .replace(/\s*—\s*/g, ', ')
    .replace(/(^|[\s"(])[‘'](yan|yung|yun|di|wag|to|nung|pag)\b/gi, '$1$2')
}

// Hard checks in code; returns the problems, empty when the email passes.
function check(e: Email, m: Material, req: EmailRequest): string[] {
  const problems: string[] = []
  const words = e.body.split(/\s+/).filter(Boolean).length
  if (words < 170) problems.push(`the body is only ${words} words (aim for 200 to 320)`)
  if (words > 380) problems.push(`the body is ${words} words (aim for 200 to 320)`)
  if (!e.subject_a || !e.subject_b) problems.push('it needs two subject lines')
  const banned = findBannedWords(`${e.subject_a} ${e.subject_b} ${e.body}`)
  if (banned.length) problems.push(`it uses banned words: ${banned.join(', ')}`)
  if (/\b\d{1,2}:\d{2}\b/.test(e.body)) problems.push('it uses a clock time; use a fresh, non-stock detail')
  if (/\[(?!Your Name\])[^\]]+\]/.test(e.body)) problems.push('it left a [placeholder] in brackets')
  if (e.type === 'selling') {
    const allowed = allowedPesos(m)
    const stated = statedPesos(`${e.subject_a} ${e.subject_b} ${e.body}`)
    const wrong = stated.filter(v => !allowed.has(v))
    if (wrong.length) problems.push(`it states peso amounts that are not in the offer: ${wrong.map(peso).join(', ')}. Use only OFFER FACTS`)
    if (req.day === 7 && m.price && !stated.includes(m.price)) problems.push(`Day 7 must state the real price, ${peso(m.price)}`)
  }
  return problems
}

export async function writeEmail(userId: string, req: EmailRequest): Promise<Email> {
  const m = await loadMaterial(userId, req)
  let problems = ''
  let last: Email | null = null
  const { type } = dayBrief(m, req.day)
  for (let attempt = 0; attempt < attemptsFor(type); attempt++) {
    const res = await openai.chat.completions.create({
      model: EMAIL_MODEL,
      messages: [{ role: 'user', content: prompt(m, req, problems) }],
      response_format: { type: 'json_object' },
      ...samplingParams(EMAIL_MODEL, 0.8),
      ...tokenLimit(EMAIL_MODEL, 1600),
    })
    logAiUsage({ userId, route: 'email-sequence', model: EMAIL_MODEL, usage: res.usage })
    const raw = (JSON.parse(res.choices[0].message.content || '{}') as { email?: Record<string, unknown> }).email ?? {}
    const email: Email = {
      day: req.day,
      type,
      subject_a: cleanText(s(raw.subject_a)),
      subject_b: cleanText(s(raw.subject_b)),
      body: cleanText(s(raw.body)).replace(/\\n/g, '\n'),
      cta: type === 'selling' ? req.sales_page_url || null : null,
    }
    const found = check(email, m, req)
    if (found.length === 0) return email
    last = email
    problems = found.map(p => `- ${p}`).join('\n')
    console.warn(`[email-sequence] day ${req.day} attempt ${attempt + 1} rejected: ${found.join('; ')}`)
  }
  // A selling email with a wrong price is never returned; others fall back to
  // the last draft rather than leaving the day empty.
  if (last && !/peso amounts|real price/.test(problems)) return last
  throw new Error(`Could not write Day ${req.day} with the correct offer details. Please try again.`)
}
