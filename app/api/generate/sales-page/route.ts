import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { getMarketLanguageHintForUser } from '@/lib/marketLanguage'

export const maxDuration = 120

// POST /api/generate/sales-page
// Body: { target_market, problem, mechanism, ebook_title, bonuses, total_value, selling_price, guarantee }
// Returns: { data: { headline, problem_section, solution_section, proof_section, offer_section, guarantee_section, cta_section } }

interface Bonus {
  bonus_name: string
  description: string
  format: string
  value_peso: number
  objection_addressed: string
}

export async function POST(request: NextRequest) {
  try {
    const {
      target_market,
      problem,
      mechanism,
      ebook_title,
      bonuses,
      total_value,
      selling_price,
      guarantee,
    } = await request.json()

    if (!target_market || !problem || !mechanism || !ebook_title) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const bonusList = (bonuses as Bonus[])
      .map((b, i) => `Bonus ${i + 1}: "${b.bonus_name}" — ${b.description} (Value: ₱${b.value_peso.toLocaleString()})`)
      .join('\n')

    const marketHint = await getMarketLanguageHintForUser()

    const prompt = `You are CHILLYONARYO, a master Taglish direct response copywriter for the Philippine info product market.${marketHint}

Clarity Sentence: "I help ${target_market} who struggle with ${problem} through ${mechanism}"
Ebook title: "${ebook_title}"
Bonuses:
${bonusList}
Total value: ₱${total_value.toLocaleString()}
Selling price: ₱${selling_price.toLocaleString()}
Guarantee: ${guarantee}

STYLE RULES (apply to every section):
- 80% English, 20% Tagalog. Weave Tagalog phrases naturally — never forced.
- Short, rhythmic sentences. 1-2 sentences per paragraph in pain and lead sections.
- Conversational, human tone. Write like you're talking to a friend, not presenting to a boardroom.
- No hype, no exaggerated income claims, no fake urgency.
- Filipino-specific references where natural: Grab, GCash, Starbucks, EDSA, BDO, BPI, jeepney, 15/30 salary cycle, etc.
- Never use the em dash character (—). Use a comma, period, or line break instead.

Write a complete sales page using this exact structure.

Return ONLY a valid JSON object, no other text:
{
  "headline": "Apply the 4U Formula: Useful (clear benefit), Unique (position against what they have been trying), Ultra-Specific (include a timeframe or measurable result if natural), and emotionally resonant. Structure it as two lines: a strong first line stating the outcome, and a shorter second line that removes a common objection or frustration. Pattern options: 'How [Target Market] Can [Clear Outcome] Without [Common Frustration]' or 'In Just [Timeframe], [Specific Outcome] Even If [Common Objection]' or '[Outcome in X Days] No [Frustrating Thing They Have Been Doing], No [Other Frustration], Just [The Real Result]'. NOT a question. Under 25 words per line. Ultra-specific to ${target_market} and ${problem}.",

  "problem_section": "200-250 words. Open with a short, scene-setting paragraph that puts the reader inside their daily struggle — something they will immediately recognize as their life. Use 'you' language throughout. Then go deeper: describe the emotional cost, the quiet exhaustion, the moments where they feel stuck or invisible. Show you understand the feeling, not just the fact. Use short punchy sentences. Weave in natural Tagalog where it fits — not every sentence, but where it lands harder in Filipino. Show the reader they are not failing because they lack discipline or willpower. They are struggling because the situation itself is hard. End with a sentence that opens the door to a new way of seeing the problem.",

  "solution_section": "150-200 words. Start with a one-sentence truth or principle that reframes how the reader sees their problem — something that makes them think 'I never thought of it that way.' Then introduce the ebook by name as the practical answer to that truth. Explain simply what it does and who it is for. Avoid hype. Make it feel like a relief to discover, not a sales pitch to resist. End with 3 short bullet points of what the reader will be able to do after going through the ebook.",

  "proof_section": "100-150 words. Explain logically why this approach works. Do not use testimonials. Use reasoning: cause and effect, what changes when the method is applied, why previous approaches fail for this audience. Ground it in how this specific target market thinks and lives. Make the reader feel the solution makes sense before they even try it.",

  "offer_section": "250-300 words. Open with: 'Here is what you get inside [ebook title]:' Then list 5-7 key outcomes the reader will gain, written as benefits not features. Next, present each bonus with its name, what specific objection or gap it addresses, and its peso value. Finally, anchor the value: 'Total value: ₱${total_value.toLocaleString()}. Yours today for only ₱${selling_price.toLocaleString()}.' Use the price gap to show what a clear win this is.",

  "guarantee_section": "60-80 words. State the guarantee warmly and plainly: ${guarantee}. Then give one sentence that removes residual doubt. Make the reader feel safe. Keep it calm — no drama.",

  "cta_section": "Use this exact structure: Start with 'Here is How to Order' as a label. Then: Option 1 (GCash or Bank Transfer) with placeholder for payment details and instruction to send proof of payment. Option 2 (Credit Card or Debit Card) with placeholder for order link and note about instant access. Then write 2-3 short sentences: state the launch price (₱${selling_price.toLocaleString()}), connect it to who the reader is becoming, remind them the launch price is for a limited time only, and close with a warm but direct invitation to secure their copy. End with: 'To your freedom, [Author Name]'"
}

Tone throughout: Empathetic, grounded, conversational. Filipino-specific. Every section must feel like it was written by someone who truly understands this reader's life.`

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 5000,
    })

    const content = completion.choices[0].message.content
    const result = JSON.parse(content || '{}')

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Sales page generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
