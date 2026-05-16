import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { findBannedWords, buildCorrectionPrompt } from '@/lib/bannedWords'

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
async function researchNiche(targetMarket: string): Promise<string> {
  try {
    const research = await openai.responses.create({
      model: AI_MODEL,
      tools: [{ type: 'web_search' }],
      input: `You are a researcher gathering raw, specific facts about this Filipino market segment so a marketer can build a product for them. Search the web and return a dense fact dump.

Target market: "${targetMarket}"

Find and list:
- Real concerns, frustrations, or money problems people in this group are publicly talking about right now (Reddit r/Philippines, FB groups, news, blog comments)
- Specific programs, benefits, agencies, schemes, or laws relevant to them (use real names — GSIS, SSS, Pag-IBIG, PhilHealth, CSC, DBM, DepEd, DOH, etc. — wherever applicable)
- Recent news, policy changes, or events in the last 12 months that affect them
- Salary tiers, ranks, or income brackets typical for this group, only if publicly documented
- Specific places they hang out online (named Facebook groups, subreddits, Viber/Telegram patterns)
- Things they're already paying for (courses, seminars, apps, services)
- Direct quotes or paraphrased sentiments from forums/comments — what they ACTUALLY say
- Sensitivity flags (politically charged topics, taboo subjects)

Format: dense bullet list. No intro, no conclusion. Cite source domains inline in parens where useful (e.g. "(reddit.com/r/Philippines)"). 400-700 words. Skip anything you can't verify.`,
    })
    const text = (research as { output_text?: string }).output_text ?? ''
    return text.trim()
  } catch (err) {
    console.warn('[clarity] niche research failed, falling back:', err)
    return ''
  }
}

// ── Few-shot exemplar (anchors the model to the depth we want) ───────────────
// Different niche on purpose — we want pattern, not content, to transfer.
const PROBLEM_EXEMPLAR = `EXAMPLE OF THE DEPTH AND SPECIFICITY WE WANT (different niche — DO NOT COPY THE CONTENT, only the depth and shape):

Target market: Filipino OFW nurses in the Middle East

Example item:
{
  "rank": 1,
  "problem": "Naipon pero hindi tumutubo — savings nakatengga sa bank account ng dalawang dekada",
  "urgency": "Karamihan ng OFW nurses sa Saudi at UAE nag-aabono ng family bills sa Pilipinas habang nag-iipon din para sa retirement at sa bahay. Pero ang ipon nakatengga sa ATM ng BDO o BPI Pinas — kinakain ng inflation, walang growth. Pagdating ng end-of-contract, biglang gigising sila na ang 15-year ipon, kasya na lang sa half-renovation ng ancestral house.",
  "proof_of_demand": "Aktibo ang mga private FB groups tulad ng 'Pinoy Nurses in UAE Investing 101' at 'OFW Nurse Money Talks' — usapan tungkol sa Pag-IBIG MP2, mutual funds, COL Financial, at GCash GStocks. Pumipila rin sila sa Philippine Embassy financial literacy sessions tuwing weekend off, at marami nag-e-enroll sa Bo Sanchez TrulyRichClub via remote.",
  "willingness_to_pay": "High",
  "ease_of_selling": "Easy",
  "common_phrases": "Sis, anong investment ba kayang gawin habang nasa duty? Wala akong panahon mag-aral ng stocks."
}

Notice: The problem is a PAIN, not a topic. The urgency names specific places (Saudi, UAE), specific banks (BDO, BPI), and specific consequences. The proof of demand names ACTUAL groups, programs, and brands by name. The quote sounds overheard. THAT is the bar.`

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
      const research = await researchNiche(target_market)
      console.log(`[clarity] research returned ${research.length} chars`)

      const researchBlock = research
        ? `RESEARCH CONTEXT — real facts pulled from the web about this exact niche. USE THESE. Reference specific programs, groups, salary tiers, and behaviors named here.

<research>
${research}
</research>

`
        : ''

      // ── PASS 1: Narrative (workshop-style open prose) ───────────────────
      // Mirrors the manual ChatGPT workshop prompt that produces vivid output.
      // Word choice tuned: "problems and frustrations" (emotional pair),
      // "why they'd like to solve immediately" (motivation story, not consequence).
      const narrativePrompt = `${researchBlock}I'd like to create an e-book that helps ${target_market}.

Help me find the biggest and most urgent problems that this market has — the ones with the highest demand for solutions. Provide the top 10 specific and detailed problems and frustrations they face. Arrange them in order of urgency and demand for a solution.

For each of the 10, write a detailed insight that covers:
- The frustration itself, described the way someone in this market would actually describe it (pain, not topic — never a how-to)
- WHY they'd like to solve this problem immediately — the internal pull, not just the consequence. What's eating them about it right now?
- Specific evidence of demand — named Facebook groups, courses, agencies, programs, products, or behaviors people in THIS niche are already doing about it. Use real names from the research context above.
- One sentence this person would actually say out loud to a peer inside their world — overheard, not staged. Use real terms (agency names, ranks, benefit names) when relevant.

Write in dense, vivid prose. NO bullets, NO numbered fields, NO labels — just narrative. About 100-150 words per problem. Be specific. Name names. Quote what people say.

CRITICAL:
- Pain, never topic. ❌ "How to Budget Your Salary Wisely" ✓ "Sahod hindi sumasapat kahit may pay adjustment".
- Specific to THIS niche only. If a line would read the same for "Filipino professionals" in general, rewrite with niche-specific references.
- Do NOT invent peso figures or statistics. Only use numbers from the research context.
- Natural Taglish — ~70% English, ~30% Tagalog at the word level. Tagalog in emotional beats. Avoid deep/literary Tagalog ("nahihirapan", "kakulangan", "pangangailangan").
${BANNED_WORDS_RULE}

${PROBLEM_EXEMPLAR}

Write the narrative now — 10 problems, ranked #1 = most urgent and most likely to pay for a solution.`

      console.log(`[clarity] running narrative pass`)
      const narrativeRes = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [{ role: 'user', content: narrativePrompt }],
        temperature: 0.8, // Higher temp on narrative pass — we want creative depth
      })
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
      "problem": "The pain statement in one short line (pain, not topic). Pull directly from the narrative — preserve any Taglish or specific terms used.",
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
3. Preserve the Taglish phrasing from the narrative. Do NOT translate to English.
4. Order should match the narrative's ranking (#1 = most urgent / highest demand).
5. Return exactly 10 items.
6. Assign willingness_to_pay and ease_of_selling based on the narrative's signal — high if emotionally urgent + tied to money/health/career; easy if the problem fits a short practical ebook.
${BANNED_WORDS_RULE}`

      console.log(`[clarity] running extraction pass`)
      const extractRes = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [{ role: 'user', content: extractPrompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Low temp — we want faithful extraction, not creativity
      })
      let content = extractRes.choices[0].message.content || '{}'

      // ── Banned word scan on extracted JSON ──────────────────────────────
      const bannedFound = findBannedWords(content)
      if (bannedFound.length > 0) {
        console.warn(`[clarity] Banned words found: ${bannedFound.join(', ')} — running auto-correction`)
        const correctionRes = await openai.chat.completions.create({
          model: AI_MODEL,
          messages: [
            { role: 'user', content: extractPrompt },
            { role: 'assistant', content: content },
            { role: 'user', content: buildCorrectionPrompt(content, bannedFound) },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        })
        content = correctionRes.choices[0].message.content || content
      }

      // ── Parse + server-side re-rank ─────────────────────────────────────
      const parsed = JSON.parse(content) as Record<string, unknown>
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
      const polished = JSON.parse(polishCompletion.choices[0].message.content || '{}')
      return NextResponse.json({ sentence: polished.sentence || '' })
    }

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

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
