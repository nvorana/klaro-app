import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { getMarketLanguageHintForUser } from '@/lib/marketLanguage'

// POST /api/generate/offer
// Body: { action, ...context }
//
// action = 'transformation'
//   Body: { target_market, problem, mechanism, ebook_title, student_input }
//   Returns: { data: { statement } }
//
// action = 'price_anchor'
//   Body: { target_market, ebook_title, transformation, selling_price, total_value }
//   Returns: { data: { justification } }
//
// action = 'offer_statement'
//   Body: { target_market, problem, ebook_title, transformation, bonuses, selling_price, total_value, guarantee }
//   Returns: { data: { offer_statement } }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body
    const marketHint = await getMarketLanguageHintForUser()

    // ── Transformation ─────────────────────────────────────────────────────────
    if (action === 'transformation') {
      const { target_market, problem, mechanism, ebook_title, student_input } = body

      const prompt = `You are an offer strategist for Filipino digital product sellers.${marketHint}

Ebook: "${ebook_title}"
Target market: ${target_market}
Problem solved: ${problem}
Unique approach/method: ${mechanism}
${student_input ? `Student's additional words: "${student_input}"` : ''}

Generate ONE powerful transformation statement based on the data above.

Rules:
- Format: "From [specific stuck state] → To [specific better state they can reach]"
- Be concrete and specific — no vague words like "success" or "freedom"
- Reflect the exact problem and mechanism — do not invent details
- Write for a Filipino audience — warm, direct, relatable
- Maximum 2 sentences total

Return ONLY a valid JSON object:
{ "statement": "Your transformation statement here" }`

      const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 200,
      })

      const result = JSON.parse(completion.choices[0].message.content || '{}')
      return NextResponse.json({ data: result })
    }

    // ── Price Anchor ───────────────────────────────────────────────────────────
    if (action === 'price_anchor') {
      const { target_market, ebook_title, transformation, selling_price, total_value } = body

      const prompt = `You are a pricing strategist for Filipino digital products.${marketHint}

Product: "${ebook_title}"
Who it's for: ${target_market}
Transformation: ${transformation}
Total value of everything included: ₱${total_value}
Selling price: ₱${selling_price}

Write ONE short, punchy price justification sentence — 2 to 3 sentences max.
Make the selling price feel like an obvious no-brainer compared to the total value.
Reference the transformation or the cost of NOT solving this problem.
Warm, direct, Filipino-friendly tone. No hype.

Return ONLY a valid JSON object:
{ "justification": "Your price justification here" }`

      const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 200,
      })

      const result = JSON.parse(completion.choices[0].message.content || '{}')
      return NextResponse.json({ data: result })
    }

    // ── Offer Statement ────────────────────────────────────────────────────────
    if (action === 'offer_statement') {
      const { target_market, problem, ebook_title, transformation, bonuses, selling_price, total_value, guarantee } = body

      const bonusList = (bonuses as { bonus_name: string; description: string; format: string; value_peso: number }[])
        .map(b => `- ${b.bonus_name} (${b.format}) — ₱${b.value_peso.toLocaleString()} value`)
        .join('\n')

      const prompt = `You are an offer strategist for Filipino digital product sellers.${marketHint} Write a complete Irresistible Offer Statement.

PRODUCT DETAILS:
Ebook: "${ebook_title}"
For: ${target_market} who struggle with ${problem}
Transformation: ${transformation}
Bonuses:
${bonusList}
Total value: ₱${total_value.toLocaleString()}
Selling price: ₱${selling_price}
Guarantee: ${guarantee}

Write the Irresistible Offer Statement as 3 short paragraphs:

Paragraph 1 — THE PROMISE: State who this is for, what their problem is, and the specific transformation they will get. Make the reader feel: "This was made exactly for me."

Paragraph 2 — THE STACK: Present everything they get (ebook + bonuses) with the total value, then reveal the selling price. Make the deal feel obvious and generous.

Paragraph 3 — THE SAFETY NET: State the guarantee in a warm, confident way. End with one sentence that removes all risk and makes saying yes feel effortless.

Tone: Warm, direct, confident. Conversational but professional. Filipino-audience friendly. No hype words. No em dashes.

Return ONLY a valid JSON object:
{ "offer_statement": "Full 3-paragraph offer statement here" }`

      const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.72,
        max_tokens: 600,
      })

      const result = JSON.parse(completion.choices[0].message.content || '{}')
      return NextResponse.json({ data: result })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Offer generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
