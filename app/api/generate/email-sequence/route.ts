import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'

export const maxDuration = 60

// POST /api/generate/email-sequence
// Body: { target_market, problem, mechanism, ebook_title, sales_page_url, day }
// Generates a SINGLE email for the specified day (1-7)

const DAY_BRIEFS: Record<number, { type: string; angle: string; structure: string }> = {
  1: {
    type: 'value',
    angle: 'The surface-level frustration they feel every day',
    structure: `Structure:
1. Hook — a specific relatable moment. Describe a scene they live through regularly. (2–3 lines)
2. Stir — describe 3 different specific moments when this problem hits them. Each moment is its own mini-scene with sensory details. "Yung feeling na..." (6–8 short paragraphs)
3. Shift — reveal a surprising insight. "Here's what nobody tells you..." Explain WHY the common approach doesn't work. (3–4 paragraphs)
4. Seed — plant the idea that there's a better way, without naming the product (1–2 lines)
5. Reframe — "Hindi pala yung [X] ang [problem]. Yung [Y] pala ang [truth]."
6. PS — one more relatable thought or question
7. Sign-off: "To your [relevant aspiration]," then: [Your Name]
No CTA. No selling. Pure value.`,
  },
  2: {
    type: 'value',
    angle: 'The deeper root cause they haven\'t considered',
    structure: `Structure:
1. Hook — a bold uncomfortable truth that challenges what they believe. (2–3 lines)
2. Stir — walk them through the symptoms they experience because of this root cause. Be specific — times, amounts, feelings. (6–8 short paragraphs)
3. Shift — reveal the real root cause. Use a metaphor or analogy to make it click. "Parang yung..." (3–4 paragraphs)
4. Seed — hint that understanding this root cause is the first step to fixing everything (1–2 lines)
5. Reframe — contrast the surface vs. the real issue
6. PS — a thought-provoking question that lingers
7. Sign-off: "To your [relevant aspiration]," then: [Your Name]
No CTA. No selling. Pure value.`,
  },
  3: {
    type: 'value',
    angle: 'A common mistake or myth that\'s making things worse',
    structure: `Structure:
1. Hook — name the mistake directly. "Most people think [X]. They're wrong." (2–3 lines)
2. Stir — describe what happens when people follow this bad advice. Paint the frustrating cycle. (6–8 short paragraphs)
3. Shift — explain why this advice is wrong and what actually works instead. Use a specific example or mini-story. (3–4 paragraphs)
4. Seed — connect the better approach to a system or method without hard-selling (1–2 lines)
5. Reframe — "Ang totoo, hindi [myth] ang kailangan mo. [Truth] pala."
6. PS — validate them: "Hindi mo kasalanan na na-try mo yung [wrong approach]."
7. Sign-off: "To your [relevant aspiration]," then: [Your Name]
No CTA. No selling. Pure value.`,
  },
  4: {
    type: 'value',
    angle: 'The mindset shift or "aha moment" that changes everything',
    structure: `Structure:
1. Hook — share a turning-point moment. "There was a day when everything changed..." (2–3 lines)
2. Stir — describe the "before" state in vivid detail. What life looked like when they were stuck. (5–6 short paragraphs)
3. Shift — the aha moment. What specifically changed in thinking. Make it concrete, not motivational fluff. A real insight with a real example. (4–5 paragraphs)
4. Seed — "Once you see this, you can't unsee it. And the path forward becomes obvious." (1–2 lines)
5. Reframe — contrast old thinking vs. new thinking in one sharp line
6. PS — bridge to tomorrow: "Bukas, may ipapakita ako sa'yo..."
7. Sign-off: "To your [relevant aspiration]," then: [Your Name]
No CTA. No selling. Pure value.`,
  },
  5: {
    type: 'selling',
    angle: 'Soft introduction of the ebook — personal story',
    structure: `Structure:
1. Hook — "I need to tell you something personal..." or similar vulnerable opening (2–3 lines)
2. Story — share the personal journey of creating this ebook. What drove you to make it. The struggles you went through. (5–6 paragraphs)
3. Bridge — connect your story to the reader's situation. "Kaya ko ginawa ito — para sa mga tulad mo na..." (2–3 paragraphs)
4. Introduce — name the ebook naturally. Share 3–4 specific benefits (not features). What will change for them. (3–4 paragraphs)
5. Soft CTA — "If you want to see what's inside:" then the link. Low pressure. (1–2 lines)
6. PS — reassurance: "No pressure. Pero kung ready ka na, nandyan lang yan."
7. Sign-off: "To your [relevant aspiration]," then: [Your Name]`,
  },
  6: {
    type: 'selling',
    angle: 'Address the biggest objection head-on',
    structure: `Structure:
1. Hook — name the objection directly. "You're probably thinking: [objection]" (2–3 lines)
2. Validate — "I get it. Ganyan din ako dati." Show you understand their hesitation. (3–4 paragraphs)
3. Counter — address the objection with logic, a story, or social proof. Be specific with numbers or results. (4–5 paragraphs)
4. Reframe the cost — compare the price to what they're already spending on the problem. "Mas mahal pa yung [thing they waste money on]." (2–3 paragraphs)
5. CTA — "See everything you get inside:" then the link. (1–2 lines)
6. PS — address a second smaller objection briefly
7. Sign-off: "To your [relevant aspiration]," then: [Your Name]`,
  },
  7: {
    type: 'selling',
    angle: 'Final close — direct, honest, urgent',
    structure: `Structure:
1. Hook — "This is my last email about this." Direct and honest. (2–3 lines)
2. Recap — everything they get: the ebook, each bonus, the total value vs. the price. Be specific with peso amounts. (4–5 paragraphs)
3. Future paint — describe their life 3 months from now if they take action today vs. if they don't. Be vivid and specific. (3–4 paragraphs)
4. Honest urgency — no fake scarcity. Just truth: "The longer you wait, the longer [problem] keeps [consequence]." (2–3 paragraphs)
5. Final CTA — "Get your copy now:" then the link. Clear and direct. (1–2 lines)
6. PS — "Kahit hindi mo bilhin, thank you for reading these emails. Pero kung ready ka na, this is for you."
7. Sign-off: "To your [relevant aspiration]," then: [Your Name]`,
  },
}

function buildSingleEmailPrompt(
  day: number,
  target_market: string,
  problem: string,
  mechanism: string,
  ebook_title: string,
  sales_page_url: string
) {
  const brief = DAY_BRIEFS[day]

  return `You are a Filipino email copywriter writing ONE email on behalf of an expert selling their ebook. You write in their voice — not yours.

---

CONTEXT:
- Who reads this email: ${target_market}
- What they struggle with: ${problem}
- What solves it: ${mechanism}
- The ebook being sold: "${ebook_title}"
${day >= 5 ? `- Sales page URL: ${sales_page_url}` : ''}

---

THIS IS DAY ${day} OF A 7-DAY SEQUENCE.
- Days 1–4 are pure value (no selling). Days 5–7 introduce the ebook.
- Today's angle: ${brief.angle}
- Email type: ${brief.type}

---

WRITING RULES:

Language:
- Taglish: 75% English, 25% Tagalog at the word level
- Tagalog is for emotional punch — hooks, gut-check moments, rhetorical questions, PS lines
- Use casual everyday Tagalog only: pero, kasi, lang, talaga, diba, kahit, parang, na, e
- NEVER use deep or formal Filipino (subalit, gayunpaman, nangangailangan, pinapanood)

Voice:
- A trusted friend who is one step ahead. NOT a marketer. NOT a motivational speaker.
- Short sentences. Punch, don't lecture.
- Single-sentence paragraphs. Heavy white space — this is read on mobile.
- No corporate jargon. No "leverage," "unlock your potential," "game-changer."
- Never open with "I hope this email finds you well."

Specificity:
- "7:43 PM" not "evening." "3 months" not "a short time." "₱4,200" not "a small amount."

---

LENGTH (non-negotiable):
- The email body MUST be 250–350 words. This is your ONLY email to write — use the full budget.
- Include at least 25 separate lines (paragraphs separated by \\n).
- You have unlimited space. Write a FULL, RICH email. Not a summary. Not bullet points.

---

${brief.structure}

---

Subject line rules:
- Max 19 characters. Hard limit.
- Two options for A/B testing.

---

Return ONLY valid JSON. No markdown. No explanation:

{
  "email": {
    "day": ${day},
    "type": "${brief.type}",
    "subject_a": "...",
    "subject_b": "...",
    "body": "...",
    "cta": ${day >= 5 ? `"${sales_page_url}"` : 'null'}
  }
}`
}

export async function POST(request: NextRequest) {
  try {
    const { target_market, problem, mechanism, ebook_title, sales_page_url, day } = await request.json()

    const emailDay = day || 1
    const prompt = buildSingleEmailPrompt(emailDay, target_market, problem, mechanism, ebook_title, sales_page_url || '')

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 2000,
    })

    const content = completion.choices[0].message.content
    const result = JSON.parse(content || '{}')

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Email generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
