import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { logAiUsage } from '@/lib/aiUsage'
import { requireUser } from '@/lib/apiAuth'
import { streamProblemCards, cardsFromReportJson, type ProblemsEvent } from '@/lib/clarity/problemsReport'
import { streamMechanisms, type MechanismInput, type MechanismsEvent } from '@/lib/clarity/mechanisms'

// POST /api/generate/clarity
// Body: { target_market: string, step, problem?, current_solution?, report? }
//
// step = 'problems_report': gpt-5.6-sol researches the market and writes the 10
//                           problem cards, streamed as NDJSON progress events
//                           ending with { type: 'done', cards, report }
// step = 'problems_cards':  re-normalizes a 'done' report. Only a browser still
//                           on the previous (two-request) page bundle calls it.
// step = 'problems':        the cards as plain JSON, no streaming. Same reason.
// step = 'mechanisms_stream': gpt-5.6-sol writes 5 unique mechanisms for the chosen
//                           problem, streamed as NDJSON (lib/clarity/mechanisms.ts)
// step = 'mechanisms':      the same as plain JSON, for a browser on the previous bundle
// step = 'polish':          polishes the final clarity sentence
//
// The problems step is in lib/clarity/problemsReport.ts; see its header for
// why it is built the way it is.

// The one-pass Sol analysis runs ~70-90s; this leaves room for slow days.
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser()
    if (!auth.ok) return auth.response

    const { target_market, step, problem, current_solution, report, problem_details } = await request.json()

    if (!target_market || !step) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Audience is dynamic — defined by the creator's target_market input.
    // No employment-status gate; the creator decides who their ebook serves.

    let prompt = ''

    if (step === 'problems_report') {
      // NDJSON so the page can show real progress: each web search, then each
      // card as Sol writes it, then the finished cards in the 'done' event.
      const encoder = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (ev: ProblemsEvent | { type: 'error'; message: string }) =>
            controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'))
          try {
            for await (const ev of streamProblemCards(target_market, auth.user.id, request.signal)) send(ev)
          } catch (err) {
            console.error('[clarity] problems_report failed:', err)
            send({ type: 'error', message: err instanceof Error ? err.message : 'The market analysis failed. Please try again.' })
          } finally {
            controller.close()
          }
        },
      })
      return new Response(body, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
        },
      })
    }

    if (step === 'problems_cards') {
      if (typeof report !== 'string' || report.trim().length < 500) {
        return NextResponse.json({ error: 'Missing market analysis. Please try again.' }, { status: 400 })
      }
      const cards = cardsFromReportJson(report)
      return NextResponse.json({ data: cards.items, top_pick: cards.top_pick })
    }

    if (step === 'problems') {
      for await (const ev of streamProblemCards(target_market, auth.user.id, request.signal)) {
        if (ev.type === 'done') return NextResponse.json({ data: ev.cards.items, top_pick: ev.cards.top_pick })
      }
      return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
    }

    if (step === 'mechanisms' || step === 'mechanisms_stream') {
      if (!problem) {
        return NextResponse.json({ error: 'Missing problem for mechanism generation' }, { status: 400 })
      }

      // The whole chosen problem card, not just its title: the mechanisms
      // are only as sharp as what Sol knows about why the usual fix fails.
      const d = (problem_details && typeof problem_details === 'object' ? problem_details : {}) as Record<string, unknown>
      const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
      const input: MechanismInput = {
        targetMarket: target_market,
        problem,
        currentSolution: text(current_solution),
        realQuestion: text(d.real_question),
        signs: Array.isArray(d.signs) ? d.signs.filter((x): x is string => typeof x === 'string').slice(0, 8) : undefined,
        currentAttempts: text(d.current_attempts),
        proofOfDemand: text(d.proof_of_demand),
        desiredOutcome: text(d.desired_outcome),
      }

      // Plain JSON, for a browser still on the previous page bundle.
      if (step === 'mechanisms') {
        for await (const ev of streamMechanisms(input, auth.user.id, request.signal)) {
          if (ev.type === 'done') return NextResponse.json({ data: ev.cards.items, recommended: ev.cards.recommended })
        }
        return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
      }

      // NDJSON so the page can show each mechanism's name as Sol writes it.
      const encoder = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (ev: MechanismsEvent | { type: 'error'; message: string }) =>
            controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'))
          try {
            for await (const ev of streamMechanisms(input, auth.user.id, request.signal)) send(ev)
          } catch (err) {
            console.error('[clarity] mechanisms_stream failed:', err)
            send({ type: 'error', message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' })
          } finally {
            controller.close()
          }
        },
      })
      return new Response(body, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
        },
      })
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
      logAiUsage({ userId: auth.user.id, route: 'clarity', model: AI_MODEL, usage: polishCompletion.usage })
      const polished = JSON.parse(polishCompletion.choices[0].message.content || '{}')
      return NextResponse.json({ sentence: polished.sentence || '' })
    }

    return NextResponse.json({ error: `Unknown step: ${step}` }, { status: 400 })
  } catch (error) {
    console.error('Clarity generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
