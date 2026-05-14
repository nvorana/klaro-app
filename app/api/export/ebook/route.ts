import { NextRequest, NextResponse } from 'next/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  BorderStyle,
} from 'docx'

// POST /api/export/ebook
// Body: { title, target_market, outline, chapters }
// Returns: .docx file download
//
// Chapter schema (current, post-Pass-6 removal):
//   { number, title, quote: {text, author}, chapter_preview, story_starter,
//     core_lessons, practical_steps: [...], quick_win: {title, description, steps},
//     references: [...] }
// Old field names (chapter_number, quick_win_section) are still accepted as
// fallbacks for any historical rows that haven't been migrated.

interface OutlineChapter {
  chapter_number?: number
  number?: number
  title: string
  goal?: string
  quick_win?: string
}

interface PracticalStep {
  step_number?: number
  title?: string
  description?: string
  [key: string]: unknown
}

interface QuickWin {
  title?: string
  description?: string
  steps?: string[]
}

interface ChapterReference {
  text?: string
  source?: string
  [key: string]: unknown
}

interface GeneratedChapter {
  number?: number
  chapter_number?: number
  title?: string
  quote?: { text?: string; author?: string }
  chapter_preview?: string
  story_starter?: string
  core_lessons?: string
  practical_steps?: PracticalStep[]
  quick_win?: QuickWin | string
  quick_win_section?: string
  references?: ChapterReference[]
}

function safeText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  return String(value)
}

function textToParagraphs(text: unknown, indent = false): Paragraph[] {
  const safe = safeText(text)
  if (!safe.trim()) return []
  return safe
    .split('\n')
    .filter(line => line.trim())
    .map(
      line =>
        new Paragraph({
          children: [new TextRun({ text: line.trim(), size: 24 })],
          spacing: { after: 160 },
          indent: indent ? { left: 360 } : undefined,
        }),
    )
}

function sectionHeading(label: string, accent = 'F4B942'): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: label, bold: true, size: 24, color: '1A1F36', allCaps: true })],
    spacing: { before: 240, after: 160 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: accent },
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const { title, target_market, outline, chapters } = await request.json()

    if (!title || !chapters || !Array.isArray(chapters)) {
      return NextResponse.json({ error: 'Missing required fields (title, chapters)' }, { status: 400 })
    }

    const docChildren: Paragraph[] = []

    // ── Title Page ────────────────────────────────────────────
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 56, color: '1A1F36' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 2000, after: 400 },
      }),
    )
    if (target_market) {
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: `For: ${target_market}`, size: 28, color: '666666', italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
      )
    }
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: 'Created with KLARO by Negosyo University', size: 20, color: '999999' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 2000 },
      }),
      new Paragraph({ children: [new PageBreak()] }),
    )

    // ── Table of Contents ─────────────────────────────────────
    docChildren.push(
      new Paragraph({
        text: 'Table of Contents',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 400 },
      }),
    )

    const outlineData: OutlineChapter[] = Array.isArray(outline) ? outline : []
    for (const ch of outlineData) {
      const num = ch.chapter_number ?? ch.number
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Chapter ${num ?? '?'}: ${ch.title ?? ''}`, size: 24 }),
          ],
          spacing: { after: 120 },
        }),
      )
    }
    docChildren.push(new Paragraph({ children: [new PageBreak()] }))

    // ── Chapters ──────────────────────────────────────────────
    // Sort by `number` (or legacy `chapter_number`), defensive against missing values
    const sortedChapters = [...chapters].sort((a: GeneratedChapter, b: GeneratedChapter) => {
      const an = a.number ?? a.chapter_number ?? 0
      const bn = b.number ?? b.chapter_number ?? 0
      return an - bn
    })

    for (let i = 0; i < sortedChapters.length; i++) {
      const ch = sortedChapters[i] as GeneratedChapter
      const num = ch.number ?? ch.chapter_number ?? i + 1

      // Chapter heading
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Chapter ${num}`,
              size: 24,
              color: 'F4B942',
              bold: true,
              allCaps: true,
            }),
          ],
          spacing: { before: 400, after: 100 },
        }),
        new Paragraph({
          text: ch.title ?? '',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 100, after: 400 },
        }),
      )

      // Chapter preview (1-2 sentence teaser, if present)
      if (ch.chapter_preview) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: safeText(ch.chapter_preview), italics: true, size: 24, color: '4b5563' })],
            spacing: { after: 320 },
            indent: { left: 360, right: 360 },
          }),
        )
      }

      // Quote (if present)
      if (ch.quote?.text) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: `"${safeText(ch.quote.text)}"`, italics: true, size: 26, color: '1A1F36' }),
            ],
            spacing: { before: 200, after: 80 },
            indent: { left: 720, right: 360 },
            border: {
              left: { style: BorderStyle.SINGLE, size: 12, color: 'F4B942', space: 12 },
            },
          }),
        )
        if (ch.quote.author) {
          docChildren.push(
            new Paragraph({
              children: [new TextRun({ text: `— ${safeText(ch.quote.author)}`, size: 22, color: '6b7280' })],
              spacing: { after: 320 },
              indent: { left: 720 },
            }),
          )
        }
      }

      // Story Starter
      if (ch.story_starter) {
        docChildren.push(sectionHeading('Story'))
        docChildren.push(...textToParagraphs(ch.story_starter))
      }

      // Core Lessons
      if (ch.core_lessons) {
        docChildren.push(sectionHeading('Core Lessons'))
        docChildren.push(...textToParagraphs(ch.core_lessons))
      }

      // Practical Steps (new field)
      if (Array.isArray(ch.practical_steps) && ch.practical_steps.length > 0) {
        docChildren.push(sectionHeading('Practical Steps'))
        for (const [idx, step] of ch.practical_steps.entries()) {
          const stepNum = step.step_number ?? idx + 1
          if (step.title) {
            docChildren.push(
              new Paragraph({
                children: [new TextRun({ text: `${stepNum}. ${safeText(step.title)}`, bold: true, size: 24 })],
                spacing: { before: 160, after: 80 },
              }),
            )
          }
          if (step.description) {
            docChildren.push(...textToParagraphs(step.description, true))
          }
        }
      }

      // Quick Win — handle both new object shape and legacy string field
      const quickWinText = typeof ch.quick_win === 'string'
        ? ch.quick_win
        : ch.quick_win_section
      const quickWinObj = (typeof ch.quick_win === 'object' && ch.quick_win) ? ch.quick_win as QuickWin : null

      if (quickWinObj || quickWinText) {
        docChildren.push(sectionHeading('Your Quick Win', '10B981'))
        if (quickWinObj) {
          if (quickWinObj.title) {
            docChildren.push(
              new Paragraph({
                children: [new TextRun({ text: safeText(quickWinObj.title), bold: true, size: 26 })],
                spacing: { before: 80, after: 120 },
              }),
            )
          }
          if (quickWinObj.description) {
            docChildren.push(...textToParagraphs(quickWinObj.description))
          }
          if (Array.isArray(quickWinObj.steps)) {
            for (const [idx, step] of quickWinObj.steps.entries()) {
              docChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: `${idx + 1}. `, bold: true, size: 24 }),
                    new TextRun({ text: safeText(step), size: 24 }),
                  ],
                  spacing: { after: 120 },
                  indent: { left: 360 },
                }),
              )
            }
          }
        } else if (quickWinText) {
          docChildren.push(...textToParagraphs(quickWinText))
        }
      }

      // References (if any)
      if (Array.isArray(ch.references) && ch.references.length > 0) {
        docChildren.push(sectionHeading('References', '6b7280'))
        for (const ref of ch.references) {
          const refText = [safeText(ref.text), ref.source ? `(${safeText(ref.source)})` : ''].filter(Boolean).join(' ')
          if (refText) {
            docChildren.push(
              new Paragraph({
                children: [new TextRun({ text: refText, size: 22, color: '4b5563' })],
                spacing: { after: 100 },
                indent: { left: 360 },
              }),
            )
          }
        }
      }

      // Page break after each chapter (except last)
      if (i < sortedChapters.length - 1) {
        docChildren.push(new Paragraph({ children: [new PageBreak()] }))
      }
    }

    // ── Build document ────────────────────────────────────────
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
    })

    const buffer = await Packer.toBuffer(doc)
    const safeFilename = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeFilename}.docx"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('Ebook export error:', detail, error)
    return NextResponse.json({ error: 'Export failed', detail }, { status: 500 })
  }
}
