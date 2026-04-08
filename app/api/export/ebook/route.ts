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

interface OutlineChapter {
  chapter_number: number
  title: string
  goal: string
  quick_win: string
}

interface GeneratedChapter {
  chapter_number: number
  title: string
  story_starter: string
  core_lessons: string
  quick_win_section: string
}

function textToParagraphs(text: string, indent = false): Paragraph[] {
  return text
    .split('\n')
    .filter(line => line.trim())
    .map(
      line =>
        new Paragraph({
          children: [new TextRun({ text: line.trim(), size: 24 })],
          spacing: { after: 160 },
          indent: indent ? { left: 360 } : undefined,
        })
    )
}

export async function POST(request: NextRequest) {
  try {
    const { title, target_market, outline, chapters } = await request.json()

    if (!title || !chapters || !Array.isArray(chapters)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const docChildren: (Paragraph)[] = []

    // ── Title Page ────────────────────────────────────────────
    docChildren.push(
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 56, color: '1A1F36' })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 2000, after: 400 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `For: ${target_market}`, size: 28, color: '666666', italics: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: 'Created with KLARO by Negosyo University', size: 20, color: '999999' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 2000 },
      }),
      new Paragraph({ children: [new PageBreak()] })
    )

    // ── Table of Contents ─────────────────────────────────────
    docChildren.push(
      new Paragraph({
        text: 'Table of Contents',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 400 },
      })
    )

    const outlineData: OutlineChapter[] = outline || []
    for (const ch of outlineData) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Chapter ${ch.chapter_number}: ${ch.title}`, size: 24, bold: false }),
          ],
          spacing: { after: 120 },
        })
      )
    }

    docChildren.push(new Paragraph({ children: [new PageBreak()] }))

    // ── Chapters ──────────────────────────────────────────────
    const sortedChapters = [...chapters].sort(
      (a: GeneratedChapter, b: GeneratedChapter) => a.chapter_number - b.chapter_number
    )

    for (const ch of sortedChapters) {
      // Chapter heading
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Chapter ${ch.chapter_number}`,
              size: 24,
              color: 'F4B942',
              bold: true,
              allCaps: true,
            }),
          ],
          spacing: { before: 400, after: 100 },
        }),
        new Paragraph({
          text: ch.title,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 100, after: 400 },
        })
      )

      // Introduction
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: 'Introduction', bold: true, size: 24, color: '1A1F36', allCaps: true })],
          spacing: { before: 200, after: 160 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: 'F4B942' },
          },
        }),
        ...textToParagraphs(ch.story_starter)
      )

      // Core Lessons
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: 'Core Lessons', bold: true, size: 24, color: '1A1F36', allCaps: true })],
          spacing: { before: 240, after: 160 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: 'F4B942' },
          },
        }),
        ...textToParagraphs(ch.core_lessons)
      )

      // Quick Win
      docChildren.push(
        new Paragraph({
          children: [new TextRun({ text: 'Your Quick Win', bold: true, size: 24, color: '1A1F36', allCaps: true })],
          spacing: { before: 240, after: 160 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '10B981' },
          },
        }),
        ...textToParagraphs(ch.quick_win_section)
      )

      // Page break after each chapter (except last)
      if (ch.chapter_number < sortedChapters.length) {
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
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeTitle}.docx"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Ebook export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
