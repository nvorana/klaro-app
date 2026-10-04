import { NextRequest, NextResponse } from 'next/server'
// openaiDirect (not `openai`) for the research call below: it uses the
// Responses API + hosted web_search, neither of which OpenRouter implements.
// This route must keep talking to OpenAI even when AI_PROVIDER=openrouter.
import { openai, openaiDirect, AI_MODEL, modelForRoute, isReasoningModel, samplingParams } from '@/lib/openai'
import { logAiUsage } from '@/lib/aiUsage'
import { findBannedWords, buildCorrectionPrompt } from '@/lib/bannedWords'
import { requireUser } from '@/lib/apiAuth'

// The problems step runs research + brainstorm in parallel, then narrative,
// then extraction. On gpt-5.6-terra that is ~75s end to end, well past what a
// platform default should be trusted with.
export const maxDuration = 300

// ── Model for the "find the biggest problems" step ───────────────────────────
// Moved off gpt-4o on 2026-10-04 after a blind comparison of gpt-4o, gpt-5.5
// and gpt-5.6 sol/terra/luna on the same prompts. gpt-4o was the most generic
// ("Balancing work and family life feels impossible"); terra wrote the
// clearest problem lines, which matter most because the chosen line is saved
// as core_problem and reused by every later module. Cost is ~$0.13 per run vs
// ~$0.10 on gpt-4o. Override with AI_MODEL_ROUTE_CLARITY_PROBLEMS.
//
// Only this step moved. The mechanisms and polish steps below stay on
// AI_MODEL until they get the same side-by-side test.
const PROBLEMS_MODEL = modelForRoute('clarity-problems', 'creative', 'gpt-5.6-terra')

// POST /api/generate/clarity
// Body: { target_market: string, step: 'problems' | 'mechanisms', problem?: string }
//
// step = 'problems': returns top 10 urgent problems for the target market
// step = 'mechanisms': returns 5 unique mechanism names for the target market + problem

// ── Niche research (web search) ──────────────────────────────────────────────
// Before generating problems we run one web search against the target market
// to pull real-world facts the model wouldn't otherwise know (program names,
// agency behaviors, current issues). This closes the ChatGPT-with-browsing
// gap that makes outputs feel generic. Failures are non-fatal — the prompt
// still works without research context.
// Hard-pinned to an OpenAI model id: openaiDirect never routes, so a
// namespaced OpenRouter id (openai/gpt-4o) would be rejected here.
// gpt-5.6-terra since 2026-10-04, alongside PROBLEMS_MODEL above.
const RESEARCH_MODEL = process.env.AI_RESEARCH_MODEL || 'gpt-5.6-terra'

async function researchNiche(targetMarket: string, userId: string | null): Promise<string> {
  try {
    const research = await openaiDirect.responses.create({
      model: RESEARCH_MODEL,
      // Low effort: at the default, terra spent far longer searching for no
      // visible gain in the facts it returned.
      ...(isReasoningModel(RESEARCH_MODEL) ? { reasoning: { effort: 'low' as const } } : {}),
      tools: [{ type: 'web_search' }],
      // Rewritten 2026-10-04. The old prompt was tuned for employee segments
      // (it demanded agencies, laws, salary tiers, policy news). For any other
      // market it dragged the search toward public debates: "Dog owner in the
      // Philippines" came back as LGU pet ordinances, stray-dog policy and
      // tourists complaining about dog owners. Those are problems OTHER people
      // have with the market, not problems the market would pay to solve.
      input: `You are researching a Filipino market so a creator can write a practical ebook that solves a real problem for them. Search the web and return a dense fact dump.

Target market: "${targetMarket}"

Focus on problems these people experience in their OWN lives and want help with. Not complaints other people make about them, and not public debates about them.

Find and list:
- What they ask for help with: recurring questions and struggles in their communities (Reddit, forums, Facebook group posts, Q&A sites, blog comments)
- What they already spend money or time on to fix those problems (products, services, courses, professionals, apps)
- What makes these problems harder or different in the Philippines (costs, climate, availability, local brands and services)
- Typical budgets, income levels, or salary grades, only if relevant and publicly documented
- Programs, agencies, or laws ONLY if they directly affect this group's day-to-day life. Many markets have none. Skip this if so.
- Where they gather online. Name a community only if you actually found it.
- Direct quotes or paraphrased sentiments about their own struggles: what they ACTUALLY say
- Sensitivity flags (politically charged topics, taboo subjects)

Format: dense bullet list. No intro, no conclusion. Cite source domains inline in parens where useful (e.g. "(reddit.com/r/Philippines)"). 400-700 words. Skip anything you can't verify. If a category has nothing relevant for this market, leave it out rather than stretching.`,
    })
    const researchUsage = (research as { usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } }).usage
    logAiUsage({
      userId,
      route: 'clarity',
      // Was AI_MODEL, which mislabelled this call whenever AI_RESEARCH_MODEL
      // was set to something else.
      model: RESEARCH_MODEL,
      usage: researchUsage
        ? {
            prompt_tokens: researchUsage.input_tokens,
            completion_tokens: researchUsage.output_tokens,
            total_tokens: researchUsage.total_tokens,
          }
        : null,
    })
    const text = (research as { output_text?: string }).output_text ?? ''
    return text.trim()
  } catch (err) {
    console.warn('[clarity] niche research failed, falling back:', err)
    return ''
  }
}

// ── Candidate brainstorm (runs in parallel with the research) ────────────────
// Added 2026-10-04. When the research was the only input, it decided WHICH
// problems made the list: one Reddit thread became one "problem", and asking
// the narrative pass to filter with a buyer test did not stop it. Dog owners
// got stray-dog policy and animal-welfare enforcement; working moms got
// "energy-related service disruptions". The model's own knowledge of a market
// (potty training, ticks, picky eaters) is far better at this than one web
// search, so it now proposes the candidates and the research supplies the
// evidence. Runs alongside researchNiche, so it adds no wall-clock time.
// Failures are non-fatal: an empty list falls back to research-only.
async function brainstormProblems(targetMarket: string, userId: string | null): Promise<string[]> {
  try {
    const res = await openai.chat.completions.create({
      model: PROBLEMS_MODEL,
      ...samplingParams(PROBLEMS_MODEL, 0.7),
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: `Target market: "${targetMarket}"

List 15 problems people in this market personally struggle with in their own day-to-day life and would pay for help solving. Think like someone who has been part of this market for years, not like a journalist.

BUYER TEST: every item must pass all three.
1. They personally experience it. Not a problem other people have with them. Not a public, policy, or social issue.
2. A practical, beginner-friendly ebook could solve it or make it much easier.
3. People in this market already spend money, time, or effort trying to fix it.

Spread across different kinds of problems (health, money, time, skills, relationships, results, daily routines). Be concrete: "Tomato plants keep dying in the summer heat", not "Gardening challenges".

Return JSON: { "candidates": ["plain problem statement, max 12 words", "..."] }` }],
    })
    logAiUsage({ userId, route: 'clarity', model: PROBLEMS_MODEL, usage: res.usage })
    const parsed = JSON.parse(res.choices[0].message.content || '{}') as { candidates?: unknown }
    return Array.isArray(parsed.candidates)
      ? parsed.candidates.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).slice(0, 20)
      : []
  } catch (err) {
    console.warn('[clarity] candidate brainstorm failed, falling back to research only:', err)
    return []
  }
}

// ── House style the prompts ask for but cannot guarantee ────────────────────
// gpt-4o still emits em dashes and 'yan / 'yung often enough to matter, so
// enforce both in code on every string the student will see.
function enforceHouseStyle(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/\s*—\s*/g, ', ')
      .replace(/(^|[\s"(])[''](yan|yung|yun|di|wag|to|nung|pag)\b/gi, '$1$2')
  }
  if (Array.isArray(value)) return value.map(enforceHouseStyle)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, enforceHouseStyle(v)]))
  }
  return value
}

// ── Few-shot exemplar (anchors the model to the depth we want) ───────────────
// Different niche on purpose — we want pattern, not content, to transfer.
const PROBLEM_EXEMPLAR = `EXAMPLE OF THE DEPTH AND SPECIFICITY WE WANT (different niche — DO NOT COPY THE CONTENT, only the depth and shape):

Target market: Filipino OFW nurses in the Middle East

Example item:
{
  "rank": 1,
  "problem": "Savings sitting idle in the bank for years, eaten by inflation",
  "urgency": "Karamihan ng OFW nurses sa Saudi at UAE nag-aabono ng family bills sa Pilipinas habang nag-iipon din para sa retirement at sa bahay. Pero ang ipon nakatengga sa ATM ng BDO o BPI Pinas, kinakain ng inflation, walang growth. Pagdating ng end-of-contract, biglang gigising sila na ang 15-year ipon, kasya na lang sa half-renovation ng ancestral house.",
  "proof_of_demand": "OFW and nurse investing groups on Facebook are full of the same questions about Pag-IBIG MP2, mutual funds, COL Financial, at GCash GStocks. Pumipila rin sila sa Philippine Embassy financial literacy sessions tuwing weekend off, at marami nag-e-enroll sa Bo Sanchez TrulyRichClub via remote.",
  "willingness_to_pay": "High",
  "ease_of_selling": "Easy",
  "common_phrases": "Sis, anong investment ba kayang gawin habang nasa duty? Wala akong panahon mag-aral ng stocks."
}

Notice: The problem line says plainly WHAT the problem is, so anyone gets it in 3 seconds. The raw feeling lives in the quote, not in the problem line. The urgency names specific places (Saudi, UAE), specific banks (BDO, BPI), and specific consequences. The proof of demand names real programs and brands, and describes the groups instead of inventing group names. The quote sounds overheard. THAT is the bar.`

// ── Banned word rules injected into every prompt ─────────────────────────────
const BANNED_WORDS_RULE = `
LANGUAGE RULES — MANDATORY:
Never use these words or phrases in any output:
HARD BAN: unlock, unleash, discover, transform your life, revolutionize, ultimate guide, game-changing, next-level, powerful secrets, tap into, harness, ignite, amplify, supercharge
SOFT BAN (avoid unless truly necessary): maximize, optimize, elevate, breakthrough, leverage

Write in market-native language — practical, conversational, like a knowledgeable friend talking to another Filipino. NOT a TED Talk. NOT a LinkedIn post.
❌ AI style: "Unlock your full potential with this powerful method."
✅ Market style: "Ganito mo magagawa ito… kahit busy ka pa."
`

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser()
    if (!auth.ok) return auth.response

    const { target_market, step, problem, current_solution } = await request.json()

    if (!target_market || !step) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Audience is dynamic — defined by the creator's target_market input.
    // No employment-status gate; the creator decides who their ebook serves.

    let prompt = ''

    if (step === 'problems') {
      // ── Two-pass: narrative-then-extract ──────────────────────────────────
      // Pass 1 generates open prose with full creative bandwidth (no JSON,
      // no field schema, no length caps). This is what makes ChatGPT's manual
      // workshop prompt produce vivid output — the model isn't splitting
      // attention between content and structure.
      // Pass 2 extracts the prose into the JSON our UI expects, with strict
      // "preserve all specifics, add no new facts" rules.

      console.log(`[clarity] problems step — running niche research for "${target_market}"`)
      const [research, candidates] = await Promise.all([
        researchNiche(target_market, auth.user.id),
        brainstormProblems(target_market, auth.user.id),
      ])
      console.log(`[clarity] research returned ${research.length} chars, ${candidates.length} candidates`)

      const candidatesBlock = candidates.length
        ? `CANDIDATE PROBLEMS: from long experience with this market. Every one already passes the buyer test below.

${candidates.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Build your top 10 mainly from these candidates, and use the research as evidence for them. You may swap in a problem that only appears in the research if it clearly passes the buyer test.

`
        : ''

      const researchBlock = research
        ? `RESEARCH CONTEXT: real facts from a quick web search about this niche. Use them as EVIDENCE and for specific details. This is only what one search surfaced. It is NOT the full list of this market's problems, so do not build your list only from it, and skip anything in it that fails the buyer test below.

<research>
${research}
</research>

`
        : ''

      // ── PASS 1: Narrative (workshop-style open prose) ───────────────────
      // Mirrors the manual ChatGPT workshop prompt that produces vivid output.
      // Word choice tuned: "problems and frustrations" (emotional pair),
      // "why they'd like to solve immediately" (motivation story, not consequence).
      const narrativePrompt = `${candidatesBlock}${researchBlock}I'd like to create an e-book that helps ${target_market}.

Help me find the biggest and most urgent problems that this market has, the ones with the highest demand for solutions. Provide the top 10 specific and detailed problems and frustrations they face. Arrange them in order of urgency and demand for a solution.

Start from your own knowledge of what people in this market go through day to day. Then use the research to add real evidence and specifics.

BUYER TEST: only include a problem if ALL three are true.
1. People in this market personally experience it in their own life. Not a problem other people have with them. Not a public, policy, or social issue about them.
2. A practical, beginner-friendly ebook could solve it or make it much easier.
3. People in this market already spend money, time, or effort trying to fix it.
Drop anything that fails, even if it appears in the research.

Cover a range of different kinds of problems (for example health, money, time, skills, relationships, results). Not several versions of the same worry.

For each of the 10, write a detailed insight that covers:
- The problem stated plainly: what it is, in words a reader understands in 3 seconds
- The frustration itself, described the way someone in this market would actually describe it (pain, not topic, never a how-to)
- WHY they'd like to solve this problem immediately: the internal pull, not just the consequence. What's eating them about it right now?
- Specific evidence of demand: what people in THIS niche are already doing or buying about it. Name groups, courses, products, programs, or brands only if they appear in the research or you are certain they exist. Otherwise describe the behavior without a name. Never invent names.
- One sentence this person would actually say out loud to a peer inside their world. Overheard, not staged. Use real terms from their world when relevant.

Write in dense, vivid prose. NO bullets, NO numbered fields, NO labels — just narrative. About 100-150 words per problem. Be specific. Name names. Quote what people say.

CRITICAL:
- Pain, never topic. ❌ "How to Budget Your Salary Wisely" ✓ "Sahod hindi sumasapat kahit may pay adjustment".
- Specific to THIS niche only. If a line would read the same for "Filipino professionals" in general, rewrite with niche-specific references.
- Do NOT invent peso figures or statistics. Only use numbers from the research context.
- Natural Taglish — ~70% English, ~30% Tagalog at the word level. Tagalog in emotional beats. Avoid deep/literary Tagalog ("nahihirapan", "kakulangan", "pangangailangan").
- No em dashes. No apostrophes on shortened Tagalog words: write yan, yung, di, wag, to (not 'yan, 'yung, 'di, 'wag, 'to).
${BANNED_WORDS_RULE}

${PROBLEM_EXEMPLAR}

Write the narrative now — 10 problems, ranked #1 = most urgent and most likely to pay for a solution.`

      console.log(`[clarity] running narrative pass`)
      const narrativeRes = await openai.chat.completions.create({
        model: PROBLEMS_MODEL,
        messages: [{ role: 'user', content: narrativePrompt }],
        ...samplingParams(PROBLEMS_MODEL, 0.8), // higher temp on a classic model: creative depth
      })
      logAiUsage({ userId: auth.user.id, route: 'clarity', model: PROBLEMS_MODEL, usage: narrativeRes.usage })
      const narrative = narrativeRes.choices[0].message.content || ''
      console.log(`[clarity] narrative returned ${narrative.length} chars`)

      // ── PASS 2: Extract narrative into JSON ─────────────────────────────
      // Pure structuring pass. Strict instructions to preserve specifics and
      // add NO new content. Low temperature for deterministic extraction.
      const extractPrompt = `Below is a narrative analysis of the top 10 problems for "${target_market}". Your job is to extract it into structured JSON for a product UI.

<narrative>
${narrative}
</narrative>

Extract into this EXACT JSON shape — the key must be "items":
{
  "items": [
    {
      "rank": 1,
      "problem": "A plain statement of WHAT the problem is, max 12 words, that a reader understands at a glance (e.g. 'Savings sitting idle in the bank, eaten by inflation'). English or light Taglish. Pain, not topic. It is NOT a quote and must not repeat common_phrases. This line is saved as the student's core problem and reused by every later module, so it must make sense on its own.",
      "urgency": "2-3 sentences pulled from the narrative explaining why they want to solve it now. Preserve all named programs, agencies, salary tiers, situations.",
      "proof_of_demand": "2-3 sentences pulled from the narrative naming what they're already doing about it — specific groups, courses, products, behaviors.",
      "willingness_to_pay": "Low | Medium | High",
      "ease_of_selling": "Easy | Moderate | Hard",
      "common_phrases": "The one overheard-quote sentence from the narrative. Preserve it word-for-word if possible."
    }
  ]
}

EXTRACTION RULES — strict:
1. Use ONLY content from the narrative. Do NOT invent new facts, agencies, numbers, or quotes. If the narrative didn't mention it, don't add it.
2. Preserve all specifics — named agencies, FB groups, salary tiers, benefit names, programs, brand names. Do not generalize.
3. Preserve the Taglish phrasing from the narrative in urgency, proof_of_demand and common_phrases. Do NOT translate those to English. (The problem line is the exception: it must be a plain statement, see above.)
4. Order should match the narrative's ranking (#1 = most urgent / highest demand).
5. Return exactly 10 items.
6. willingness_to_pay:
   - High: it costs them money, income, or health right now AND people in this market already pay to fix it
   - Medium: a real ongoing struggle, but people mostly try free fixes
   - Low: an annoyance, or something they rarely spend on
   Being emotional or health-related alone does NOT make it High.
7. ease_of_selling:
   - Easy: a short practical ebook can clearly solve it
   - Moderate: an ebook helps, but it also needs practice, time, or other help
   - Hard: an ebook can barely help (needs a professional, a law change, or someone else to change)
8. No em dashes anywhere. No apostrophes on shortened Tagalog words (yan, yung, di, wag, to).
${BANNED_WORDS_RULE}`

      console.log(`[clarity] running extraction pass`)
      const extractRes = await openai.chat.completions.create({
        model: PROBLEMS_MODEL,
        messages: [{ role: 'user', content: extractPrompt }],
        response_format: { type: 'json_object' },
        ...samplingParams(PROBLEMS_MODEL, 0.3), // low temp on a classic model: faithful extraction
      })
      logAiUsage({ userId: auth.user.id, route: 'clarity', model: PROBLEMS_MODEL, usage: extractRes.usage })
      let content = extractRes.choices[0].message.content || '{}'

      // ── Banned word scan on extracted JSON ──────────────────────────────
      const bannedFound = findBannedWords(content)
      if (bannedFound.length > 0) {
        console.warn(`[clarity] Banned words found: ${bannedFound.join(', ')} — running auto-correction`)
        const correctionRes = await openai.chat.completions.create({
          model: PROBLEMS_MODEL,
          messages: [
            { role: 'user', content: extractPrompt },
            { role: 'assistant', content: content },
            { role: 'user', content: buildCorrectionPrompt(content, bannedFound) },
          ],
          response_format: { type: 'json_object' },
          ...samplingParams(PROBLEMS_MODEL, 0.3),
        })
        logAiUsage({ userId: auth.user.id, route: 'clarity', model: PROBLEMS_MODEL, usage: correctionRes.usage })
        content = correctionRes.choices[0].message.content || content
      }

      // ── Parse + server-side re-rank ─────────────────────────────────────
      const parsed = enforceHouseStyle(JSON.parse(content)) as Record<string, unknown>
      let items: unknown[] = Array.isArray(parsed.items) ? parsed.items : []
      if (items.length === 0) {
        // Defensive: try any other array key in case extractor used a different name
        for (const v of Object.values(parsed)) {
          if (Array.isArray(v)) { items = v; break }
        }
      }

      type ProblemItem = {
        rank?: number
        willingness_to_pay?: string
        ease_of_selling?: string
        [key: string]: unknown
      }
      const score = (item: ProblemItem): number => {
        const wtp = (item.willingness_to_pay ?? '').toString().toLowerCase()
        const ease = (item.ease_of_selling ?? '').toString().toLowerCase()
        const wtpScore = wtp.startsWith('high') ? 3 : wtp.startsWith('low') ? 1 : 2
        const easeScore = ease.startsWith('easy') ? 3 : ease.startsWith('hard') ? 1 : 2
        return wtpScore * 10 + easeScore
      }
      const reranked = (items as ProblemItem[])
        .map((item, originalIndex) => ({ item, originalIndex }))
        .sort((a, b) => {
          const diff = score(b.item) - score(a.item)
          if (diff !== 0) return diff
          const aRank = typeof a.item.rank === 'number' ? a.item.rank : a.originalIndex + 1
          const bRank = typeof b.item.rank === 'number' ? b.item.rank : b.originalIndex + 1
          return aRank - bRank
        })
        .map(({ item }, i) => ({ ...item, rank: i + 1 }))

      return NextResponse.json({ data: reranked })
    }

    if (step === 'mechanisms') {
      if (!problem) {
        return NextResponse.json({ error: 'Missing problem for mechanism generation' }, { status: 400 })
      }

      const genericSolutionContext = current_solution
        ? `Current common/generic solution people use: ${current_solution}`
        : `Current common/generic solution: (not specified — assume the most widely-used conventional approach for this problem)`

      prompt = `Act as a world-class direct response copywriter and best-selling non-fiction author.

Your task is to create 5 powerful, marketable Unique Mechanisms for a non-fiction digital product.

INPUT:
- Target Market: ${target_market}
- Problem: ${problem}
- ${genericSolutionContext}

INSTRUCTIONS FOR EACH MECHANISM:
1. First, identify WHY the common solution is flawed, ineffective, or incomplete. Be specific and emotionally sharp.
2. Introduce a NEW BELIEF that challenges what most people think about this problem.
   Use this structure: "Most people think [X]… but the truth is [Y]."
3. Create a UNIQUE MECHANISM that:
   - Feels new and different (NOT a rewording of common advice)
   - Is easy to understand
   - Sounds like a named system, method, or framework
4. Give the mechanism a NAME that is:
   - Memorable and simple
   - Marketable (usable in ads, e-book titles, hooks)
   - Specific enough to feel proprietary
5. Explain HOW the mechanism works in exactly 3–5 simple, actionable steps
6. Create exactly 3 "aha statements" — short, quotable, emotionally punchy insights
7. Write a short positioning statement: "This is not about [old way]… this is about [new way]."

QUALITY FILTER — each mechanism must pass ALL of these:
- Is this NEW? (not a slight rewording of common advice)
- Is this MEMORABLE? (would someone repeat this at dinner?)
- Is this MARKETABLE? (could this be a paid product title?)
If it fails any test, generate a better one.

Return a JSON object with this EXACT structure — the key must be "items":
{
  "items": [
    {
      "name": "The [Memorable Name] Method/System/Framework",
      "old_way_fails": "Specific reason why the common solution is flawed or incomplete",
      "new_belief": "Most people think [X]… but the truth is [Y].",
      "core_idea": "What makes this mechanism fundamentally different",
      "steps": ["Step 1 — specific action", "Step 2 — specific action", "Step 3 — specific action"],
      "aha_statements": ["Punchy insight 1", "Punchy insight 2", "Punchy insight 3"],
      "positioning_line": "This is not about [old way]… this is about [new way]."
    }
  ]
}

Return exactly 5 items. Make them simple, emotionally compelling, and easy to explain to a beginner.

LANGUAGE RULES — follow strictly:
1. "name" and "positioning_line" MUST be in English. These are product/brand names and marketing statements — they must be universally marketable.
2. All other fields (old_way_fails, new_belief, steps, aha_statements) should be written in natural, conversational Taglish — the way a real Filipino actually talks. Mix English and Tagalog naturally, like how someone would say it in a casual conversation.
3. NEVER use deep, formal, or literary Tagalog (e.g. "kapansin-pansin", "pagkakataon", "pangangailangan", "nakatuon", "natutumbok"). Use everyday Filipino words that any Pinoy would say out loud.
4. A good test: if a Filipino would feel awkward saying it out loud in conversation, rewrite it.
${BANNED_WORDS_RULE}`
    }

    if (step === 'polish') {
      if (!problem) return NextResponse.json({ error: 'Missing problem' }, { status: 400 })
      prompt = `You are a professional copywriter. A student has built a clarity sentence from three components:
- Target Market: ${target_market}
- Core Problem: ${problem}
- Unique Mechanism: ${current_solution}

Write ONE clean, polished clarity sentence using this format:
"I help [TARGET MARKET] who [PROBLEM] through [MECHANISM]."

STRICT RULES:
1. Remove ALL redundancy — if the target market already mentions the problem (e.g. "OFWs who struggle to save money"), do NOT repeat the problem in the second clause.
2. Fix grammar — the sentence must read naturally in English.
3. The market should describe WHO they are (demographic/group), not their problem.
4. The problem clause should start with "who struggle with..." or "who want to..." — pick the most natural phrasing.
5. Keep it under 25 words total.
6. Do NOT use any banned marketing language (unlock, unleash, transform, revolutionize, etc.)

Return JSON: { "sentence": "..." }`

      const polishCompletion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      })
      logAiUsage({ userId: auth.user.id, route: 'clarity', model: AI_MODEL, usage: polishCompletion.usage })
      const polished = JSON.parse(polishCompletion.choices[0].message.content || '{}')
      return NextResponse.json({ sentence: polished.sentence || '' })
    }

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })
    logAiUsage({ userId: auth.user.id, route: 'clarity', model: AI_MODEL, usage: completion.usage })

    let content = completion.choices[0].message.content || '{}'

    // ── Post-generation banned word scan ──────────────────────────────────────
    // If the AI slipped any banned words into its output, auto-correct before
    // returning to the user. One silent correction pass — invisible to the user.
    const bannedFound = findBannedWords(content)
    if (bannedFound.length > 0) {
      console.warn(`[clarity] Banned words found: ${bannedFound.join(', ')} — running auto-correction`)
      const correctionCompletion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'user', content: prompt },
          { role: 'assistant', content: content },
          { role: 'user', content: buildCorrectionPrompt(content, bannedFound) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      })
      logAiUsage({ userId: auth.user.id, route: 'clarity', model: AI_MODEL, usage: correctionCompletion.usage })
      content = correctionCompletion.choices[0].message.content || content
    }

    const parsed = JSON.parse(content)

    // OpenAI json_object format always wraps in an object.
    // Prompt explicitly asks for { "items": [...] } — check that key first,
    // then fall back to any other known key, then scan all values recursively.
    let result: unknown[]
    if (Array.isArray(parsed)) {
      result = parsed
    } else {
      const p = parsed as Record<string, unknown>
      const knownKey =
        p.items ??
        p.problems ??
        p.mechanisms ??
        p.data ??
        p.results ??
        p.solutions ??
        p.list
      if (Array.isArray(knownKey)) {
        result = knownKey
      } else {
        // Recursively find the first array anywhere in the object (handles one level of nesting)
        let found: unknown[] | undefined
        for (const val of Object.values(p)) {
          if (Array.isArray(val)) { found = val; break }
          if (val && typeof val === 'object') {
            const inner = Object.values(val as Record<string, unknown>).find(v => Array.isArray(v))
            if (Array.isArray(inner)) { found = inner; break }
          }
        }
        result = found ?? []
      }
    }

    // ── Server-side re-rank for problems step ────────────────────────────────
    // The AI fills willingness_to_pay + ease_of_selling badges and ALSO assigns
    // a rank, but the two are independent decisions in the model's head — so
    // High+Easy items sometimes ended up ranked below Medium+Moderate items.
    // We deterministically re-rank from the badges so what the user sees is
    // logically consistent: the displayed badges actually drive the order.
    //   WTP weighted heavier than Ease since profitability is primarily about
    //   revenue-per-customer (WTP), with selling ease as the secondary lever.
    //   AI's original rank acts as a stable tiebreaker within score buckets.
    if (step === 'problems' && Array.isArray(result)) {
      type ProblemItem = {
        rank?: number
        willingness_to_pay?: string
        ease_of_selling?: string
        [key: string]: unknown
      }
      const score = (item: ProblemItem): number => {
        const wtp = (item.willingness_to_pay ?? '').toString().toLowerCase()
        const ease = (item.ease_of_selling ?? '').toString().toLowerCase()
        const wtpScore = wtp.startsWith('high') ? 3 : wtp.startsWith('low') ? 1 : 2
        const easeScore = ease.startsWith('easy') ? 3 : ease.startsWith('hard') ? 1 : 2
        return wtpScore * 10 + easeScore
      }
      result = (result as ProblemItem[])
        .map((item, originalIndex) => ({ item, originalIndex }))
        .sort((a, b) => {
          const diff = score(b.item) - score(a.item)
          if (diff !== 0) return diff
          // Tiebreaker — preserve AI's preference within equal-score buckets.
          const aRank = typeof a.item.rank === 'number' ? a.item.rank : a.originalIndex + 1
          const bRank = typeof b.item.rank === 'number' ? b.item.rank : b.originalIndex + 1
          return aRank - bRank
        })
        .map(({ item }, i) => ({ ...item, rank: i + 1 }))
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Clarity generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
