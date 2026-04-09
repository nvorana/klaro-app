import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { findBannedWords, buildCorrectionPrompt } from '@/lib/bannedWords'

// ─── MASTER SYSTEM PROMPT ────────────────────────────────────────────────────
// Based on Coach Jon Oraña's Negosyo University OPIS workshop methodology

const MASTER_SYSTEM_PROMPT = `You are an expert ebook writing assistant helping Filipino entrepreneurs and knowledge workers create their first digital product.

Your job is to write a high-quality, practical, entry-level non-fiction ebook for the Philippine digital products market.

WRITING RULES — follow these strictly:
- Write at an entry level. This is for beginners, not experts.
- Be practical and specific. Every lesson must have a clear "what to do."
- Do NOT use hype, exaggerated claims, or fake testimonials.
- Do NOT include advanced strategies — keep it simple and executable.
- Do NOT use academic or formal language. Write conversationally.
- Use short paragraphs. Maximum 3 sentences per paragraph. After every 3 sentences, start a new paragraph with a blank line.
- Use simple words.
- Clarity over cleverness. Done beats perfect.
- Use English as the primary language. Add light, natural Taglish warmth where a Filipino reader would feel immediately understood — never forced, just real.
- TITLES AND SUBTITLES must be 100% English — no Tagalog or Filipino words whatsoever. Titles are product names and must be universally marketable.
- Chapter titles must also be 100% English.
- Body content and examples may use natural conversational Taglish where it adds warmth.

WHAT READERS BUY: People don't buy information. They buy relief. They buy clarity, speed, and confidence. Every section must make the reader feel: "I can do this."

BANNED WORDS — Never use these in any output, including titles, chapter names, and body text:
HARD BAN: unlock, unleash, discover, transform your life, revolutionize, ultimate guide, game-changing, next-level, powerful secrets, tap into, harness, ignite, amplify, supercharge
SOFT BAN (avoid unless truly necessary): maximize, optimize, elevate, breakthrough, leverage
These words make content sound AI-generated and feel out of touch to a Filipino reader.
Write like a practical friend — not a TED Talk, not a LinkedIn post.
❌ AI style: "Unlock your full potential with this powerful method."
✅ Market style: "Ganito mo magagawa ito… kahit busy ka pa."

CONTENT RULES:
- Each chapter must have a Story Starter that makes readers feel seen immediately
- Core Lessons must have no more than 3–5 principles per chapter (never overwhelm)
- Quick Wins must be completable in 5–10 minutes — they build confidence
- Closing must end with forward momentum, not generic motivation
- The whole ebook should feel like a trusted friend explaining something, not a textbook

Always return valid JSON only. No explanations outside JSON. No markdown fences.`

// ─── STAGE PROMPTS ───────────────────────────────────────────────────────────

function outlinePrompt(project: Project): string {
  return `STAGE: OUTLINE

You are helping create an ebook based on this clarity sentence:
- Target Market: ${project.target_market}
- Problem they face: ${project.problem}
- Unique solution/mechanism: ${project.unique_mechanism}

STEP 1: Generate 3 compelling title options for this ebook.
- Titles must be specific, not generic
- They should communicate a clear, tangible outcome
- They should appeal to a Filipino beginner audience

STEP 2: Create a table of contents with 8 to 10 chapters. Choose the number that best fits the depth of the topic — not too thin, not padded.
- Each chapter title must be nice, cute, succinct, witty, and attention-grabbing — make the reader excited to open it
- Avoid generic titles like "Introduction to X" or "Understanding Y" — every title should have personality and spark curiosity
- Each chapter must have a clear goal (what the reader will learn)
- Each chapter must have a quick win outcome (what the reader will be able to DO immediately after)
- Chapters must flow logically — each one builds on the previous
- Chapter 1 should address the biggest mindset block first
- The final chapter should leave the reader ready to take their first real action

Return this exact JSON:
{
  "title_options": [
    { "option": 1, "title": "...", "subtitle": "..." },
    { "option": 2, "title": "...", "subtitle": "..." },
    { "option": 3, "title": "...", "subtitle": "..." }
  ],
  "recommended": 1,
  "chapters": [
    {
      "number": 1,
      "title": "Chapter title",
      "goal": "What the reader will understand after this chapter",
      "quick_win_outcome": "The specific thing the reader will be able to DO within 10 minutes of finishing this chapter"
    }
  ]
}`
}

function chapterPrompt(project: Project, bookTitle: string, chapter: ChapterOutline, allChapters: ChapterOutline[]): string {
  const chapterList = allChapters.map(c => `Chapter ${c.number}: ${c.title}`).join('\n')

  return `STAGE: CHAPTER DRAFT

Book: "${bookTitle}"
Target Market: ${project.target_market}
Problem: ${project.problem}
Unique Mechanism: ${project.unique_mechanism}

Full Chapter List (for context — do NOT repeat content from other chapters):
${chapterList}

NOW WRITE: Chapter ${chapter.number} — "${chapter.title}"
Chapter Goal: ${chapter.goal}
Quick Win Outcome: ${chapter.quick_win_outcome}

Write this chapter using the QUOTE and all 5 sections below. Follow the word count and rules for each section.

OPENING QUOTE
Find a powerful, relevant quote by a well-known public figure, author, entrepreneur, or thought leader that directly connects to this chapter's topic.
- The quote must feel earned — not generic motivational filler
- Choose someone the Filipino reader would recognise (global figures are fine)
- The quote should make the reader pause and think before they even start reading
- Return both the quote text and the person's name + short title (e.g. "Richard Branson, Founder of Virgin Group")

SECTION 1 — STORY STARTER (300–500 words)
Write a relatable, vivid story about someone from the target market dealing with the exact topic of this chapter.
- Use a fictional but realistic Filipino character (give them a name and a specific situation)
- Show the struggle in detail — make the reader feel seen
- End with a natural transition into the lesson: "That's exactly what this chapter is about."
- Do NOT teach yet. Just tell the story.

SECTION 2 — CORE LESSONS (800–1200 words)
Teach the core concept of this chapter.
- Maximum 3–5 principles or key ideas (never more)
- For each principle: explain it clearly, give a small relatable Filipino example, use a simple metaphor if helpful
- Write like you're explaining to a smart friend, not a student
- Avoid jargon. If you use a term, explain it immediately.

SECTION 3 — PRACTICAL STEPS (3–5 steps)
Give the reader a clear, step-by-step action plan.
- Each step: what to do + why it matters + one common mistake to avoid
- Steps must be specific enough that a beginner can follow them without asking questions
- Number the steps clearly

SECTION 4 — QUICK WIN (completable in 5–10 minutes)
Design ONE mini-exercise the reader can complete right now.
- State the goal of the exercise clearly
- Give step-by-step instructions (short and simple)
- Describe the immediate result they will get
- This must build confidence — it should feel easy and rewarding to complete

SECTION 5 — CONFIDENCE CLOSE (1–2 short paragraphs)
Close the chapter with warmth and forward momentum.
- Reinforce that the reader CAN do this — but tie it to the specific action they just learned
- Remove the most common self-doubt they might feel right now
- End with one sentence that creates anticipation for the next chapter
- Do NOT use generic motivation ("You've got this!", "Believe in yourself")

Return this exact JSON:
{
  "number": ${chapter.number},
  "title": "${chapter.title}",
  "quote": { "text": "The quote text here", "author": "Full Name, Title or Role" },
  "story_starter": "Full story starter text here",
  "core_lessons": "Full core lessons text here",
  "practical_steps": [
    {
      "step_number": 1,
      "title": "Step title",
      "what_to_do": "Exact instruction",
      "why_it_matters": "Brief explanation",
      "common_mistake": "The one thing beginners get wrong here"
    }
  ],
  "quick_win": {
    "goal": "What the reader will accomplish",
    "instructions": ["Step 1", "Step 2", "Step 3"],
    "immediate_result": "What they will have at the end of this exercise"
  },
  "confidence_close": "Full closing text here"
}`
}

function introductionPrompt(project: Project, bookTitle: string, bookSubtitle: string, chapters: ChapterOutline[]): string {
  const chapterList = chapters.map(c => `Chapter ${c.number}: ${c.title} — ${c.goal}`).join('\n')

  return `STAGE: BOOK INTRODUCTION

Act as a best-selling non-fiction author and direct response copywriter.

Book: "${bookTitle}: ${bookSubtitle}"
Target Market: ${project.target_market}
Problem: ${project.problem}
Unique Solution/Mechanism: ${project.unique_mechanism}
Chapters covered:
${chapterList}

YOUR TASK: Write a powerful, emotionally compelling book introduction built around a BIG IDEA hook.

STEP 1 — IDENTIFY THE WRONG BELIEF:
Find the #1 wrong belief that most people in "${project.target_market}" have about solving "${project.problem}".
This is the thing they've been told — or assume — that is actually holding them back.

STEP 2 — FLIP IT WITH A CONTRARIAN INSIGHT:
Use this structure: "Most people think [X]… but the real reason is [Y]."
Make it:
- Simple and relatable
- Slightly surprising
- Easy to understand in 5 seconds
- Emotionally gripping — the reader should feel "Wait… that's ME."

STEP 3 — BUILD THE INTRODUCTION USING THIS EXACT STRUCTURE:
1. HOOK — Open with a vivid, relatable question or scenario the target market immediately recognizes. Do NOT start with "In this book…" or "Welcome to…" or any generic opener.
2. VALIDATION — Acknowledge why this problem feels so hard and why it's NOT their fault
3. THE BIG IDEA REVEAL — Deliver the contrarian insight: "Most people think X… but the truth is Y." This is the turning point of the introduction.
4. THE MECHANISM BRIDGE — Introduce the unique mechanism (${project.unique_mechanism}) as the solution to the wrong belief. Make it feel like a discovery, not a feature.
5. THE PROMISE — State clearly and specifically what changes for them if they read and apply this book. Be specific — not "your life will change" but a concrete, believable result.
6. THE CALL TO START — End with a warm, energizing push to begin RIGHT NOW, not someday.

WRITING RULES:
- Use short paragraphs (2–4 sentences max per paragraph)
- Write conversationally — like a trusted friend explaining something life-changing
- Add light, natural Taglish warmth where a Filipino reader would feel immediately seen — never forced
- NEVER use hype, fake promises, or clichés like "life-changing," "revolutionary," or "game-changer"
- NO academic openers. NO "This book will teach you…" style intros.
- Clarity and emotion over cleverness. Done beats perfect.

EXAMPLE TONE (dog training ebook, for reference only):
"Have you ever wondered why your dog doesn't listen… kahit ilang beses mo na tinuro?
It's not because your dog is stubborn. And it's definitely not because you're a bad owner.
Here's the truth most people don't realize: Most dog owners fail not because they lack time… but because they're speaking a language their dog doesn't understand.
You're trying to teach commands. But your dog? They don't understand commands. They understand patterns.
And once you see this… everything changes."

Apply the same structure and emotional tension to THIS book's topic, market, and mechanism.

Return this exact JSON:
{
  "introduction": "Full introduction text here — 4 to 6 paragraphs following the 6-step structure above"
}`
}

function conclusionPrompt(project: Project, bookTitle: string, chapters: ChapterOutline[]): string {
  const chapterList = chapters.map(c => `Chapter ${c.number}: ${c.title}`).join('\n')

  return `STAGE: BOOK CONCLUSION

Book: "${bookTitle}"
Target Market: ${project.target_market}
Chapters:
${chapterList}

Write a powerful book conclusion that:
1. Reminds the reader of where they started (the struggle they came in with)
2. Celebrates how much ground they've covered — make them feel proud
3. Reframes the journey ahead as exciting, not overwhelming
4. Gives a clear, specific final call to action — what to do TODAY with what they've learned
5. Ends with a memorable line that captures the spirit of the entire book

Keep it short and punchy — 2 to 3 paragraphs. This is the last thing they read. Make it count.

Return this exact JSON:
{
  "conclusion": "Full conclusion text here"
}`
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Project {
  target_market: string
  problem: string
  unique_mechanism: string
}

interface TitleOption {
  option: number
  title: string
  subtitle: string
}

interface ChapterOutline {
  number: number
  title: string
  goal: string
  quick_win_outcome: string
}

interface PracticalStep {
  step_number: number
  title: string
  what_to_do: string
  why_it_matters: string
  common_mistake: string
}

interface QuickWin {
  goal: string
  instructions: string[]
  immediate_result: string
}

interface ChapterDraft {
  number: number
  title: string
  quote: { text: string; author: string }
  story_starter: string
  core_lessons: string
  practical_steps: PracticalStep[]
  quick_win: QuickWin
  confidence_close: string
}

// ─── HELPER ──────────────────────────────────────────────────────────────────

async function callOpenAI(prompt: string, maxTokens = 2500): Promise<unknown> {
  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: MASTER_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.75,
    max_tokens: maxTokens,
  })

  let content = completion.choices[0].message.content || '{}'

  // ── Post-generation banned word scan ────────────────────────────────────────
  // If the AI slipped any banned words into its output, auto-correct before
  // returning to the user. One silent correction pass — invisible to the user.
  const bannedFound = findBannedWords(content)
  if (bannedFound.length > 0) {
    console.warn(`[ebook-agent] Banned words found: ${bannedFound.join(', ')} — running auto-correction`)
    const correctionCompletion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: MASTER_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
        { role: 'assistant', content: content },
        { role: 'user', content: buildCorrectionPrompt(content, bannedFound) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: maxTokens,
    })
    content = correctionCompletion.choices[0].message.content || content
  }

  return JSON.parse(content)
}

// ─── ROUTE ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stage, project, data } = body as {
      stage: string
      project: Project
      data: Record<string, unknown>
    }

    if (!stage || !project) {
      return NextResponse.json({ error: 'Missing stage or project' }, { status: 400 })
    }

    // Guard: excluded markets
    const excluded = /(college student|fresh grad|jobless|unemployed|walang trabaho|no job|wala pang trabaho)/i
    if (excluded.test(project.target_market)) {
      return NextResponse.json({
        error: 'excluded_market',
        message: 'KLARO is designed for working professionals and business owners. Please refine your target market.'
      }, { status: 422 })
    }

    switch (stage) {

      // Stage 1: Generate title options + chapter outline
      case 'outline': {
        const result = await callOpenAI(outlinePrompt(project), 2000) as {
          title_options: TitleOption[]
          recommended: number
          chapters: ChapterOutline[]
        }
        return NextResponse.json({ stage, data: result })
      }

      // Stage 2: Write a single chapter (called once per chapter)
      case 'chapter': {
        const bookTitle = data.book_title as string
        const chapter = data.chapter as ChapterOutline
        const allChapters = data.all_chapters as ChapterOutline[]
        const result = await callOpenAI(chapterPrompt(project, bookTitle, chapter, allChapters), 3000) as ChapterDraft
        return NextResponse.json({ stage, data: result })
      }

      // Stage 3: Write the book introduction
      case 'introduction': {
        const bookTitle = data.book_title as string
        const bookSubtitle = data.book_subtitle as string
        const chapters = data.chapters as ChapterOutline[]
        const result = await callOpenAI(introductionPrompt(project, bookTitle, bookSubtitle, chapters), 1500) as { introduction: string }
        return NextResponse.json({ stage, data: result })
      }

      // Stage 4: Write the book conclusion
      case 'conclusion': {
        const bookTitle = data.book_title as string
        const chapters = data.chapters as ChapterOutline[]
        const result = await callOpenAI(conclusionPrompt(project, bookTitle, chapters), 1000) as { conclusion: string }
        return NextResponse.json({ stage, data: result })
      }

      default:
        return NextResponse.json({ error: `Unknown stage: ${stage}` }, { status: 400 })
    }

  } catch (error) {
    console.error('Ebook agent error:', error)
    return NextResponse.json({ error: 'Agent failed. Please try again.' }, { status: 500 })
  }
}
