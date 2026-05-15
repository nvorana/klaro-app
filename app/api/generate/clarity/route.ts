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
      // Run web-search research in parallel with prompt assembly. ~5-10s call.
      console.log(`[clarity] problems step — running niche research for "${target_market}"`)
      const research = await researchNiche(target_market)
      console.log(`[clarity] research returned ${research.length} chars`)
      const researchBlock = research
        ? `RESEARCH CONTEXT — real facts pulled from the web about this exact niche. USE THESE in your output. Reference specific programs, groups, and behaviors named here. Do not invent figures that aren't in this block.

<research>
${research}
</research>

`
        : ''

      prompt = `${researchBlock}You are a senior direct-response strategist who has studied this exact Filipino niche deeply: "${target_market}"

NOTE: The student's input may include a problem description mixed into the market (e.g. "OFWs who struggle to save money"). If so, extract the core market group and use any mentioned problem as ONE of the options — but still identify the full range of the top 10 most urgent and marketable problems for this market.

Identify the top 10 ACHES this market lives with RIGHT NOW — the kind of problems where people are already losing sleep, spending money, searching online, joining Facebook groups, or buying courses to fix.

CRITICAL FRAMING — read carefully:
- A "problem" is a PAIN, not a TOPIC. ❌ "How to Budget Your Salary Wisely" is a chapter title. ✓ "Sahod hindi sumasapat kahit dalawang trabaho" is a pain. Never frame the problem as a how-to or a solution.
- Be specific to THIS niche. Name real agencies, benefits, ranks, situations, programs, salary tiers, or groups that exist inside this market's actual world. If you would write the same line for "Filipino professionals" in general, you haven't gone deep enough — rewrite.
- Concrete > generic. "Naghahanap ng info online" is generic. "Nagpapalitan ng GSIS MPL Flex computation sa private Viber group" is concrete.

For each of the 10 problems, fill out:
1. "problem" — the ACHE itself, written as a real Filipino pain in one short line (mostly English with natural Taglish if useful). Do NOT phrase it as a how-to or a solution.
2. "urgency" — 2 to 3 sentences. Must include at least ONE concrete reference: a benefit name (GSIS, SSS, Pag-IBIG MP2, PhilHealth, MPL), an agency (CSC, DBM, COA), a salary grade or amount, a specific situation, or a named life event. Generic consequences are not allowed.
3. "proof_of_demand" — 2 to 3 sentences. Must name something specific people in THIS niche are already doing about this: a Facebook group name pattern, a specific course or seminar, a Shopee/Lazada product type, a Viber/Telegram group behavior, a sari-sari piece of word-of-mouth. "Marami nang nag-search online" is BANNED — be specific.
4. "willingness_to_pay" — Low / Medium / High
5. "ease_of_selling" — Easy / Moderate / Hard
6. "common_phrases" — ONE sentence this person would actually say out loud to a co-worker or friend INSIDE this niche. Use real names of agencies, ranks, benefits, or situations if relevant. It should sound like overheard talk, not a generated quote. Generic "Paano ba mag-budget?" is BANNED.

Prioritize problems that are:
* Painful and immediate
* Emotionally charged
* Tied to money, health, family, career, or status
* Solvable through a short, practical e-book

Rank all 10 problems based on profitability and likelihood to convert into sales.

Return a JSON object with this EXACT structure — the key must be "items":
{
  "items": [
    {
      "rank": 1,
      "problem": "Pain statement (not a how-to)",
      "urgency": "2-3 sentences with at least one concrete reference (agency, benefit, salary tier, situation).",
      "proof_of_demand": "2-3 sentences naming what people in this exact niche are already doing — specific groups, courses, products, or word-of-mouth.",
      "willingness_to_pay": "High",
      "ease_of_selling": "Easy",
      "common_phrases": "One overheard-sounding sentence this person would say to a peer inside their world, with niche-specific words."
    }
  ]
}

Return exactly 10 items, ranked #1 = most profitable/likely to convert.

LANGUAGE RULES — follow strictly:
1. "problem" field is the headline. Mostly English, marketable, punchy. Tagalog is OK if it lands harder (e.g. "Sahod hindi sumasapat").
2. "urgency" and "proof_of_demand" — natural conversational Taglish with concrete niche references baked in. Aim for ~70% English / ~30% Tagalog at the word level. Tagalog appears in emotional beats and reactions, not as the carrying language.
3. "common_phrases" — sounds like a real Filipino in this niche talking out loud. Use names of agencies/ranks/benefits if relevant.
4. NEVER use deep/literary Tagalog (e.g. "nahihirapan", "kakulangan", "pangangailangan", "nakatuon"). Use everyday words.
5. Do NOT invent fake statistics or fake peso figures. If you reference a real one, only use figures that are publicly well-known or appear in the RESEARCH CONTEXT above. Otherwise reference the AGENCY or PROGRAM by name without making up numbers.
${BANNED_WORDS_RULE}

${PROBLEM_EXEMPLAR}`
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
