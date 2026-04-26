import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai, AI_MODEL } from '@/lib/openai'

// Admin-only A/B test for the Step 2 problem-finder prompt.
// Runs the current PRODUCTION prompt (structured 6-field JSON) and a
// WORKSHOP-STYLE prompt (open prose insight per problem) on the same
// target market in parallel, returns both for side-by-side comparison.

export const maxDuration = 90

// ── Production prompt (mirrors app/api/generate/clarity step='problems') ─────

function productionPrompt(targetMarket: string): string {
  return `I want to create a highly marketable e-book for this target market: "${targetMarket}"

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
    }
  ]
}

Return exactly 10 items, ranked #1 = most profitable/likely to convert.`
}

// ── Workshop prompt (open prose insight, jon's hand-crafted version) ─────────
// Verbatim from jon's workshop with an added JSON wrapper so we can parse it.
// Spirit: open research question, asks for insight depth not field-filling.

function workshopPrompt(targetMarket: string): string {
  return `I'd like to create an e-book that helps ${targetMarket}. Help me find the biggest and most urgent problem that this market has. And with the highest demand for solutions. Provide a list of the top 10 specific and detailed problems and frustrations they face. Arrange the categories in order of urgency and demand for a solution. In your answer, please provide detailed insights into each category and why they'd like to solve this problem immediately.

Return ONLY a valid JSON object — no markdown, no explanation outside JSON:
{
  "items": [
    {
      "rank": 1,
      "problem": "Specific problem title",
      "insight": "A paragraph (4-6 sentences) of detailed insight — why they face this problem, why it's urgent, what's already happening in their lives because of it, and why they want to solve it immediately. Be specific, emotional, and grounded in their reality."
    }
  ]
}

Return exactly 10 items, ranked #1 = most urgent and highest demand.`
}

interface WorkshopItem {
  rank: number
  problem: string
  insight: string
}

interface ProductionItem {
  rank: number
  problem: string
  urgency: string
  proof_of_demand: string
  willingness_to_pay: string
  ease_of_selling: string
  common_phrases: string
}

async function runPrompt<T>(prompt: string): Promise<{ items: T[]; elapsed_ms: number }> {
  const started = Date.now()
  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  })
  const raw = completion.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw) as { items?: T[] }
  return {
    items: parsed.items ?? [],
    elapsed_ms: Date.now() - started,
  }
}

// Server-side re-rank — mirrors the production logic in app/api/generate/clarity.
// Deterministic ordering from WTP + Ease badges so what the user sees stays
// internally consistent (High+Easy can never rank below Medium+Moderate).
function rerankByBadges(items: ProductionItem[]): ProductionItem[] {
  const score = (item: ProductionItem): number => {
    const wtp = (item.willingness_to_pay ?? '').toString().toLowerCase()
    const ease = (item.ease_of_selling ?? '').toString().toLowerCase()
    const wtpScore = wtp.startsWith('high') ? 3 : wtp.startsWith('low') ? 1 : 2
    const easeScore = ease.startsWith('easy') ? 3 : ease.startsWith('hard') ? 1 : 2
    return wtpScore * 10 + easeScore
  }
  return items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => {
      const diff = score(b.item) - score(a.item)
      if (diff !== 0) return diff
      const aRank = typeof a.item.rank === 'number' ? a.item.rank : a.originalIndex + 1
      const bRank = typeof b.item.rank === 'number' ? b.item.rank : b.originalIndex + 1
      return aRank - bRank
    })
    .map(({ item }, i) => ({ ...item, rank: i + 1 }))
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })

  const body = await request.json()
  const { target_market } = body as { target_market: string }
  if (!target_market?.trim()) return NextResponse.json({ error: 'target_market required' }, { status: 400 })

  const productionPromptText = productionPrompt(target_market.trim())
  const workshopPromptText = workshopPrompt(target_market.trim())

  try {
    const [prodResult, workshopResult] = await Promise.all([
      runPrompt<ProductionItem>(productionPromptText),
      runPrompt<WorkshopItem>(workshopPromptText),
    ])

    return NextResponse.json({
      success: true,
      target_market: target_market.trim(),
      production: {
        items: rerankByBadges(prodResult.items),
        elapsed_ms: prodResult.elapsed_ms,
        prompt: productionPromptText,
      },
      workshop: {
        items: workshopResult.items,
        elapsed_ms: workshopResult.elapsed_ms,
        prompt: workshopPromptText,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[test-problems]', message)
    return NextResponse.json({ error: 'comparison_failed', detail: message }, { status: 500 })
  }
}
