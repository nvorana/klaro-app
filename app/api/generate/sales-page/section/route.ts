import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { getMarketLanguageHintForUser } from '@/lib/marketLanguage'

export const maxDuration = 60

// CHILLYONARYO section keys
export type SectionKey =
  | 'headline'
  | 'hook'
  | 'analogy'
  | 'pain'
  | 'principle'
  | 'offer_intro'
  | 'objections'
  | 'bonuses'
  | 'price'
  | 'cta'

interface Bonus {
  bonus_name: string
  description: string
  format: string
  value_peso: number
  objection_addressed: string
}

// Per-section prompts following the CHILLYONARYO SALES COPY COMMAND MAP
function buildPrompt(
  section: SectionKey,
  data: {
    target_market: string
    problem: string
    mechanism: string
    ebook_title: string
    bonuses: Bonus[]
    total_value: number
    selling_price: number
    guarantee: string
  }
): string {
  const { target_market, problem, mechanism, ebook_title, bonuses, total_value, selling_price, guarantee } = data

  const clarity = `I help ${target_market} who struggle with ${problem} through ${mechanism}.`
  const bonusList = bonuses
    .map((b, i) => `Bonus ${i + 1}: "${b.bonus_name}" — ${b.description} (Value: ₱${b.value_peso.toLocaleString()})`)
    .join('\n')

  const styleRules = `
STYLE RULES (apply strictly):
- 70% English, 30% Tagalog. Weave Tagalog phrases naturally where they land harder.
- Short, rhythmic sentences. 1-2 sentences per paragraph in emotional sections.
- Conversational, human tone. Like talking to a friend over coffee, not a boardroom pitch.
- No emojis. No em dash (use comma or period instead). No hype or fake urgency.
- Filipino-specific references: Grab, GCash, Starbucks, EDSA, BDO, BPI, jeepney, 15/30 salary cycle, BPO shifts, MRT, Netflix, Shopee.
- 4U Formula on hooks and CTAs: Useful, Urgent, Unique, Ultra-Specific.
`

  const context = `
OFFER CONTEXT:
Clarity Sentence: "${clarity}"
Ebook Title: "${ebook_title}"
Bonuses:
${bonusList}
Total Value: ₱${total_value.toLocaleString()}
Selling Price: ₱${selling_price.toLocaleString()}
Guarantee: ${guarantee}
`

  const sectionPrompts: Record<SectionKey, string> = {
    headline: `
${styleRules}
${context}

Write SECTION 1: HEADLINE using the 4U Formula for this sales page.

The headline is the bold title at the very top of the sales page. It is the FIRST thing the reader sees. It must:

Apply all 4 of the 4Us:
- USEFUL: State a clear, concrete benefit the reader gets
- URGENT: Include a timeframe or "why now" element (e.g., "in 60 days", "starting this week", "while this window is open")
- UNIQUE: Position it against what they have already tried or what everyone else is saying
- ULTRA-SPECIFIC: Use a real number, peso amount, or measurable result — specificity builds credibility

Structure: Two lines maximum.
- Line 1: The main outcome statement (under 20 words)
- Line 2: A shorter sub-headline that removes the biggest objection or adds the unique angle (under 15 words)

Proven headline patterns to choose from:
- "How [Target Market] Can [Specific Outcome] in [Timeframe], Without [Common Frustration]"
- "In Just [Timeframe], [Specific Outcome], Even If [Common Objection]"
- "[Specific Result] in [Timeframe]. No [Frustrating Thing]. No [Other Frustration]. Just [The Real Outcome]."

Rules:
- NOT a question
- No em dash (never use —), use a comma or period instead
- No hype words like "amazing", "revolutionary", "life-changing"
- Ultra-specific to ${target_market} struggling with ${problem}
- The timeframe or number must feel realistic, not exaggerated

Return ONLY a valid JSON object with this exact structure, no other text:
{
  "options": [
    "Main headline line 1\\nSub-headline line 2",
    "Main headline line 1\\nSub-headline line 2",
    "Main headline line 1\\nSub-headline line 2"
  ],
  "recommended": 0,
  "recommended_reason": "One sentence explaining why this option is the strongest for ${target_market}, specifically which of the 4Us it nails best."
}

The "recommended" field is the 0-based index (0, 1, or 2) of the option that hits all 4Us most directly.
Each option in "options" is two lines separated by \\n — the first line is the main headline, the second is the sub-headline.
`,

    hook: `
${styleRules}
${context}

Write SECTION 1: HOOK for this sales page.

This is the emotional, curiosity-driven opener that stops the scroll. It must:
- Hit at least 3 of the 4Us: Useful, Urgent, Unique, Ultra-Specific
- Open with a bold statement or striking question that immediately resonates with ${target_market}
- Be 3-5 short paragraphs
- Pull the reader in by naming exactly what they feel but haven't said out loud
- End with a sentence that makes them desperate to keep reading

Return only the hook copy. No labels or section titles. Plain text.
`,

    analogy: `
${styleRules}
${context}

Write SECTION 2: ANALOGY / RELATABLE STORY for this sales page.

Use a real-life Filipino story or analogy to make the message simple and relatable. Examples: the feeling of watching your salary disappear before the next 15th, waiting in EDSA traffic thinking about the day job, the BPO night shift that never leads anywhere. The analogy should:
- Be instantly recognizable to ${target_market}
- Show the contrast between their current situation and what is possible
- Be 3-4 short paragraphs
- Feel warm and human, not preachy

Return only the analogy copy. No labels. Plain text.
`,

    pain: `
${styleRules}
${context}

Write SECTION 3: PAIN & FRUSTRATION for this sales page.

Agitate the problem deeply so the reader feels completely seen and understood. This section should:
- Open with a scene-setting paragraph that puts the reader inside their daily struggle
- Use "you" language throughout
- Describe the emotional cost: the exhaustion, the invisible feeling, the quiet frustration
- Show they are not failing because of laziness but because the situation itself is hard
- Be 4-6 short punchy paragraphs
- End with a line that opens the door: something is about to change

Return only the pain copy. No labels. Plain text.
`,

    principle: `
${styleRules}
${context}

Write SECTION 4: PRINCIPLE / TRUTH REVEAL for this sales page.

Deliver the core realization that changes how the reader sees their situation. This should:
- Open with a bold one-sentence truth or principle that reframes the problem
- Make the reader think "I never thought about it that way"
- Explain simply why their previous attempts failed without shaming them
- Build up logically to why "${mechanism}" is the real solution
- Be 3-4 paragraphs, calm and confident in tone

Return only the principle copy. No labels. Plain text.
`,

    offer_intro: `
${styleRules}
${context}

Write SECTION 5: INTRODUCE THE OFFER for this sales page.

Present "${ebook_title}" as the answer. This section should:
- Name the product clearly and who it is for
- Explain what it does in plain, relief-inducing language (not hype)
- Emphasize what makes it different from what they have already tried
- List 3-5 short bullet points of what the reader will be able to do after going through it
- Feel like a relief to discover, not a sales pitch to resist
- Be 3-4 paragraphs plus bullet points

Return only the offer intro copy. No labels. Plain text.
`,

    objections: `
${styleRules}
${context}

Write SECTION 6: OBJECTION HANDLING for this sales page.

Address the specific objections of ${target_market}. Do NOT use generic objections. Think about the exact fears, doubts, and excuses this specific group has:
- "Wala akong oras" or "Too busy"
- "Hindi ako techie" or "I'm not good at this"
- "Baka scam" or trust issues
- "Maliit lang ang sinasahod ko" or financial doubt
- "I've tried before and it didn't work"

For each objection:
- Name it directly and empathetically ("If you're thinking...")
- Respond with logic and warmth
- Reinforce that they CAN do this with ${mechanism}
- Keep each response to 2-3 sentences

Write 3-4 objection responses total. Return plain text, no labels.
`,

    bonuses: `
${styleRules}
${context}

Write SECTION 7: BONUSES + VALUE STACK for this sales page.

Present the bonuses in a way that makes each feel essential, not just a freebie. For each bonus:
- State the name clearly
- Explain what specific problem, fear, or gap it addresses for ${target_market}
- State its peso value
- Make the reader feel like getting it alone is already worth the price

End with a value stack summary:
"Here is everything you get:
[Main ebook] — ₱[value]
${bonuses.map((b, i) => `[Bonus ${i + 1}: ${b.bonus_name}] — ₱${b.value_peso.toLocaleString()}`).join('\n')}
Total Value: ₱${total_value.toLocaleString()}
Your Price Today: ₱${selling_price.toLocaleString()}"

Return plain text, no extra labels.
`,

    price: `
${styleRules}
${context}

Write SECTION 8: PRICE JUSTIFICATION for this sales page.

Make ₱${selling_price.toLocaleString()} feel like an obvious, easy yes. Do this by:
- Comparing it to everyday Filipino spending: Grab rides, Starbucks coffee, GCash load, Netflix subscription, 1 night out
- Showing the math: what ${target_market} loses per month by NOT solving ${problem}
- Connecting the price to the transformation or income potential
- Keeping the tone warm and matter-of-fact, not pushy
- Be 2-3 paragraphs

Return plain text, no labels.
`,

    cta: `
${styleRules}
${context}

Write SECTION 9: CALL TO ACTION (CTA) for this sales page.

Use this EXACT structure:

Here's How To Order

Option 1: Pay via GCash or Bank Transfer
[List accepted payment channels here]
After payment, send proof to [support email or page].
We'll send your access right after verification.

Option 2: Pay with Credit Card or Debit Card
[Insert Order Link]
(Instant access, no need to message)

Then write 2-3 closing sentences that:
- State the launch price: ₱${selling_price.toLocaleString()}
- Connect it to who the reader is becoming (not just what they're buying)
- Remind them the launch price is for a limited time only
- Close with a warm but direct invitation to act now

End with:
"To your freedom,
[Author Name]"

Return plain text. Keep the exact structure above.
`,
  }

  return sectionPrompts[section]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { section, target_market, problem, mechanism, ebook_title, bonuses, total_value, selling_price, guarantee } = body

    if (!section || !target_market || !problem || !mechanism || !ebook_title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const marketHint = await getMarketLanguageHintForUser()

    const prompt = buildPrompt(section as SectionKey, {
      target_market,
      problem,
      mechanism,
      ebook_title,
      bonuses: bonuses || [],
      total_value: total_value || 0,
      selling_price: selling_price || 297,
      guarantee: guarantee || '30-day money-back guarantee',
    }) + marketHint

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.75,
      max_tokens: 1200,
      ...(section === 'headline' ? { response_format: { type: 'json_object' as const } } : {}),
    })

    const content = completion.choices[0].message.content?.trim() || ''
    return NextResponse.json({ data: content })
  } catch (error) {
    console.error('Section generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
