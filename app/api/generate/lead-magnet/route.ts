import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { getMarketLanguageHintForUser } from '@/lib/marketLanguage'

export const maxDuration = 60

// POST /api/generate/lead-magnet
// Body: { target_market, problem, mechanism, ebook_title, format, section, ... }
// section = 'outline' → title, hook, introduction, quick_win, bridge_to_ebook
// section = 'main_content' → main_content only (pass title + hook for context)
// section omitted → returns all fields (backward compat, but prefers split calls)

const FORMAT_LABELS: Record<string, string> = {
  checklist: 'Checklist',
  quick_guide: 'Quick Guide',
  free_report: 'Free Report',
}

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  checklist: `A checklist with 10-15 actionable items grouped into 3-4 categories.

Each category has:
- A bold heading (e.g., "Step 1: [Action Area]")
- 3-5 checkbox items under it

Each checkbox item format:
"[ ] [Action verb] + [specific thing to do] — [why it matters in 1 sentence]"

Example:
"Step 1: Assess Your Dog's Risk Level
[ ] Check your dog's outdoor exposure — dogs that go to parks or grassy areas need more protection
[ ] Inspect your dog's sleeping area for flea dirt — look for tiny black specks on bedding
[ ] Note the season — flea and tick season in the Philippines peaks during rainy months (June-November)"

Make each item specific to the target market. Not generic advice anyone could Google.
Total: 10-15 items across 3-4 categories. Each item must be something they can DO today.`,

  quick_guide: `A quick guide with 5-6 clearly structured sections.

Each section has:
- A numbered heading: "Step [N]: [Clear Action]"
- 4-6 sentences of practical advice
- One specific example or scenario that the target market would recognize
- End with a concrete "Do this now:" one-liner

Make each section feel like a friend giving fast, tested advice — not a textbook.
Total length: each section should be a solid paragraph (60-80 words). Not bullet points.`,

  free_report: `A free report with 4-5 insight sections.

Each section has:
- A bold, curiosity-driven heading (e.g., "The Hidden Reason Your [Problem] Keeps Coming Back")
- 1 opening bold statement or surprising fact
- 3-4 sentences unpacking the insight with specific details
- 1 real-world example or scenario the target market lives through
- End with ONE concrete action step

Make it feel like insider knowledge — things they wouldn't find in a generic Google search.
Total length: each section should be 80-100 words. Punchy, not academic.`,
}

function buildIdeaContext(idea_angle?: string, idea_description?: string, example_title?: string, emotional_trigger?: string) {
  if (!idea_angle) return ''
  return `
CHOSEN ANGLE: "${idea_angle}"
What it covers: ${idea_description}
Target emotional trigger: ${emotional_trigger || 'desire'}
Target title direction: "${example_title}"

Every section must deliver on this specific angle. The title should be a refined version of the target title direction — same formula, same specificity, but polished.
`
}

function buildOutlinePrompt(
  target_market: string, problem: string, mechanism: string,
  ebook_title: string, format: string,
  idea_angle?: string, idea_description?: string, example_title?: string, emotional_trigger?: string
) {
  const ideaContext = buildIdeaContext(idea_angle, idea_description, example_title, emotional_trigger)

  return `You are a lead magnet creator for Filipino digital product sellers.

Clarity Sentence: "I help ${target_market} who struggle with ${problem} through ${mechanism}"
Main ebook title: "${ebook_title}"
Lead magnet format: ${FORMAT_LABELS[format] || format}
${ideaContext}

THE ONLY JOB OF THIS LEAD MAGNET: Give the reader ONE small but meaningful win as fast as possible.

Apply the S.I.N.G.L.E. WIN Framework:
S — SPECIFIC OUTCOME: ONE narrow result, not a broad promise
I — IMMEDIATE RELEVANCE: Speaks to their frustration RIGHT NOW
N — NO-BRAINER EFFORT: Feels like a shortcut, not a course
G — GUARANTEED MICRO RESULT: Achievable today
L — LOW TIME COMMITMENT: Finishable in one sitting (10 min max)
E — EMOTIONAL TRIGGER: Pick ONE (frustration, fear, desire, or relief) and hit it hard
WIN — TRANSFORMATION: Clear before/after

TONE: Simple. Warm. Practical. Filipino-audience friendly. No hype, no jargon, no deep Tagalog.
WRITING REGISTER (strictly enforced): ~70% English / ~30% Tagalog. Body copy in English, Tagalog as warmth and short emotional beats only — never as the carrying language. A Filipino-American reader should follow without translation.

Your task: Generate the OUTLINE sections only (NOT the main content — that comes separately).

Return ONLY valid JSON:
{
  "title": "Use formula: 'How to [Specific Result] in [Short Time] without [Big Pain] even if [Common Objection]'. Specific to ${target_market}.",
  "hook": "2-3 sentences. Hit ONE dominant emotion hard. Make the reader feel seen — like you're reading their mind. Go straight to the nerve.",
  "introduction": "4-5 sentences. Speak to their CURRENT situation — what frustration they're stuck in, what they've tried that didn't work. End with a promise of ONE specific micro result they'll get.",
  "quick_win": "The transformation as before/after: 'Before this: [frustrated state]. After this: [specific better state].' Plus 1 sentence: the single most important action to take in the next 5 minutes.",
  "bridge_to_ebook": "3-4 sentences. Soft, natural — NOT a hard sell. Acknowledge this solved one small piece. Name the bigger problem remaining. Introduce the ebook as the logical next step."
}`
}

function buildMainContentPrompt(
  target_market: string, problem: string, mechanism: string,
  format: string, title: string, hook: string,
  idea_angle?: string, idea_description?: string, emotional_trigger?: string
) {
  const ideaContext = idea_angle ? `
CHOSEN ANGLE: "${idea_angle}"
What it covers: ${idea_description}
Emotional trigger: ${emotional_trigger || 'desire'}
` : ''

  return `You are writing the MAIN CONTENT section of a lead magnet for Filipino digital product sellers.

The lead magnet has already been outlined. Here is the context:
- Title: "${title}"
- Hook: "${hook}"
- Target market: ${target_market}
- Their problem: ${problem}
- The solution: ${mechanism}
- Format: ${FORMAT_LABELS[format] || format}
${ideaContext}

YOUR TASK: Write the full main content section. This is the MEAT of the lead magnet — the part that delivers the actual value and the micro-win.

TONE: Simple. Warm. Practical. Like a knowledgeable friend walking them through it step by step. Filipino-audience friendly. No jargon, no deep Tagalog.
WRITING REGISTER (strictly enforced): ~70% English / ~30% Tagalog. Body copy in English, Tagalog as warmth and short emotional beats only — never as the carrying language. A Filipino-American reader should follow without translation.

FORMAT AND LENGTH REQUIREMENTS:
${FORMAT_INSTRUCTIONS[format] || FORMAT_INSTRUCTIONS['checklist']}

IMPORTANT:
- Be SPECIFIC to ${target_market}. Use examples, scenarios, and language they would recognize.
- Every item must be actionable — no theory, no filler, no "it depends."
- This should feel like the most useful 10 minutes of their week.

Return ONLY valid JSON:
{
  "main_content": "The full main content as a single plain-text string. Use \\n for line breaks between sections/items. Do NOT return an array or object — just one string."
}`
}

export async function POST(request: NextRequest) {
  try {
    const {
      target_market, problem, mechanism, ebook_title, format, section,
      // Idea context
      idea_angle, idea_description, example_title, emotional_trigger,
      // Main content context (passed from outline result)
      title, hook,
    } = await request.json()

    if (!target_market || !problem || !mechanism || !format) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const marketHint = await getMarketLanguageHintForUser()
    let prompt: string
    if (section === 'main_content') {
      prompt = buildMainContentPrompt(
        target_market, problem, mechanism, format,
        title || '', hook || '',
        idea_angle, idea_description, emotional_trigger
      )
    } else {
      // 'outline' or omitted — generate outline sections
      prompt = buildOutlinePrompt(
        target_market, problem, mechanism, ebook_title, format,
        idea_angle, idea_description, example_title, emotional_trigger
      )
    }
    prompt += marketHint

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.75,
      max_tokens: section === 'main_content' ? 3000 : 1500,
    })

    const content = completion.choices[0].message.content
    const result = JSON.parse(content || '{}')

    // Ensure all fields are plain strings
    for (const key of Object.keys(result)) {
      if (typeof result[key] !== 'string') {
        result[key] = Array.isArray(result[key])
          ? result[key].map((item: Record<string, string>) =>
              typeof item === 'string' ? item : Object.values(item).join(' — ')
            ).join('\n\n')
          : JSON.stringify(result[key])
      }
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Lead magnet generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
