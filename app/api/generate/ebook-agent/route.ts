import { NextRequest, NextResponse } from 'next/server'
import { openai, EBOOK_MODEL, samplingParams, tokenLimit } from '@/lib/openai'
import { logAiUsage } from '@/lib/aiUsage'
import { findBannedWords, buildCorrectionPrompt } from '@/lib/bannedWords'
import { buildVocabularyHint } from '@/lib/preferredVocabulary'
import { getMarketLanguageHintForUser } from '@/lib/marketLanguage'
import { editChapter, type ChapterShape } from '@/lib/ebookEditor'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/apiAuth'

// A standard chapter is six sequential model calls plus the editor pass. On
// gpt-5.6-sol each call takes ~15-40s, so a chapter can run 2+ minutes.
export const maxDuration = 300

// ─── MASTER SYSTEM PROMPT ────────────────────────────────────────────────────

const MASTER_SYSTEM_PROMPT = `You are an expert ebook writing assistant helping Filipino creators turn their knowledge into a sellable digital product (ebook).

Your job is to write a high-quality, practical, entry-level non-fiction ebook for whatever specific Filipino audience the creator is serving — that audience is defined by the target_market and problem provided in the project context, and may be anyone from students to OFWs to working parents to retirees to hobbyists.

WRITING RULES — follow these strictly:
- Write at an entry level. This is for beginners, not experts.
- Be practical and specific. Every lesson must have a clear "what to do."
- Do NOT use hype, exaggerated claims, or fake testimonials.
- Do NOT include advanced strategies — keep it simple and executable.
- Never invent statistics, studies, surveys, quotes, or the author's personal experiences. Use a number only if you are sure it is real and widely documented; otherwise describe the situation without one.
- TITLES AND SUBTITLES must be 100% English — no Tagalog or Filipino words whatsoever.
- Chapter titles must also be 100% English.

VOICE (2026-10-05, Jon's reference: a ChatGPT chapter opening about recurring ticks).
Write like a Filipino coach talking to one friend over coffee:
- Conversational Taglish. Tagalog can carry the story and everyday actions ("Pinaliguan. Tinanggal isa-isa ang garapata. Nilinis ang higaan."). English carries the insights, lessons, and instructions. Switch at sentence or phrase boundaries, the way people really talk. Never sprinkle Tagalog words in for flavor and never force a ratio: plain English is fine wherever it sounds natural.
- Short paragraphs. In stories and chapter openings, most paragraphs are a single short line of 3 to 10 words, and each action in a sequence gets its own line ("Pinaliguan." / "Tinanggal isa-isa ang garapata." / "Nilinis ang higaan."). In teaching sections, keep paragraphs to 1 to 3 short sentences. Repetition is fine when it builds ("Another shampoo." / "Another treatment." / "Another round of cleaning.").
- Show, don't tell. Write what people see, do, and say, not labels for their feelings ("she felt overwhelmed").
- Talk to the reader as "you". Take the blame off them: their effort was not the problem, nobody showed them the whole picture.
- Bold (**like this**) the lines that carry the key insight: 2 to 4 in a chapter opening, 1 or 2 in other sections. Bold a whole line, never part of a sentence. Only bold inside opening, lesson, introduction, and conclusion text: never in titles, quotes, step fields, or quick wins.
- Casual Filipino forms: yung, di, wag, pag, kasi, naman, pala. No apostrophes on shortened Tagalog words (yan, yung, di, wag, to); English contractions keep theirs (don't, you're). No em dashes. No deep or formal Tagalog.
- No fake cliffhangers ("what she learned would change everything"). End sections on a specific idea, not on suspense.

WHAT READERS BUY: People don't buy information. They buy relief. They buy clarity, speed, and confidence. Every section must make the reader feel: "I can do this."

BANNED WORDS — Never use these in any output, including titles, chapter names, and body text:
HARD BAN: unlock, unleash, discover, transform your life, revolutionize, ultimate guide, game-changing, next-level, powerful secrets, tap into, harness, ignite, amplify, supercharge
SOFT BAN (avoid unless truly necessary): maximize, optimize, elevate, breakthrough, leverage
These words make content sound AI-generated and feel out of touch to a Filipino reader.
Write like a practical friend — not a TED Talk, not a LinkedIn post.
❌ AI style: "Unlock your full potential with this powerful method."
✅ Market style: "Ganito mo magagawa ito step-by-step, kahit first time mo pa lang."

${buildVocabularyHint(80)}

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
  maxTokens = 2500,
  systemSuffix = '',
  userId: string | null = null
): Promise<unknown> {
  const { result } = await callOpenAIWithUsage(prompt, context, maxTokens, systemSuffix, userId)
  return result
}

// Returns parsed JSON + token usage — used by chapter_section stage for test page
async function callOpenAIWithUsage(
  prompt: string,
  context: Message[] = [],
  maxTokens = 2500,
  systemSuffix = '',
  userId: string | null = null
): Promise<{ result: unknown; usage: TokenUsage }> {
  const messages = [
    { role: 'system' as const, content: MASTER_SYSTEM_PROMPT + systemSuffix },
    ...context,
    { role: 'user' as const, content: prompt },
  ]

  const completion = await openai.chat.completions.create({
    model: EBOOK_MODEL,
    messages,
    response_format: { type: 'json_object' },
    ...samplingParams(EBOOK_MODEL, 0.78),
    ...tokenLimit(EBOOK_MODEL, maxTokens),
  })
  logAiUsage({ userId, route: 'ebook-agent', model: EBOOK_MODEL, usage: completion.usage })

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
      model: EBOOK_MODEL,
      messages: [
        ...messages,
        { role: 'assistant' as const, content },
        { role: 'user' as const, content: buildCorrectionPrompt(content, bannedFound) },
      ],
      response_format: { type: 'json_object' },
      ...samplingParams(EBOOK_MODEL, 0.5),
      ...tokenLimit(EBOOK_MODEL, maxTokens),
    })
    logAiUsage({ userId, route: 'ebook-agent', model: EBOOK_MODEL, usage: correction.usage })
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
  // Rewritten 2026-10-05 to Jon's reference opening (recurring ticks). The old
  // prompt asked for a "POWERFUL HOOK… persuasive sales copy strategy" and a
  // "false hope, then a harder fall" beat, which produced fake cliffhangers
  // ("what she learned would change everything"), formula drama, and novel-
  // style paragraphs averaging 50 words. The reference averages 6.
  return `TASK: Opening for Chapter ${chapter.number} — "${chapter.title}"

Book: "${bookTitle}"
Target Market: ${project.target_market}
Problem: ${project.problem}
Unique mechanism of the book: ${project.unique_mechanism}
Chapter Goal: ${chapter.goal}

Write the chapter opening in this flow:

1. THE SCENE (about half the length). One ordinary moment in a real person's day where the problem shows up. Give them a first name only, a fresh one that fits this market (not Maria, Mia, Juan, Carlos, or Marco). Show it beat by beat: what they notice, what they do, what they say. Then show the cycle: what they always try, the short relief, and the problem coming back, worse.
2. THE MIRROR. Turn to the reader ("If this sounds familiar…") and name what it feels like, in their own words. Short lines.
3. THE TURN. The one thing about this problem most people in this market miss, the idea this chapter teaches. Put it in a single **bold** line. Connect it to the book's unique mechanism where it fits naturally.
4. NO BLAME. Their effort was not the problem; nobody showed them the whole picture.
5. INTO THE CHAPTER. End on a specific promise of what this chapter will show them, a real idea, not suspense.

Follow the VOICE rules: one-line beats, Tagalog carrying the scene, English carrying the insight, nothing invented.

LENGTH: 350–550 words.

Return this exact JSON:
{
  "story_starter": "Full opening text — use \\n\\n between paragraphs"
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
   - Back it with real specifics: a named product, place, program, or price people would recognize. Use a statistic only if you are sure it is real and widely documented; never invent one.

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

TONE RULE — THIS IS THE MOST IMPORTANT INSTRUCTION:
Every step must sound like practical, street-level know-how — NOT a textbook, NOT theory, NOT generic "best practices." Specific actions, specific places, the shortcut that saves time, the mistake that wastes money.
Never invent the author's personal experiences ("I tested this for six weeks", "I wasted three months"), results, or numbers. The student publishes this under their own name.

The difference:
❌ Theoretical: "Research your target audience to understand their needs."
✅ Practical: "Open a Facebook group where your target market hangs out. Wag ka munang mag-post, magbasa ka lang. Scroll for 20 minutes and write down the exact words they use to describe their problem. Those words become your content."

❌ Theoretical: "Create a consistent posting schedule."
✅ Practical: "Pick two times a day you can actually keep, and post at those times for the next 30 days. Write them in your phone calendar now. Consistency you can keep beats a perfect schedule you abandon in a week."

RULES:
- 4–5 steps (never fewer, never more)
- Each step must be specific enough that the reader can do it WITHOUT googling anything extra
- Name actual tools, platforms, apps, or websites where relevant (e.g. "Open Canva at canva.com", "Go to Facebook Creator Studio")
- what_to_do: the exact action — written with the authority of someone who has done this before and knows the shortcut
- why_it_matters: one honest sentence — ground it in a real consequence, not a vague benefit ("skipping this means you'll redo the whole thing later" beats "this is important for success")
- common_mistake: write it as if you personally watched someone make this exact mistake and saw what it cost them — be specific and a little blunt

Return this exact JSON:
{
  "practical_steps": [
    {
      "step_number": 1,
      "title": "Step title here",
      "what_to_do": "Exact instruction with the authority of someone who has done this before",
      "why_it_matters": "One honest sentence grounded in a real consequence",
      "common_mistake": "The specific mistake you've personally seen — and what it costs"
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
- Include a real example or named tool per myth (a statistic only if you are sure it is real; never invent one)

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

SECTION 1 — STORY STARTER (350–550 words): One ordinary moment where the problem shows up, the cycle of what they try, a turn to the reader, the key insight in one **bold** line, then into the chapter. First name only. Follow the VOICE rules.
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
  _allChapters: ChapterOutline[],
  marketHint = '',
  userId: string | null = null,
  onStep?: (index: number) => void,
): Promise<ChapterDraft> {
  console.log(`[ebook-agent] Chapter ${chapter.number} multi-pass — starting`)

  // Pass 0 + Pass 1 in parallel (both are independent)
  onStep?.(0)
  const [previewData, quoteData] = await Promise.all([
    callOpenAI(pass0_PreviewPrompt(chapter), [], 300, marketHint, userId) as Promise<{ chapter_preview: string }>,
    callOpenAI(pass1_QuotePrompt(chapter), [], 400, marketHint, userId) as Promise<{ quote: { text: string; author: string } }>,
  ])
  console.log(`[ebook-agent] Chapter ${chapter.number} — preview + quote done`)

  // Pass 2: Story Starter
  onStep?.(1)
  const storyData = await callOpenAI(pass2_StoryPrompt(project, bookTitle, chapter), [], 1500, marketHint, userId) as {
    story_starter: string
  }
  console.log(`[ebook-agent] Chapter ${chapter.number} — story done`)

  // Pass 3: Core Lessons (story as context)
  onStep?.(2)
  const lessonsData = await callOpenAI(
    pass3_LessonsPrompt(project, chapter, storyData.story_starter),
    [{ role: 'assistant', content: JSON.stringify(storyData) }],
    3000,
    marketHint,
    userId
  ) as { core_lessons: string }
  console.log(`[ebook-agent] Chapter ${chapter.number} — lessons done`)

  // Pass 4: Practical Steps (story + lessons as context)
  onStep?.(3)
  const stepsData = await callOpenAI(
    pass4_StepsPrompt(project, chapter, storyData.story_starter, lessonsData.core_lessons),
    [
      { role: 'assistant', content: JSON.stringify(storyData) },
      { role: 'assistant', content: JSON.stringify(lessonsData) },
    ],
    2000,
    marketHint,
    userId
  ) as { practical_steps: PracticalStep[] }
  console.log(`[ebook-agent] Chapter ${chapter.number} — steps done`)

  // Pass 5: Quick Win
  onStep?.(4)
  const quickWinData = await callOpenAI(pass5_QuickWinPrompt(chapter), [], 1500, marketHint, userId) as {
    quick_win: QuickWin
  }
  console.log(`[ebook-agent] Chapter ${chapter.number} — quick win done`)

  return {
    number:           chapter.number,
    title:            chapter.title,
    chapter_preview:  previewData.chapter_preview,
    quote:            quoteData.quote,
    story_starter:    storyData.story_starter,
    core_lessons:     lessonsData.core_lessons,
    practical_steps:  stepsData.practical_steps,
    quick_win:        quickWinData.quick_win,
    references:       [],
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
- Follow the VOICE rules: one-line beats, Tagalog carrying the scenes, English carrying the insight.
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
    // This was the one generate route without the guard (found 2026-10-05).
    // It looked the user up only to apply the lite-workshop paywall and the
    // ebook cap, so with no user it skipped both and kept writing: anyone with
    // the URL could generate chapters on our OpenAI bill, past the paywall.
    // Same guard as every other generate route (see lib/apiAuth.ts), which
    // also blocks suspended and expired accounts.
    const auth = await requireUser()
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { stage, project, data } = body as {
      stage: string
      project: Project
      data: Record<string, unknown>
    }

    if (!stage || !project) {
      return NextResponse.json({ error: 'Missing stage or project' }, { status: 400 })
    }

    // Audience is dynamic — defined by the creator's clarity sentence.
    // No employment-status gate; the only validation that matters is whether
    // the target_market is specific enough to write a focused ebook for.

    // Per-user niche language pack — appended to the system prompt so all
    // passes in this request speak the same niche bubble.
    const marketHint = await getMarketLanguageHintForUser()

    // Client for the gates below; the user is already verified by requireUser.
    const supabaseAuth = await createClient()
    const authUser = auth.user
    const userId = authUser.id

    // ── Lifetime ebook cap check (cost protection) ────────────────────────
    // Refuse outline generation if the user has already completed their
    // maximum ebooks. profiles.max_ebooks_allowed defaults to 2 at signup
    // and is incremented by 1 on each coach reset (so reset always grants
    // exactly 1 more attempt). Counts profiles.completed_ebooks_count,
    // which is incremented on each Module 2 save (since the table itself
    // uses delete+insert and can only ever hold 1 row).
    // ── Lite workshop gate ────────────────────────────────────────────────
    // Lite users can generate Stage 1 (outline) ONLY. Any later stage hits
    // the paywall. They've seen their outline; chapters/intro/conclusion
    // are the value behind the AP offer.
    if (stage !== 'outline') {
      const supabase = supabaseAuth
      const user = authUser
      if (user) {
        const { data: gateProfile } = await supabase
          .from('profiles')
          .select('access_level')
          .eq('id', user.id)
          .maybeSingle()
        if ((gateProfile as { access_level?: string } | null)?.access_level === 'lite_workshop') {
          return NextResponse.json(
            {
              error: 'lite_workshop_paywall',
              message: 'Chapter generation is unlocked with the Accelerator Program. Upgrade to continue.',
              upgrade_url: '/upgrade',
            },
            { status: 402 },
          )
        }
      }
    }

    if (stage === 'outline') {
      const supabase = supabaseAuth
      const user = authUser
      if (user) {
        // Defensive: if the lifetime-cap migration hasn't been run, the
        // SELECT will return an error and `profile` will be null. We let it
        // pass (no enforcement) rather than 403 every user.
        const { data: profile, error: capLookupErr } = await supabase
          .from('profiles')
          .select('max_ebooks_allowed, completed_ebooks_count')
          .eq('id', user.id)
          .maybeSingle()
        if (capLookupErr) {
          console.warn('[ebook-agent] cap lookup failed (migration may be missing):', capLookupErr.message)
        } else {
          const p = profile as { max_ebooks_allowed?: number; completed_ebooks_count?: number } | null
          const cap = p?.max_ebooks_allowed ?? 2
          const completed = p?.completed_ebooks_count ?? 0
          if (completed >= cap) {
            console.warn(`[ebook-agent] User ${user.id} hit ebook cap (completed=${completed}, cap=${cap})`)
            return NextResponse.json(
              {
                error: 'ebook_limit_reached',
                completed,
                cap,
                message: `You've completed your maximum of ${cap} ebook${cap === 1 ? '' : 's'}. Reach out to your coach if you need a reset.`,
              },
              { status: 403 },
            )
          }
        }
      }
    }

    switch (stage) {

      // Stage 1: Generate title options + chapter outline
      case 'outline': {
        const result = await callOpenAI(outlinePrompt(project), [], 2000, marketHint, userId) as {
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

        const writeDraft = async (onStep?: (index: number) => void): Promise<ChapterDraft> => {
          let result: ChapterDraft

          if (chapterType === 'standard') {
            result = await generateStandardChapterMultiPass(project, bookTitle, chapter, allChapters, marketHint, userId, onStep)

            onStep?.(5)

            // ── Editor pass (standard chapters only, server-side) ────────────
            // Tier 1 validators always run; Tier 2 + reviser only fire if Tier 1
            // flags. Failures here never break the route — fall back to the
            // original chapter. The full report is admin-only debug telemetry.
            try {
              const edited = await editChapter(result as unknown as ChapterShape, {
                outline: {
                  title: chapter.title,
                  goal: chapter.goal,
                  quick_win_outcome: chapter.quick_win_outcome,
                },
              })
              if (edited.report.reviser_ran && edited.report.reviser_succeeded) {
                result = edited.chapter as unknown as ChapterDraft
              }
              if (edited.report.total_issues_found > 0) {
                console.log(
                  `[ebook-agent] Editor: chapter ${chapter.number} — ${edited.report.total_issues_found} found, ${edited.report.total_issues_remaining} remaining, reviser ${edited.report.reviser_ran ? (edited.report.reviser_succeeded ? 'succeeded' : 'failed') : 'skipped'}`
                )
              }
            } catch (editErr) {
              console.error('[ebook-agent] editor pass threw, returning unedited chapter:', editErr)
            }
          } else {
            onStep?.(0)
            result = await callOpenAI(
              singlePassChapterPrompt(project, bookTitle, chapter, allChapters),
              [],
              4500,
              marketHint,
              userId
            ) as ChapterDraft
          }

          return result
        }

        // Streamed progress (2026-10-05): on gpt-5.6-sol a standard chapter
        // takes ~90s, and the old spinner said "20-30 seconds", so students
        // read it as frozen. With data.stream the page gets an event as each
        // section starts. Standard chapters: 0 preview + quote, 1 story,
        // 2 lessons, 3 steps, 4 quick win, 5 quality check. Other types are
        // one pass (step 0). Without data.stream: plain JSON as before.
        if (data.stream === true) {
          const kind = chapterType === 'standard' ? 'standard' : 'single'
          const encoder = new TextEncoder()
          const body = new ReadableStream<Uint8Array>({
            async start(controller) {
              const send = (ev: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'))
              try {
                const draft = await writeDraft(index => send({ type: 'step', index, kind }))
                send({ type: 'done', data: draft })
              } catch (err) {
                console.error('[ebook-agent] streamed chapter failed:', err)
                send({ type: 'error', message: 'Failed to write this chapter. Please try again.' })
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

        const result = await writeDraft()
        return NextResponse.json({ stage, data: result })
      }

      // Stage 3: Book introduction
      case 'introduction': {
        const bookTitle    = data.book_title as string
        const bookSubtitle = data.book_subtitle as string
        const chapters     = data.chapters as ChapterOutline[]
        const result = await callOpenAI(introductionPrompt(project, bookTitle, bookSubtitle, chapters), [], 1800, marketHint, userId) as { introduction: string }
        return NextResponse.json({ stage, data: result })
      }

      // Stage 4: Book conclusion
      case 'conclusion': {
        const bookTitle = data.book_title as string
        const chapters  = data.chapters as ChapterOutline[]
        const result = await callOpenAI(conclusionPrompt(project, bookTitle, chapters), [], 1000, marketHint, userId) as { conclusion: string }
        return NextResponse.json({ stage, data: result })
      }

      // Stage: Single chapter section — for test page step-by-step mode with token reporting
      case 'chapter_section': {
        const section      = data.section as string
        const bookTitle    = data.book_title as string
        const chapter      = data.chapter as ChapterOutline
        const ctxStory     = data.ctx_story     as string | undefined
        const ctxLessons   = data.ctx_lessons   as string | undefined

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
          default:
            return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 })
        }

        const { result, usage } = await callOpenAIWithUsage(prompt, context, maxTokens, marketHint, userId)
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
