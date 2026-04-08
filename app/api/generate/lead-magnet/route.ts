import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'

// POST /api/generate/lead-magnet
// Body: { target_market, problem, mechanism, ebook_title, format }
// format: 'checklist' | 'quick_guide' | 'free_report'
// Returns: { data: { title, hook, introduction, main_content, quick_win, bridge_to_ebook } }

export async function POST(request: NextRequest) {
  try {
    const { target_market, problem, mechanism, ebook_title, format } = await request.json()

    if (!target_market || !problem || !mechanism || !format) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const formatInstructions: Record<string, string> = {
      checklist: '7-10 short, scannable action items. Each item is one line: the action + one sentence of why it matters. No fluff. Completable in under 10 minutes.',
      quick_guide: '4-5 short sections. Each section has a clear heading + 2-3 direct, practical sentences. No filler. Feels like a friend giving fast advice.',
      free_report: '3-4 insight sections. Each section opens with ONE bold observation and ends with ONE concrete action. Punchy. Not academic.',
    }

    const formatLabel: Record<string, string> = {
      checklist: 'Checklist',
      quick_guide: 'Quick Guide',
      free_report: 'Free Report',
    }

    const prompt = `You are a lead magnet creator for Filipino digital product sellers.

Clarity Sentence: "I help ${target_market} who struggle with ${problem} through ${mechanism}"
Main ebook title: "${ebook_title}"
Lead magnet format: ${formatLabel[format] || format}

THE ONLY JOB OF THIS LEAD MAGNET: Give the reader ONE small but meaningful win as fast as possible.
Not educate. Not impress. Not overwhelm. Just ONE win.

Apply the S.I.N.G.L.E. WIN Framework to every section:

S — SPECIFIC OUTCOME
The lead magnet must promise ONE specific, narrow result. Not "start a business." More like "get your first 3 paying customers using this script."
If it applies to everyone, no one will want it.

I — IMMEDIATE RELEVANCE
The reader must feel: "This is EXACTLY my problem right now."
Speak to their current frustration, their current situation, their current identity (who they are right now, not who they want to be).

N — NO-BRAINER EFFORT
This must feel like a shortcut, not a course. Format: ${formatLabel[format]}. Keep it short. If it looks like work, conversion drops.

G — GUARANTEED MICRO RESULT
Promise a result that is: small, achievable, completable today. Not "build a 6-figure business." More like "validate your idea in 10 minutes."

L — LOW TIME COMMITMENT
The reader should feel: "I can finish this in one sitting." Maximum 10 minutes to consume. No scrolling forever.

E — EMOTIONAL TRIGGER (pick ONE and hit it hard):
- Frustration ("I'm stuck and nothing is working")
- Fear ("I'm falling behind and wasting time")
- Desire ("I want that extra income / freedom")
- Relief ("Finally, something simple that actually works")

WIN — THE TRANSFORMATION HOOK
Answer clearly: "What will I BECOME after reading this?"
Frame it as a before/after: From [confused/stuck state] → To [specific better state].

TONE: Simple. Warm. Practical. Filipino-audience friendly. No hype, no jargon, no deep Tagalog.

For the MAIN CONTENT section: ${formatInstructions[format] || formatInstructions['checklist']}

Return ONLY a valid JSON object, no other text:
{
  "title": "Use this formula: 'How to [Specific Result] in [Short Time] without [Big Pain] even if [Common Objection]'. Be specific to ${target_market}. Not generic.",
  "hook": "2-3 sentences. Hit ONE dominant emotion hard (frustration, fear, desire, or relief). Make the reader feel seen — like you're reading their mind right now. No setup. Go straight to the nerve.",
  "introduction": "3-4 sentences. Speak to their CURRENT situation and identity — not who they want to be, but who they are right now. What frustration are they stuck in? What have they already tried that didn't work? End with a promise of ONE specific micro result they will get from this.",
  "main_content": "The full main content as a single plain-text string (NOT an array or object). Use line breaks to separate sections. Must feel completable in under 10 minutes. Format as specified above. Every item must be actionable — no theory.",
  "quick_win": "The transformation. Frame it as a before/after: 'Before this: [frustrated stuck state]. After this: [specific better state they can reach today].' Then add 1 sentence: the single most important action they should take in the next 5 minutes.",
  "bridge_to_ebook": "3-4 sentences. Soft, natural — NOT a hard sell. Acknowledge warmly that this only solved one small piece. Name the bigger problem that still remains. Introduce the ebook as the complete roadmap — the logical next step, not a pitch."
}`

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.75,
      max_tokens: 2500,
    })

    const content = completion.choices[0].message.content
    const result = JSON.parse(content || '{}')

    // Ensure all fields are plain strings (AI sometimes returns objects/arrays)
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
