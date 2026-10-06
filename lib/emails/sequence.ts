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
interface Chapter { number: number; title: string; win: string; winSteps: string[]; winResult: string }

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
      const steps = Array.isArray(qw.instructions) ? (qw.instructions as unknown[]).map(s).filter(Boolean) : []
      return { number: Number(c.number) || i + 1, title: s(c.title), win: s(qw.name), winSteps: steps, winResult: s(qw.immediate_result) }
    }).filter(c => c.title),
    theirWords: [...(ml.everyday_phrases ?? []), ...(ml.emotional_words ?? [])].map(s).filter(Boolean),
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

// The market's phrases are shared out so each email leans on different ones;
// written in parallel, the seven otherwise all reach for the same line
// ("parang kulang pa rin" appeared in 5 of 7 on 2026-10-06).
function phrasesFor(m: Material, day: number): string[] {
  const w = m.theirWords
  if (w.length === 0) return []
  return [0, 1].map(k => w[((day - 1) * 2 + k) % w.length]).filter((x, i, a) => a.indexOf(x) === i)
}

function dayBrief(m: Material, day: number): { type: 'value' | 'selling'; brief: string } {
  const ch = day <= 4 ? valueChapter(m, day) : null
  // The reader hasn't heard of the ebook until Day 5, so the value emails
  // teach the chapter's idea as the author's own advice. The exercise is
  // given step by step so the email matches what the book says.
  const teach = ch
    ? `Teach ONE idea: the core of "${ch.title}". The reader does not know about the ebook yet, so do NOT mention the book, a chapter, or the method's name; give it as your own advice.${ch.win ? ` End with this small exercise to try today, "${ch.win}", keeping its steps as written:\n${ch.winSteps.map((st, i) => `  ${i + 1}. ${st}`).join('\n')}${ch.winResult ? `\n  They end with: ${ch.winResult}` : ''}` : ''}`
    : 'Teach ONE practical idea that helps with the problem today. Do not mention the ebook yet.'
  switch (day) {
    case 1: return { type: 'value', brief: `DAY 1, VALUE. Open with an everyday moment where this problem shows up in their life, so they feel seen. ${teach}\nNo selling, no link.` }
    case 2: return { type: 'value', brief: `DAY 2, VALUE. Show the root cause they haven't considered, the reason the usual fixes don't stick. ${teach}\nNo selling, no link.` }
    case 3: return { type: 'value', brief: `DAY 3, VALUE. Bust one common belief or piece of advice this market follows that keeps them stuck. ${teach}\nNo selling, no link.` }
    case 4: return { type: 'value', brief: `DAY 4, VALUE. The shift in thinking that makes the way forward obvious. ${teach}\nEnd with one line saying tomorrow you'll share something that pulls it all together. No selling, no link.` }
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
${phrasesFor(m, req.day).length ? `THEIR OWN WORDS FOR TODAY (said in their first-person voice; lean on these, and if you echo one, turn it to speak TO the reader: "Yung ipon ko kulang" becomes "Yung ipon mo, kulang"): ${phrasesFor(m, req.day).map(p => `"${p}"`).join(', ')}` : ''}
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

POINT OF VIEW (strict):
- You are talking TO the reader. Everything about the reader's life is "you": mo, ka, kang, iyo/sayo; for the reader and spouse together, ninyo/kayo. Never ko, ako, namin, kami, I, my or our for the reader's money, fears, family or thoughts.
- WRONG: "Pero yung retirement fund ko parang kulang pa rin, di ba?"  RIGHT: "Pero yung retirement fund mo, parang kulang pa rin, di ba?"
- WRONG: Napapaisip ka: "Hindi pa ako ready."  RIGHT: Napapaisip ka kung ready ka na ba talaga.
- Don't quote the reader's inner thoughts in first person; describe them in "you" form. The only quotes allowed are words someone says out loud to the reader (for example the spouse).
- Use "I"/"ko" only for the author's own actions in this email ("bukas, may ishe-share ako").

LANGUAGE:
- Mostly English, about 70 to 75 percent. Tagalog carries feelings, reactions, family moments and the connectors (kasi, tapos, pero, naman, lang, pala, eh, di ba). English carries the insight, the advice and the steps.
- Each sentence commits to one base language; switch at sentence or clause boundaries. If a sentence sounds natural in English, keep it English. Never force Tagalog in.
- Casual, spoken Tagalog only, the way a 40-year-old Filipino talks over coffee: pwede (not puwede), pag (not kapag), wag, yung, yun, di, pano, lang, sya. No formal or textbook words: never ibahagi/ibabahagi, ipagpaliban, repasuhin, idugtong, upang, subalit, sapagkat, nararapat, kinakailangan, nangangailangan, gayunpaman, samakatuwid. Use the plain word or English instead (share, i-delay, i-review).

VOICE:
- A trusted friend one step ahead, talking to one person. Not a marketer, not a motivational speaker.
- One-line paragraphs, heavy white space, written for a phone screen.
- Show, don't tell: what they see, do, and say. Concrete details from their world, but no invented statistics.
- Never reuse stock lines such as "I need to tell you something personal", "This is my last email about this", "There was a day when everything changed", "I hope this email finds you well", and never use a clock time like 7:43 PM. Find a fresh opening that fits THIS reader.
- Casual forms (yung, di, wag, pag, kasi, naman). No apostrophes on shortened Tagalog words (yan, yung, di, wag, to); English contractions keep theirs. No em dashes. No hype words (unlock, unleash, discover, transform, game-changing, ultimate, amazing).

LENGTH: 200 to 320 words in the body.
SUBJECT LINES: two options for A/B testing, each a complete thought in 2 to 6 words (under 40 characters), curiosity-driven, no clickbait.
SIGN-OFF: "To your (a short aspiration tied to TODAY's topic, not a generic one)," then on the next line "${m.author || '[Your Name]'}".
${problems ? `\nYour previous draft was rejected. Fix these problems:\n${problems}\n` : ''}
Return ONLY JSON:
{ "email": { "day": ${req.day}, "type": "${type}", "subject_a": "...", "subject_b": "...", "body": "use \\n between lines", "cta": ${type === 'selling' ? `"${req.sales_page_url}"` : 'null'} } }`
}

// Textbook Tagalog -> the way people actually type it (Taglish rules).
// Only one-to-one swaps that are safe in any sentence.
const CASUAL: Record<string, string> = {
  puwede: 'pwede', puwedeng: 'pwedeng', kapag: 'pag', huwag: 'wag', iyon: 'yun', iyan: 'yan',
  noong: 'nung', doon: 'dun', nandoon: 'nandun', lamang: 'lang', paano: 'pano', siya: 'sya', niya: 'nya',
}
function casualize(t: string): string {
  return t.replace(/\b(puwedeng|puwede|kapag|huwag|iyon|iyan|noong|nandoon|doon|lamang|paano|siya|niya)\b/gi, w => {
    const c = CASUAL[w.toLowerCase()]
    return w[0] === w[0].toUpperCase() ? c[0].toUpperCase() + c.slice(1) : c
  })
}

function cleanText(t: string): string {
  return casualize(t
    .replace(/\*\*(.+?)\*\*/g, '$1') // pasted into Systeme as plain text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/(^|[\s"(“])[‘'](yan|yung|yun|di|wag|to|nung|pag)\b/gi, '$1$2'))
}

const FORMAL_TAGALOG = /\b(ibahagi|ibabahagi|ibinabahagi|ipagpaliban|ipagpapaliban|repasuhin|rerepasuhin|idugtong|magdudugtong|upang|subalit|datapwat|sapagkat|nararapat|kinakailangan|nangangailangan|gayunpaman|samakatuwid|bagkus|pinanghahawakan|kalakaran|kamalayan)\b/gi

// The reader's life must be "you". Catches the market's first-person phrases
// pasted in as-is ("yung retirement fund ko parang kulang pa rin") and the
// reader's thoughts quoted in first person.
const FIRST_PERSON = /\b([Kk]o|[Kk]ong|[Aa]ko|[Aa]kong|[Kk]ami|[Kk]aming|[Nn]amin|[Nn]aming|I|I'm|I’m|I've|[Mm]y|[Oo]ur)\b/
const READER_THINGS = /\b(fund|ipon|savings|pera|sweldo|sahod|pamilya|asawa|misis|mister|anak|utang|bills?|account|budget|negosyo|buhay|future|retirement|gastos|expenses|trabaho)\s+(ko|namin)\b/i
function povProblems(body: string, m: Material): string[] {
  const out: string[] = []
  const exclusiveWe = body.match(/\b(kami|kaming|namin|naming)\b/i)
  if (exclusiveWe) out.push(`it says "${exclusiveWe[0]}"; the reader's household is "kayo/ninyo"`)
  const possessive = body.match(READER_THINGS)
  if (possessive) out.push(`it says "${possessive[0]}"; the reader's things are "mo/ninyo"`)
  // Names the student chose (ebook, bonuses, chapters) may say "Our"/"My".
  const names = [m.ebookTitle, ...m.bonuses.map(b => b.name), ...m.chapters.map(c => c.title)].map(x => x.toLowerCase())
  for (const q of body.match(/[“"][^”"]{3,}[”"]/g) ?? []) {
    if (names.includes(q.slice(1, -1).trim().toLowerCase())) continue
    if (FIRST_PERSON.test(q)) { out.push(`it quotes the reader's thoughts in first person (${q}); say it in "you" form instead`); break }
  }
  const words = (x: string) => new Set(x.toLowerCase().match(/[a-zñ-]{4,}/g) ?? [])
  for (const sentence of body.split(/(?<=[.!?])\s+|\n+/)) {
    if (!/\b(ko|ako|kong|akong)\b/i.test(sentence)) continue
    const sw = words(sentence)
    const echo = m.theirWords.find(p => /\b(ko|ako|kong|akong)\b/i.test(p) && [...words(p)].filter(w => sw.has(w)).length >= 3)
    if (echo) { out.push(`"${sentence.trim()}" is their own first-person phrase pasted in; turn it to "mo/ka"`); break }
  }
  return out
}

// Hard checks in code; returns the problems, empty when the email passes.
function check(e: Email, m: Material, req: EmailRequest): string[] {
  const problems: string[] = []
  const words = e.body.split(/\s+/).filter(Boolean).length
  if (words < 170) problems.push(`the body is only ${words} words (aim for 200 to 320)`)
  if (words > 380) problems.push(`the body is ${words} words (aim for 200 to 320)`)
  if (!e.subject_a || !e.subject_b) problems.push('it needs two subject lines')
  // Words from the student's own offer (bonus names/descriptions) are theirs to keep.
  const offerText = [m.ebookTitle, ...m.bonuses.flatMap(b => [b.name, b.description])].join(' ').toLowerCase()
  const banned = findBannedWords(`${e.subject_a} ${e.subject_b} ${e.body}`).filter(w => !offerText.includes(w.toLowerCase()))
  if (banned.length) problems.push(`it uses banned words: ${banned.join(', ')}`)
  if (/\b\d{1,2}:\d{2}\b/.test(e.body)) problems.push('it uses a clock time; use a fresh, non-stock detail')
  if (/\[(?!Your Name\])[^\]]+\]/.test(e.body)) problems.push('it left a [placeholder] in brackets')
  problems.push(...povProblems(e.body, m))
  const formal = [...new Set((e.body.match(FORMAL_TAGALOG) ?? []).map(w => w.toLowerCase()))]
  if (formal.length) problems.push(`it uses formal Tagalog: ${formal.join(', ')}. Use the casual word or English`)
  if (e.type === 'value' && /\b(ebook|e-book|chapter|kabanata)\b/i.test(e.body)) problems.push('a value email mentions the ebook or a chapter; the reader has not heard of it yet')
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
