import { NextRequest, NextResponse } from 'next/server'
import { openai, AI_MODEL } from '@/lib/openai'
import { findBannedWords, buildCorrectionPrompt } from '@/lib/bannedWords'

// ─── MASTER SYSTEM PROMPT ────────────────────────────────────────────────────

const MASTER_SYSTEM_PROMPT = `You are an expert ebook writing assistant helping Filipino entrepreneurs and knowledge workers create their first digital product.

Your job is to write a high-quality, practical, entry-level non-fiction ebook for the Philippine digital products market.

WRITING RULES — follow these strictly:
- Write at an entry level. This is for beginners, not experts.
- Be practical and specific. Every lesson must have a clear "what to do."
- Do NOT use hype, exaggerated claims, or fake testimonials.
- Do NOT include advanced strategies — keep it simple and executable.
- Do NOT use academic or formal language. Write conversationally.
- VARY sentence length deliberately. Mix long explanatory sentences with punchy 3–6 word sentences. Short sentences land harder. Use them after important points.
- Use simple words.
- Clarity over cleverness. Done beats perfect.
- Use English as the primary language. Add light, natural Taglish warmth where a Filipino reader would feel immediately understood — never forced, just real.
- TITLES AND SUBTITLES must be 100% English — no Tagalog or Filipino words whatsoever.
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

Always return valid JSON only. No explanations outside JSON. No markdown fences.`

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
  chapter_type?: 'standard' | 'myth_truth' | 'case_study' | 'worksheet' | 'template'
}

interface PracticalStep {
  step_number: number
  title: string
  what_to_do: string
  why_it_matters: string
  common_mistake: string
}

interface QuickWin {
  name?: string
  goal: string
  instructions: string[]
  immediate_result: string
}

interface ChapterDraft {
  number: number
  title: string
  chapter_preview?: string
  quote: { text: string; author: string }
  story_starter: string
  core_lessons: string
  practical_steps: PracticalStep[]
  quick_win: QuickWin
  confidence_close: string
  references?: string[]
}

type Message = { role: 'user' | 'assistant'; content: string }

interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Standard call — returns parsed JSON only
async function callOpenAI(
  prompt: string,
  context: Message[] = [],
  maxTokens = 2500
): Promise<unknown> {
  const { result } = await callOpenAIWithUsage(prompt, context, maxTokens)
  return result
}

// Returns parsed JSON + token usage — used by chapter_section stage for test page
async function callOpenAIWithUsage(
  prompt: string,
  context: Message[] = [],
  maxTokens = 2500
): Promise<{ result: unknown; usage: TokenUsage }> {
  const messages = [
    { role: 'system' as const, content: MASTER_SYSTEM_PROMPT },
    ...context,
    { role: 'user' as const, content: prompt },
  ]

  const completion = await openai.chat.completions.create({
    model: AI_MODEL,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.78,
    max_tokens: maxTokens,
  })

  let content = completion.choices[0].message.content || '{}'
  const usage: TokenUsage = {
    prompt_tokens:      completion.usage?.prompt_tokens      ?? 0,
    completion_tokens:  completion.usage?.completion_tokens  ?? 0,
    total_tokens:       completion.usage?.total_tokens        ?? 0,
  }

  // Auto-correct banned words
  const bannedFound = findBannedWords(content)
  if (bannedFound.length > 0) {
    console.warn(`[ebook-agent] Banned words: ${bannedFound.join(', ')} — auto-correcting`)
    const correction = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        ...messages,
        { role: 'assistant' as const, content },
        { role: 'user' as const, content: buildCorrectionPrompt(content, bannedFound) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: maxTokens,
    })
    content = correction.choices[0].message.content || content
    usage.total_tokens += correction.usage?.total_tokens ?? 0
    usage.completion_tokens += correction.usage?.completion_tokens ?? 0
    usage.prompt_tokens += correction.usage?.prompt_tokens ?? 0
  }

  return { result: JSON.parse(content), usage }
}

// ─── OUTLINE PROMPT ───────────────────────────────────────────────────────────

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

STEP 3: Assign a chapter_type to each chapter to make the book feel dynamic and varied.
Use this distribution across the book (assign based on what fits the content best):
- "standard" — Story opener + core lessons + action steps (use for 3–4 chapters)
- "myth_truth" — Busts 3–5 common myths about the topic, then reveals the truth (use once, ideally early)
- "case_study" — Deep dive into one fictional but realistic character's full journey (use once)
- "worksheet" — Self-assessment or reflection exercises (use once)
- "template" — Ready-to-use scripts, templates, checklists (use once)

No two adjacent chapters should have the same type.

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
      "quick_win_outcome": "The specific thing the reader will be able to DO within 10 minutes",
      "chapter_type": "standard"
    }
  ]
}`
}

// ─── MULTI-PASS SECTION PROMPTS (standard chapters) ──────────────────────────

function pass0_PreviewPrompt(chapter: ChapterOutline): string {
  return `TASK: Chapter Preview for Chapter ${chapter.number} — "${chapter.title}"
Chapter goal: ${chapter.goal}
Quick win outcome: ${chapter.quick_win_outcome}

Write a short, punchy chapter preview — 2 to 3 sentences — that appears at the very opening of the chapter before the quote.
This is a promise to the reader about what they'll gain.

RULES:
- Be specific to this chapter's topic — not generic ("you'll learn a lot") but concrete ("you'll see exactly why X keeps happening, and the one shift that stops it")
- Reference both what they'll understand AND what they'll be able to do
- Write like a trusted friend who's about to show you something useful — not a table of contents entry
- Do NOT start with "In this chapter" or "You will learn" or "This chapter covers"
- Keep it energetic and personal — make them lean in

EXAMPLE TONE (for a dog care ebook, not your topic):
"Most dog owners treat the symptom. This chapter shows you the actual cycle — and why it keeps restarting without you knowing. By the end, you'll have a clear picture of what's really happening and a simple first step you can take today."

Return this exact JSON:
{
  "chapter_preview": "Your 2–3 sentence preview here"
}`
}

function pass1_QuotePrompt(chapter: ChapterOutline): string {
  return `TASK: Opening Quote for Chapter ${chapter.number} — "${chapter.title}"
Chapter goal: ${chapter.goal}

Find a powerful, relevant quote by a well-known public figure, author, entrepreneur, or thought leader that directly connects to this chapter's topic and goal.
- The quote must feel earned — not generic motivational filler
- Choose someone the Filipino reader would recognise (global figures are fine)
- The quote should feel like it was written for this exact moment in the reader's journey

Return this exact JSON:
{
  "quote": {
    "text": "The exact quote text here",
    "author": "Full Name, Title or Role (e.g. James Clear, Author of Atomic Habits)"
  }
}`
}

function pass2_StoryPrompt(project: Project, bookTitle: string, chapter: ChapterOutline): string {
  return `TASK: Story Starter for Chapter ${chapter.number} — "${chapter.title}"

Book: "${bookTitle}"
Target Market: ${project.target_market}
Problem: ${project.problem}
Chapter Goal: ${chapter.goal}

Write ONLY the Story Starter for this chapter. Do NOT teach yet — pure storytelling.

CINEMATIC TECHNIQUE — follow this exactly:
- Open in a specific moment, mid-scene. No preamble.
- Use a fictional but hyper-realistic Filipino character from the target market. Give them a full name and a concrete situation.
- VARY sentence length deliberately. Long sentences for building tension. Then short ones. Very short ones. One-word sentences if needed.
- Use real Taglish dialogue in quotation marks — the words people actually say to themselves or others.
- Show the pain through specific sensory detail — not "she was stressed" but what she saw, said, felt, or did.
- Include at least one moment of false hope followed by a harder fall. (e.g. They thought it was fixed. It wasn't.)
- End the story with a powerful realization line — something that flips their understanding.
- NEVER start the transition with "In this chapter" or generic openers.
- Transition to the lesson with something like: "Because here's what most [target market] don't realize:" or "That's the thing about [topic]."
- 300–500 words. No more. No padding.

Return this exact JSON:
{
  "story_starter": "Full story text here — use \\n\\n between paragraphs for line breaks"
}`
}

function pass3_LessonsPrompt(project: Project, chapter: ChapterOutline, storyContent: string): string {
  return `TASK: Core Lessons for Chapter ${chapter.number} — "${chapter.title}"

Target Market: ${project.target_market}
Problem: ${project.problem}
Chapter Goal: ${chapter.goal}

The Story Starter already written:
---
${storyContent}
---

Now write ONLY the Core Lessons section. This picks up where the story left off — teach what the story just made the reader feel.

STRUCTURE — every Core Lessons section MUST contain all four of the following, in this order:

1. THE UNCOMFORTABLE TRUTH (sub-section, ## heading required)
   - State something most people in this market don't want to hear but need to know
   - It must be specific to this chapter's topic — not a generic life lesson
   - It should make the reader pause. A little sting. The kind of thing they'll quote to someone else later.
   - Follow with 1–2 paragraphs that explain WHY this truth exists and what it costs them to keep ignoring it
   - Example heading: ## The Truth Nobody Tells You About [Topic]

2. THE ANCHOR EXAMPLE (woven into the next sub-section)
   - Introduce ONE named, specific Filipino character or scenario that illustrates the core concept
   - NOT a passing mention — this is the example the whole section builds around
   - Use real specifics: their name, job, city, the exact thing they did or said
   - Reference this same example again later in the section when making a key point
   - This is NOT the same character as the story starter — create a new one

3. THE CORE CONCEPT SUB-SECTIONS (1–2 more sub-sections, ## headings required)
   - Teach the main principles of this chapter using the anchor example as proof
   - Name at least one real tool, platform, or resource per sub-section
   - Include at least one data point or real-world statistic to build credibility

4. THE MISTAKE EVERYONE MAKES (final sub-section, ## heading required)
   - Dedicate a full sub-section to THE ONE MISTAKE that undoes everything else in this chapter
   - This is the chapter-level mistake — bigger and more important than the per-step mistakes later
   - State it bluntly. Name it. Then explain exactly why it happens and how to avoid it.
   - Example heading: ## The Mistake That Erases All Your Progress

WRITING RULES:
- Write like you're explaining to a smart friend. Not a textbook.
- Each sub-section: 150–250 words.
- Total: 700–1000 words.

FORMAT RULE: Every sub-heading must use ## at the start of the line:
## The Truth Nobody Tells You About [Topic]

Return this exact JSON:
{
  "core_lessons": "## The Truth...\\n\\nContent here...\\n\\n## The Anchor Example heading...\\n\\nContent...\\n\\n## Core concept heading...\\n\\nContent...\\n\\n## The Mistake Everyone Makes\\n\\nContent..."
}`
}

function pass4_StepsPrompt(project: Project, chapter: ChapterOutline, storyContent: string, lessonsContent: string): string {
  return `TASK: Practical Steps for Chapter ${chapter.number} — "${chapter.title}"

Target Market: ${project.target_market}
Chapter Goal: ${chapter.goal}

Already written — Story:
---
${storyContent.slice(0, 400)}...
---
Already written — Core Lessons (summary):
---
${lessonsContent.slice(0, 600)}...
---

Now write ONLY the Practical Steps. These must flow naturally from the lessons above.

RULES:
- 4–5 steps (never fewer, never more)
- Each step must be specific enough that the reader can do it WITHOUT googling anything extra
- Name actual tools, platforms, apps, websites, or scripts where relevant (e.g. "Open Canva at canva.com", "Go to Facebook Creator Studio", "Use Google Docs at docs.google.com")
- what_to_do: the exact action, written like a clear instruction
- why_it_matters: one sentence, honest and direct — not motivational filler
- common_mistake: the specific thing beginners always get wrong here — be blunt

Return this exact JSON:
{
  "practical_steps": [
    {
      "step_number": 1,
      "title": "Step title here",
      "what_to_do": "Exact, specific instruction naming real tools and actions",
      "why_it_matters": "One honest sentence about why this step matters",
      "common_mistake": "The one thing beginners always get wrong at this step"
    }
  ]
}`
}

function pass5_QuickWinPrompt(chapter: ChapterOutline): string {
  return `TASK: Quick Win for Chapter ${chapter.number} — "${chapter.title}"
Quick Win Outcome: ${chapter.quick_win_outcome}

Design a named, step-by-step Quick Win the reader can complete TODAY in 10–15 minutes.

RULES:
- Give it a catchy, specific name (e.g. "The 24-Hour Parasite Reset Starter", "The 10-Minute Niche Clarity Test")
- 7–9 numbered steps — specific enough to follow without any extra research
- Each step is one clear action, 1–2 sentences max
- Steps must build on each other — completing one makes the next easier
- The immediate_result must describe a tangible, visible thing the reader will HAVE when done
- Tone: energetic but practical — not a pep talk, a protocol

Return this exact JSON:
{
  "quick_win": {
    "name": "Catchy name for this Quick Win",
    "goal": "One sentence: what the reader will accomplish",
    "instructions": [
      "Step instruction here — specific, clear, no vague verbs",
      "Next step here"
    ],
    "immediate_result": "The specific, tangible thing they will have or see when they finish all steps"
  }
}`
}

function pass6_ClosePrompt(chapter: ChapterOutline, nextChapter: ChapterOutline | null): string {
  const nextRef = nextChapter
    ? `The NEXT chapter is Chapter ${nextChapter.number}: "${nextChapter.title}" — which covers: ${nextChapter.goal}`
    : 'This is the final chapter.'

  return `TASK: Confidence Close for Chapter ${chapter.number} — "${chapter.title}"

${nextRef}

Write ONLY the Confidence Close and references. This is the last thing the reader sees before turning the page.

RULES:
- 2–3 short paragraphs only
- Paragraph 1: Reinforce that the reader CAN do what this chapter taught — tie it to one specific action from the Practical Steps or Quick Win
- Paragraph 2: Remove the most common self-doubt they feel right now. Be specific — name the doubt, then dismantle it with a real reason
- Final sentence: A teaser for the next chapter that creates genuine curiosity. Reference the EXACT next chapter title. NOT "In the next chapter we will discuss..." — something more alive, like: "The next piece? It's the one most people skip — and it's why Chapter ${nextChapter ? nextChapter.number : ''} exists."
- Do NOT use generic motivation ("You've got this!", "Believe in yourself")
- If this chapter mentioned any specific books, studies, articles, or named authors, list them in references. Otherwise return [].

Return this exact JSON:
{
  "confidence_close": "Full closing text here — use \\n\\n between paragraphs",
  "references": []
}`
}

// ─── SINGLE-PASS CHAPTER PROMPT (non-standard types) ─────────────────────────

function singlePassChapterPrompt(project: Project, bookTitle: string, chapter: ChapterOutline, allChapters: ChapterOutline[]): string {
  const chapterList = allChapters.map(c => `Chapter ${c.number}: ${c.title}`).join('\n')
  const type = chapter.chapter_type || 'standard'

  const header = `STAGE: CHAPTER DRAFT

Book: "${bookTitle}"
Target Market: ${project.target_market}
Problem: ${project.problem}
Unique Mechanism: ${project.unique_mechanism}

Full Chapter List (for context — do NOT repeat content from other chapters):
${chapterList}

NOW WRITE: Chapter ${chapter.number} — "${chapter.title}"
Chapter Goal: ${chapter.goal}
Quick Win Outcome: ${chapter.quick_win_outcome}
Chapter Type: ${type}

OPENING QUOTE: Find a powerful, relevant quote by a well-known public figure that directly connects to this chapter's topic.`

  const quickWinRule = `
QUICK WIN (completable in 10–15 minutes)
Give it a catchy specific name. Design 7–9 concrete steps the reader can do right now.
State the goal clearly. Each instruction must be specific enough to follow without googling.
Describe the immediate tangible result they will have when done.`

  const closingRule = `
CONFIDENCE CLOSE (2–3 short paragraphs)
- Reinforce that the reader CAN do this — tie it to a specific action they just learned
- Remove the most common self-doubt they might feel right now — name it, then dismantle it
- End with a teaser sentence for the next chapter that creates genuine curiosity
- Do NOT use generic motivation`

  const jsonTemplate = `
Return this exact JSON:
{
  "number": ${chapter.number},
  "title": "${chapter.title}",
  "quote": { "text": "...", "author": "Full Name, Title" },
  "story_starter": "...",
  "core_lessons": "## Sub-heading\\n\\nContent...\\n\\n## Sub-heading\\n\\nContent...",
  "practical_steps": [
    {
      "step_number": 1,
      "title": "Step title",
      "what_to_do": "Exact specific instruction naming real tools",
      "why_it_matters": "One honest sentence",
      "common_mistake": "What beginners get wrong"
    }
  ],
  "quick_win": {
    "name": "Catchy Quick Win name",
    "goal": "What the reader will accomplish",
    "instructions": ["Specific step", "Next step"],
    "immediate_result": "The tangible thing they will have when done"
  },
  "confidence_close": "...",
  "references": []
}`

  if (type === 'myth_truth') {
    return `${header}

This is a MYTH vs. TRUTH chapter.

SECTION 1 — OPENING HOOK (150–200 words): A punchy challenge to a widely-held wrong assumption. No story. Direct and confident.

SECTION 2 — MYTH vs. TRUTH (800–1000 words): Present exactly 4 myths with their truths. For each:
- MYTH: State it as confidently as most people believe it
- THE TRUTH: Flip it with a specific, evidence-backed truth
- WHY IT MATTERS: Real-world consequence of believing the myth
- Include a real industry example, statistic, or named tool per myth

Use ## Heading format for each myth heading.

SECTION 3 — PRACTICAL STEPS (4–5 steps): Specific steps to act on the truths revealed.
${quickWinRule}
${closingRule}
${jsonTemplate}`
  }

  if (type === 'case_study') {
    return `${header}

This is a CASE STUDY chapter.

SECTION 1 — MEET THE CHARACTER (200–300 words): Fictional but hyper-realistic Filipino character. Full name, age, job, location, specific situation. Show the struggle in visceral detail.

SECTION 2 — THE TURNING POINT (200–300 words): What they tried first. What failed. What they finally discovered. Tie to the unique mechanism: ${project.unique_mechanism}

SECTION 3 — STEP-BY-STEP BREAKDOWN (500–700 words): Exactly what they did, with specific tools and timeline. Include one setback they overcame.

SECTION 4 — RESULTS + LESSON (200–300 words): Concrete specific result (use numbers). The single most important lesson.

SECTION 5 — PRACTICAL STEPS (4–5 steps): Exact steps to replicate what the character did.
${quickWinRule}
${closingRule}
${jsonTemplate}`
  }

  if (type === 'worksheet') {
    return `${header}

This is a WORKSHEET chapter.

SECTION 1 — OPENING REFRAME (150–200 words): Why most people skip self-assessment and what it costs them.

SECTION 2 — THE SELF-ASSESSMENT (600–800 words): A practical self-assessment tool — scored quiz, diagnostic checklist, or fill-in-the-blank reflection. Provide interpretation guide.

SECTION 3 — WHAT YOUR RESULTS MEAN (300–400 words): Walk through main result categories with specific actionable guidance and tools for each.

SECTION 4 — PRACTICAL STEPS (4–5 steps): Based on what readers discovered.
${quickWinRule}
${closingRule}
${jsonTemplate}`
  }

  if (type === 'template') {
    return `${header}

This is a TEMPLATE chapter.

SECTION 1 — WHY TEMPLATES MATTER (150–200 words): The pain of starting from blank. This chapter fixes that.

SECTION 2 — THE TEMPLATES (700–1000 words): 3–4 ready-to-use templates, scripts, or checklists. For each: name, when/how to use it, full template with [BRACKETS], one filled-in example.

SECTION 3 — HOW TO CUSTOMIZE (200–300 words): 3–5 tips for adapting templates to their own voice. Common mistakes when using templates.

SECTION 4 — PRACTICAL STEPS (4–5 steps): Walk through using one template right now.
${quickWinRule}
${closingRule}
${jsonTemplate}`
  }

  // Fallback standard (shouldn't reach here normally)
  return `${header}

SECTION 1 — STORY STARTER (300–500 words): Cinematic. Short punchy sentences for impact. Real Taglish dialogue. Named Filipino character.
SECTION 2 — CORE LESSONS (600–900 words): 3–4 sub-sections with ## headings. Specific examples and tools.
SECTION 3 — PRACTICAL STEPS (4–5 steps).
${quickWinRule}
${closingRule}
${jsonTemplate}`
}

// ─── MULTI-PASS GENERATOR (standard chapters) ────────────────────────────────

async function generateStandardChapterMultiPass(
  project: Project,
  bookTitle: string,
  chapter: ChapterOutline,
  allChapters: ChapterOutline[]
): Promise<ChapterDraft> {
  const nextChapter = allChapters.find(c => c.number === chapter.number + 1) ?? null

  console.log(`[ebook-agent] Chapter ${chapter.number} multi-pass — starting`)

  // Pass 0 + Pass 1 in parallel (both are independent)
  const [previewData, quoteData] = await Promise.all([
    callOpenAI(pass0_PreviewPrompt(chapter), [], 300) as Promise<{ chapter_preview: string }>,
    callOpenAI(pass1_QuotePrompt(chapter), [], 400) as Promise<{ quote: { text: string; author: string } }>,
  ])
  console.log(`[ebook-agent] Chapter ${chapter.number} — preview + quote done`)

  // Pass 2: Story Starter
  const storyData = await callOpenAI(pass2_StoryPrompt(project, bookTitle, chapter), [], 1500) as {
    story_starter: string
  }
  console.log(`[ebook-agent] Chapter ${chapter.number} — story done`)

  // Pass 3: Core Lessons (story as context)
  const lessonsData = await callOpenAI(
    pass3_LessonsPrompt(project, chapter, storyData.story_starter),
    [{ role: 'assistant', content: JSON.stringify(storyData) }],
    3000
  ) as { core_lessons: string }
  console.log(`[ebook-agent] Chapter ${chapter.number} — lessons done`)

  // Pass 4: Practical Steps (story + lessons as context)
  const stepsData = await callOpenAI(
    pass4_StepsPrompt(project, chapter, storyData.story_starter, lessonsData.core_lessons),
    [
      { role: 'assistant', content: JSON.stringify(storyData) },
      { role: 'assistant', content: JSON.stringify(lessonsData) },
    ],
    2000
  ) as { practical_steps: PracticalStep[] }
  console.log(`[ebook-agent] Chapter ${chapter.number} — steps done`)

  // Pass 5: Quick Win
  const quickWinData = await callOpenAI(pass5_QuickWinPrompt(chapter), [], 1500) as {
    quick_win: QuickWin
  }
  console.log(`[ebook-agent] Chapter ${chapter.number} — quick win done`)

  // Pass 6: Confidence Close (story + lessons as context, next chapter ref)
  const closeData = await callOpenAI(
    pass6_ClosePrompt(chapter, nextChapter),
    [
      { role: 'assistant', content: JSON.stringify(storyData) },
      { role: 'assistant', content: JSON.stringify(lessonsData) },
    ],
    900
  ) as { confidence_close: string; references: string[] }
  console.log(`[ebook-agent] Chapter ${chapter.number} — close done`)

  return {
    number:           chapter.number,
    title:            chapter.title,
    chapter_preview:  previewData.chapter_preview,
    quote:            quoteData.quote,
    story_starter:    storyData.story_starter,
    core_lessons:     lessonsData.core_lessons,
    practical_steps:  stepsData.practical_steps,
    quick_win:        quickWinData.quick_win,
    confidence_close: closeData.confidence_close,
    references:       closeData.references ?? [],
  }
}

// ─── INTRODUCTION & CONCLUSION PROMPTS ───────────────────────────────────────

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

STEP 2 — FLIP IT WITH A CONTRARIAN INSIGHT:
"Most people think [X]… but the real reason is [Y]."
- Simple and relatable
- Slightly surprising
- Easy to understand in 5 seconds
- Emotionally gripping — the reader should feel "Wait… that's ME."

STEP 3 — BUILD THE INTRODUCTION WITH THIS EXACT STRUCTURE:
1. HOOK — Open mid-scene. No "In this book…" or "Welcome to…"
2. VALIDATION — Why this problem feels hard and why it's NOT their fault
3. BIG IDEA REVEAL — "Most people think X… but the truth is Y."
4. MECHANISM BRIDGE — Introduce the unique mechanism as a discovery, not a feature
5. THE PROMISE — Specific, believable result — not "your life will change"
6. THE CALL TO START — Warm, energizing push to begin RIGHT NOW

WRITING RULES:
- Short paragraphs (2–4 sentences max, then vary with single punchy lines)
- Conversational — trusted friend explaining something life-changing
- Light natural Taglish where a Filipino reader would feel seen
- NEVER use hype, fake promises, or clichés

Return this exact JSON:
{
  "introduction": "Full introduction text — 4 to 6 paragraphs — use \\n\\n between paragraphs"
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
4. Gives a clear, specific final call to action — what to do TODAY
5. Ends with a memorable line that captures the spirit of the entire book

Keep it short and punchy — 2 to 3 paragraphs. Make the last sentence count.

Return this exact JSON:
{
  "conclusion": "Full conclusion text here — use \\n\\n between paragraphs"
}`
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
        const result = await callOpenAI(outlinePrompt(project), [], 2000) as {
          title_options: TitleOption[]
          recommended: number
          chapters: ChapterOutline[]
        }
        return NextResponse.json({ stage, data: result })
      }

      // Stage 2: Write a single chapter
      // Standard chapters use multi-pass (6 focused API calls).
      // Specialty types (myth_truth, case_study, worksheet, template) use a single improved call.
      case 'chapter': {
        const bookTitle    = data.book_title as string
        const chapter      = data.chapter as ChapterOutline
        const allChapters  = data.all_chapters as ChapterOutline[]
        const chapterType  = chapter.chapter_type ?? 'standard'

        let result: ChapterDraft

        if (chapterType === 'standard') {
          result = await generateStandardChapterMultiPass(project, bookTitle, chapter, allChapters)
        } else {
          result = await callOpenAI(
            singlePassChapterPrompt(project, bookTitle, chapter, allChapters),
            [],
            4500
          ) as ChapterDraft
        }

        return NextResponse.json({ stage, data: result })
      }

      // Stage 3: Book introduction
      case 'introduction': {
        const bookTitle    = data.book_title as string
        const bookSubtitle = data.book_subtitle as string
        const chapters     = data.chapters as ChapterOutline[]
        const result = await callOpenAI(introductionPrompt(project, bookTitle, bookSubtitle, chapters), [], 1800) as { introduction: string }
        return NextResponse.json({ stage, data: result })
      }

      // Stage 4: Book conclusion
      case 'conclusion': {
        const bookTitle = data.book_title as string
        const chapters  = data.chapters as ChapterOutline[]
        const result = await callOpenAI(conclusionPrompt(project, bookTitle, chapters), [], 1000) as { conclusion: string }
        return NextResponse.json({ stage, data: result })
      }

      // Stage: Single chapter section — for test page step-by-step mode with token reporting
      case 'chapter_section': {
        const section      = data.section as string
        const bookTitle    = data.book_title as string
        const chapter      = data.chapter as ChapterOutline
        const allChapters  = data.all_chapters as ChapterOutline[]
        const ctxStory     = data.ctx_story     as string | undefined
        const ctxLessons   = data.ctx_lessons   as string | undefined

        const nextChapter  = allChapters.find(c => c.number === chapter.number + 1) ?? null

        let prompt: string
        let maxTokens: number
        let context: Message[] = []

        switch (section) {
          case 'preview':
            prompt    = pass0_PreviewPrompt(chapter)
            maxTokens = 300
            break
          case 'quote':
            prompt    = pass1_QuotePrompt(chapter)
            maxTokens = 400
            break
          case 'story':
            prompt    = pass2_StoryPrompt(project, bookTitle, chapter)
            maxTokens = 1500
            break
          case 'lessons':
            prompt    = pass3_LessonsPrompt(project, chapter, ctxStory ?? '')
            maxTokens = 3000
            context   = ctxStory ? [{ role: 'assistant', content: JSON.stringify({ story_starter: ctxStory }) }] : []
            break
          case 'steps':
            prompt    = pass4_StepsPrompt(project, chapter, ctxStory ?? '', ctxLessons ?? '')
            maxTokens = 2000
            context   = [
              ...(ctxStory   ? [{ role: 'assistant' as const, content: JSON.stringify({ story_starter: ctxStory }) }] : []),
              ...(ctxLessons ? [{ role: 'assistant' as const, content: JSON.stringify({ core_lessons: ctxLessons }) }] : []),
            ]
            break
          case 'quickwin':
            prompt    = pass5_QuickWinPrompt(chapter)
            maxTokens = 1500
            break
          case 'close':
            prompt    = pass6_ClosePrompt(chapter, nextChapter)
            maxTokens = 900
            context   = [
              ...(ctxStory   ? [{ role: 'assistant' as const, content: JSON.stringify({ story_starter: ctxStory }) }] : []),
              ...(ctxLessons ? [{ role: 'assistant' as const, content: JSON.stringify({ core_lessons: ctxLessons }) }] : []),
            ]
            break
          default:
            return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 })
        }

        const { result, usage } = await callOpenAIWithUsage(prompt, context, maxTokens)
        return NextResponse.json({ stage, section, data: result, usage })
      }

      default:
        return NextResponse.json({ error: `Unknown stage: ${stage}` }, { status: 400 })
    }

  } catch (error) {
    console.error('Ebook agent error:', error)
    return NextResponse.json({ error: 'Agent failed. Please try again.' }, { status: 500 })
  }
}
