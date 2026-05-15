import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { getMarketLanguageHintForUser } from '@/lib/marketLanguage'
import { findBannedWords, buildCorrectionPrompt } from '@/lib/bannedWords'

// POST /api/generate/bonus-content
// Body: { bonus_name, format, description, target_market, problem,
//         unique_mechanism, ebook_title, objection_addressed }
// Returns: { data: { content: string } }
//
// Generates the ACTUAL deliverable text for a bonus that was previously
// scaffolded with /api/generate/bonus (which only returns name + format +
// short description). The output is format-shaped:
//   - PDF Checklist  → grouped checkboxes
//   - Worksheet      → fill-in prompts with blank lines
//   - Template       → paste-and-customize skeleton
//   - Cheat Sheet    → punchy one-liners on a single page
//   - Swipe File     → 5-10 copy-paste examples
//   - Script         → word-for-word say/write text
//   - Mini-Guide     → 800-1200 word structured guide
//   - Action Guide   → step-by-step action items
//
// The generated text is plain text (no markdown formatting on the wire).
// The .docx exporter (api/export/bonus) renders it for display.

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  'PDF Checklist': `Output a CHECKLIST. Total 10-15 checkable items, grouped into 3-4 named sections.

FORMAT EXACTLY:
[Section 1 name]
[ ] Item 1 — short reason or how-to (1 sentence)
[ ] Item 2 — short reason or how-to
[ ] Item 3 — short reason or how-to
[ ] Item 4 — short reason or how-to

[Section 2 name]
[ ] Item 5 — ...
(etc.)

Rules:
- Each item is one specific action the reader can check off
- Add a brief why or how-to after the em dash for each item
- 3-4 sections total, each with 3-5 items
- Total 10-15 items`,

  'Worksheet': `Output a WORKSHEET. 6-10 reflection prompts that the reader fills in.

FORMAT EXACTLY:
[Worksheet intro: 2-3 sentences explaining purpose]

PROMPT 1: [Question text — concrete and specific]
________________________________________________________________
________________________________________________________________
________________________________________________________________

PROMPT 2: [Question text]
________________________________________________________________
________________________________________________________________
________________________________________________________________

(etc. up to 6-10 prompts)

Rules:
- Each prompt is one focused question
- Use concrete, specific questions — not "How do you feel about money?"
  but "Write down the last 3 things you bought that you regret. Why?"
- Add 3-4 blank underscored lines for the reader to write in
- Progress from easier reflection to deeper insight`,

  'Template': `Output a TEMPLATE the reader can copy and customize.

FORMAT EXACTLY:
[Title of the template]

[Brief 1-sentence intro: when/how to use this template]

---

[ACTUAL TEMPLATE TEXT with [PLACEHOLDERS IN BRACKETS] for the reader to fill in]

[More template text...]

---

CUSTOMIZATION NOTES:
- [Note 1: when to change X]
- [Note 2: when to change Y]

Rules:
- The template is something the reader can paste-and-use today
- Use [BRACKETED PLACEHOLDERS] for parts they customize
- Add 3-5 customization notes at the bottom
- Could be: email template, message script, sales pitch outline, etc.`,

  'Cheat Sheet': `Output a CHEAT SHEET. 10-14 punchy one-liner tips, scannable in 30 seconds.

FORMAT EXACTLY:
[Cheat sheet title]

THE QUICK RULES:
- Tip 1: [Short rule. Specific.]
- Tip 2: [Short rule. Specific.]
- Tip 3: [Short rule. Specific.]
- Tip 4: [Short rule. Specific.]
- Tip 5: [Short rule. Specific.]
- Tip 6: [Short rule. Specific.]
- Tip 7: [Short rule. Specific.]

WHEN STUCK, REMEMBER:
- [Key idea 1, in a sentence]
- [Key idea 2, in a sentence]
- [Key idea 3, in a sentence]

ONE-LINE TAKEAWAY:
[The single most important sentence from this whole topic]

Rules:
- Every tip is one sentence. Punchy. Direct. No fluff.
- The reader should be able to scan the whole sheet in 30 seconds
- Include a clear single takeaway at the bottom`,

  'Swipe File': `Output a SWIPE FILE. 6-10 copy-paste examples the reader can lift directly.

FORMAT EXACTLY:
[Swipe file title]

[Brief intro: when/how to use these examples]

---

EXAMPLE 1: [Short context — when to use this one]
"[The actual copy-paste-ready text. Use first person. Sound natural.]"

---

EXAMPLE 2: [Context]
"[Text]"

---

(continue up to 6-10 examples)

Rules:
- Each example is ready to copy-paste with minimal editing
- Could be: opening lines, response templates, social media captions,
  follow-up messages, etc.
- Vary the contexts (formal vs casual, short vs long)
- Wrap each example in quotes so it's clear what to copy`,

  'Script': `Output a SCRIPT. Word-for-word text the reader can say or send.

FORMAT EXACTLY:
[Script title]

WHEN TO USE THIS SCRIPT:
[1-2 sentences on the situation]

THE SCRIPT:

"[Opening line — exactly what to say or write]"

"[Next line]"

"[Continue with the natural flow of the conversation or message]"

(continue for the full interaction — 200-400 words total)

ADAPTATIONS:
- If [scenario X], say: "[adjusted version]"
- If [scenario Y], say: "[adjusted version]"

Rules:
- The script is what the reader literally says or types — wrap in quotes
- Include 2-3 conditional adaptations at the end
- Sound natural, not robotic
- Avoid overly formal language`,

  'Mini-Guide': `Output a MINI-GUIDE. 800-1200 words of structured teaching.

FORMAT EXACTLY:
[Guide title]

INTRODUCTION (100-150 words)
[Open with the reader's pain point. State what this mini-guide solves.]

SECTION 1: [First key idea] (~250 words)
[Explain the idea. One specific example. Why it matters.]

SECTION 2: [Second key idea] (~250 words)
[Build on section 1. Concrete how-to. Another example.]

SECTION 3: [Third key idea] (~250 words)
[The "aha" or the deepest insight. Practical takeaway.]

YOUR NEXT MOVE (100-150 words)
[ONE specific action the reader should take in the next 24 hours.
Be concrete — not "reflect on this" but "open your phone and..."]

Rules:
- Conversational, not academic
- Each section has its own teaching arc
- End with one specific action
- Use sub-headers liberally for scannability`,

  'Action Guide': `Output an ACTION GUIDE. Step-by-step instructions, ~600-900 words.

FORMAT EXACTLY:
[Action guide title]

WHAT THIS GETS YOU:
[1-2 sentences on the concrete outcome]

WHAT YOU NEED BEFORE STARTING:
- [Prerequisite 1]
- [Prerequisite 2]
- [Prerequisite 3]

THE STEPS:

STEP 1: [Action verb + specific thing]
[2-3 sentences explaining HOW to do this step. Be specific — "open your
bank app and screenshot the savings balance" not "review your finances".]

STEP 2: [Action verb + specific thing]
[Detail]

STEP 3: [Action verb + specific thing]
[Detail]

(continue for 5-8 steps total)

IF YOU GET STUCK:
[Brief 1-2 sentence troubleshooting note]

CELEBRATE:
[1 sentence on how the reader knows they're done]

Rules:
- Each step is one concrete action verb + specific thing
- Include prerequisites at the top
- 5-8 steps total
- Sound like a friend walking them through it`,
}

const SYSTEM_PROMPT = `You are a digital product creator who specializes in writing high-utility bonus content for Filipino creators selling ebooks and digital products.

Your job: given a bonus name + format + the project's audience/problem/solution context, write the ACTUAL CONTENT of the bonus document. Not a description — the real, usable content the reader will receive.

Quality bar:
- Specific, not generic. Mention concrete situations, peso amounts, time-of-day, places — not abstract advice.
- Doable today. Every action item should be possible in the reader's next 24 hours.
- Reader-first voice. Talk to them, not at them. Casual, warm, Filipino-friendly.
- Plain text only — no markdown asterisks, no hashtags, no code fences. Use the format pattern provided exactly.

WRITING REGISTER (strictly enforced): ~70% English / ~30% Tagalog. Body in English; Tagalog appears in dialogue, internal thoughts, short emotional beats. A Filipino-American reader should follow without translation.

BANNED WORDS — never use: unlock, unleash, discover, transform your life, revolutionize, ultimate guide, game-changing, next-level, powerful secrets, tap into, harness, ignite, amplify, supercharge, delve, realm, tapestry, testament, pivotal, robust, garner, foster, alignment, landscape, meticulous, multifaceted, nuanced, profound, holistic, comprehensive, streamline, empower, leverage.

Always return valid JSON only. No markdown fences, no explanations outside JSON.`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      bonus_name,
      format,
      description,
      target_market,
      problem,
      unique_mechanism,
      ebook_title,
      objection_addressed,
    } = body

    if (!bonus_name || !format || !target_market || !problem) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const formatInstructions = FORMAT_INSTRUCTIONS[format]
    if (!formatInstructions) {
      return NextResponse.json({ error: `Unknown format: ${format}` }, { status: 400 })
    }

    const marketHint = await getMarketLanguageHintForUser()

    const userPrompt = `BONUS TO CREATE: ${bonus_name}
FORMAT: ${format}
PURPOSE: ${description || 'A practical shortcut for the reader.'}
ADDRESSES OBJECTION: ${objection_addressed || '(general value)'}

PROJECT CONTEXT:
- Target market: ${target_market}
- Problem they're solving: ${problem}
- Solution method: ${unique_mechanism || '(the creator\'s approach)'}
- Parent ebook: ${ebook_title || '(unnamed)'}

${formatInstructions}

Return ONLY valid JSON in this shape:
{
  "content": "The full bonus content as a single plain-text string. Use \\n for line breaks. Follow the format pattern above exactly. No markdown."
}`

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + marketHint },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.75,
      max_tokens: 2500,
    })

    let raw = completion.choices[0].message.content ?? '{}'

    // Banned-word scan + single correction pass
    const bannedFound = findBannedWords(raw)
    if (bannedFound.length > 0) {
      const correction = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + marketHint },
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: raw },
          { role: 'user', content: buildCorrectionPrompt(raw, bannedFound) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      })
      raw = correction.choices[0].message.content ?? raw
    }

    const parsed = JSON.parse(raw) as { content?: string }
    if (!parsed.content || typeof parsed.content !== 'string') {
      return NextResponse.json({ error: 'Empty content returned' }, { status: 500 })
    }

    return NextResponse.json({ data: { content: parsed.content } })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('Bonus content generation error:', detail)
    return NextResponse.json({ error: 'Generation failed', detail }, { status: 500 })
  }
}
