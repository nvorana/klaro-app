import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { getMarketLanguageHintForUser } from '@/lib/marketLanguage'

// POST /api/generate/content-posts
// Body: { target_market, problem, mechanism, post_type, count }
// post_type: 'problem_post' | 'micro_lesson' | 'personal_insight'
// count: 3 | 5 | 10

export async function POST(request: NextRequest) {
  try {
    const { target_market, problem, mechanism, post_type, count } = await request.json()

    const postTypeDescriptions: Record<string, string> = {
      problem_post: 'The entire post lives inside the reader\'s world. Describe their struggle in vivid detail. Make them feel deeply understood. Do NOT offer a solution in the post — that comes via DM.',
      micro_lesson: 'Teach one small, specific, actionable tip. Keep it focused on one idea only. No fluff.',
      personal_insight: 'Share an observation or perspective about the reader\'s situation. Make it feel like the writer truly gets their world — not from the outside looking in, but from within.',
    }

    const marketHint = await getMarketLanguageHintForUser()

    const prompt = `You are a Facebook content strategist for Filipino digital product sellers.${marketHint}

Target market: ${target_market}
Problem they face: ${problem}
Solution method: ${mechanism}
Content type: ${post_type}
Number of posts: ${count}

Write ${count} Facebook posts of type "${post_type}".

Content type guideline:
${postTypeDescriptions[post_type]}

Post format for ALL posts — use exactly this structure:

1. HOOK (1 sentence — the most important line in the entire post):
The hook is everything. On Facebook, only the first line is visible before "See more." If it doesn't stop the scroll, nobody reads what comes after.
A great hook does ONE of these:
- Names a painful truth the reader has never heard said out loud
- Opens a pattern interrupt that makes no sense without reading more
- States a bold, counterintuitive, or controversial observation
- Speaks the exact words the reader says to themselves in private
What a hook must NEVER do: start with "I", start with a generic compliment, state the obvious, or summarize what the post is about.
Good examples:
- "Ang tagal mo nang naghihintay ng 'right time' na hindi darating."
- "Most people don't fail because they're lazy. They fail because no one told them this."
- "The reason your skills aren't making you money yet has nothing to do with your skills."

2. VALUE (target: 200–250 words): The main content. Practical, relatable, specific to ${target_market}. Keep it real. This is the longest section — develop the idea fully, use short paragraphs, and make every sentence earn its place.

3. ENGAGEMENT CTA (1 sentence): Ask readers to comment a specific word OR send a DM. Do NOT include external links. Examples: "Comment 'YES' below if this sounds like you." or "DM me the word 'GUIDE' and I'll send you something helpful."

Each full post (hook + value + CTA combined) should be approximately 250 words total.

Rules for ALL posts:
- No hashtags
- No external links
- No hard selling in the post itself
- Sound like a real person, not a marketer
- No emojis unless it feels naturally Filipino
- WRITING REGISTER: ~70% English / ~30% Tagalog. The post body is English; Tagalog is reserved for emotional punches, hooks, gut-check moments, and short reactions ("hindi mo kasalanan", "diba", "yung feeling na…"). The character can BE Filipino without the prose BEING Tagalog. If a post reads as ~90% Tagalog, you have failed this rule.

Return ONLY a valid JSON object, no other text:
{
  "posts": [
    {
      "hook": "...",
      "value": "...",
      "cta": "...",
      "full_post": "hook + newline + value + newline + cta assembled as one post"
    }
  ]
}`

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 4000,
    })

    const content = completion.choices[0].message.content
    const result = JSON.parse(content || '{}')

    return NextResponse.json({ data: result.posts || result })
  } catch (error) {
    console.error('Content posts generation error:', error)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
