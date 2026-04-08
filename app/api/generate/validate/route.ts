import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'

// POST /api/generate/validate
// Body: { target_market: string, problem: string, mechanism: string }
// Returns brutally honest validation of the clarity sentence idea

export async function POST(request: NextRequest) {
  try {
    const { target_market, problem, mechanism } = await request.json()

    const clarity_sentence = `I help ${target_market} who struggle with ${problem} through ${mechanism}`

    const prompt = `You are a brutally honest business advisor for the Philippine digital products market.

Clarity Sentence: "${clarity_sentence}"

Analyze this idea honestly. Return ONLY a valid JSON object, no other text:
{
  "problem_validation": "Is this a real, urgent problem Filipinos pay to solve? (2-3 sentences)",
  "market_size": "Approximate number of this target market in the Philippines",
  "buying_behavior": "Are they currently spending money on this? What are they buying?",
  "existing_solutions": ["solution 1", "solution 2", "solution 3"],
  "price_range": "What price range do similar solutions sell for in PH?",
  "urgency_score": 7,
  "market_demand_score": 7,
  "red_flags": "Any concerns or challenges to be aware of (or 'None' if clean)",
  "recommendation": "GO",
  "recommendation_reason": "Why you recommend GO or REFINE (2-3 sentences)",
  "refinement_suggestion": "Specific suggestion if REFINE — what exactly to change. Leave empty string if GO."
}

Scoring guide:
- 8-10: Strong demand, proven market, people actively pay for this
- 6-7: Decent demand, worth testing
- Below 6: Weak demand, needs major pivoting

Be specific to Philippine culture, economics, and buying behavior. Do not be overly encouraging.`

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.5,
    })

    const content = completion.choices[0].message.content
    const result = JSON.parse(content || '{}')

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Validation error:', error)
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 })
  }
}
