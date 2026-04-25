import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { findBannedWords, buildCorrectionPrompt } from '@/lib/bannedWords'

// POST /api/generate/clarity
// Body: { target_market: string, step: 'problems' | 'mechanisms', problem?: string }
//
// step = 'problems': returns top 10 urgent problems for the target market
// step = 'mechanisms': returns 5 unique mechanism names for the target market + problem

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
      prompt = `I want to create a highly marketable e-book for this target market: "${target_market}"

NOTE: The student's input may include a problem description mixed into the market (e.g. "OFWs who struggle to save money"). If so, extract the core market group and use any mentioned problem as ONE of the options — but still identify the full range of the top 10 most urgent and marketable problems for this market.

Identify the top 10 problems this market is actively trying to solve RIGHT NOW — specifically problems where people are already spending money, searching online, or buying courses, services, or tools.
For each problem, provide:
1. Specific Problem Statement (clear, tangible, not vague)
2. Why It's Urgent (what happens if they don't solve it)
3. Proof of Demand (what people are already buying or searching for)
4. Willingness to Pay Level (Low / Medium / High with explanation)
5. Ease of Selling an e-book Solution (Easy / Moderate / Hard)
6. Common Language or Phrases this market uses when describing this problem
Prioritize problems that are:
* Painful and immediate
* Emotionally charged
* Tied to money, health, relationships, or status
* Solvable through a short, practical e-book
Rank all 10 problems based on profitability and likelihood to convert into sales, not just popularity.

Return a JSON object with this EXACT structure — the key must be "items":
{
  "items": [
    {
      "rank": 1,
      "problem": "Specific Problem Statement",
      "urgency": "What happens if they don't solve it",
      "proof_of_demand": "What people are already buying or searching for",
      "willingness_to_pay": "High",
      "ease_of_selling": "Easy",
      "common_phrases": "phrases they actually use when describing this problem"
    },
    ...
  ]
}

Return exactly 10 items, ranked #1 = most profitable/likely to convert.

LANGUAGE RULES — follow strictly:
1. "problem" field MUST be in English. It is a headline/title that will be displayed prominently — it must be clear, punchy, and marketable in English.
2. "urgency", "proof_of_demand", "buying_behavior" fields should be natural conversational Taglish — the way a real Filipino actually talks. Mix English and Tagalog naturally.
3. "common_phrases" should sound like something a Filipino would literally say or type — natural Taglish is perfect here.
4. NEVER use deep, formal, or literary Tagalog anywhere (e.g. "nahihirapan", "kakulangan", "pangangailangan", "nakatuon"). Use everyday words any Pinoy would say out loud.
${BANNED_WORDS_RULE}`
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

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Clarity generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
