import { NextRequest, NextResponse } from 'next/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageNumber,
  Header,
  Footer,
  BorderStyle,
  PageBreak,
} from 'docx'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  quote?: { text: string; author: string }
  story_starter: string
  core_lessons: string
  practical_steps: PracticalStep[]
  quick_win: QuickWin
  references?: string[]
}

interface EbookData {
  title: string
  subtitle: string
  authorName?: string
  introduction: string
  conclusion: string
  chapters: ChapterDraft[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Split a long paragraph into chunks of max 3 sentences.
// Uses a smarter regex that avoids splitting on common abbreviations.
function splitIntoShortParagraphs(text: string): string[] {
  if (!text.trim()) return []

  // Temporarily protect common abbreviations from being treated as sentence ends
  const protected$ = text
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Ave|Blvd|vs|etc|e\.g|i\.e|Ph\.D|No|Vol|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\./gi, '$1§')
    .replace(/\bStep\s+\d+\./gi, match => match.replace('.', '§'))
    .replace(/\b\d+\./g, match => match.replace('.', '§')) // numbered list items

  // Split on sentence boundaries: end punctuation followed by space + capital letter (or end of string)
  const sentenceRegex = /[^.!?]*[.!?]+(?:\s+(?=[A-ZÁÉÍÓÚ])|$)/g
  const sentences = protected$.match(sentenceRegex) || [protected$]

  // Restore protected periods
  const cleaned = sentences.map(s => s.replace(/§/g, '.').trim()).filter(Boolean)

  if (cleaned.length === 0) return [text]

  // Group into chunks of 3 sentences
  const chunks: string[] = []
  for (let i = 0; i < cleaned.length; i += 3) {
    const chunk = cleaned.slice(i, i + 3).join(' ').trim()
    if (chunk) chunks.push(chunk)
  }
  return chunks.length > 0 ? chunks : [text]
}

// Split a block of text into Paragraphs (one per line break, max 3 sentences each)
// Lines starting with "## " are rendered as bold sub-headings.
function textToParagraphs(text: string, extraSpacing = false): Paragraph[] {
  if (!text) return []
  const lines = text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => line.length > 0)

  const paragraphs: Paragraph[] = []
  for (const line of lines) {
    // ## Sub-heading → render as bold Arial subheading
    if (line.startsWith('## ')) {
      const headingText = line.replace(/^##\s+/, '')
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: headingText, bold: true, size: 26, font: 'Arial', color: '1a1a2e' })],
        spacing: { before: 280, after: 100 },
      }))
      continue
    }

    // Only apply sentence splitting to longer lines
    const chunks = line.split(' ').length > 30 ? splitIntoShortParagraphs(line) : [line]
    for (const chunk of chunks) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: chunk, size: 24, font: 'Georgia' })],
        spacing: { after: extraSpacing ? 200 : 140, line: 320 },
      }))
    }
  }
  return paragraphs
}

// Section label (e.g. "Story Starter")
function sectionLabel(label: string, color: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 20, color, font: 'Arial', allCaps: true })],
    spacing: { before: 320, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color, space: 4 } },
  })
}

// Empty spacer paragraph
function spacer(pts = 160): Paragraph {
  return new Paragraph({ children: [], spacing: { after: pts } })
}

// ─── Document builder ─────────────────────────────────────────────────────────

function buildDocument(ebook: EbookData): Document {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = []

  // ── Cover page ──────────────────────────────────────────────────────────────
  children.push(spacer(2880))

  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: ebook.title, bold: true, size: 56, font: 'Arial', color: '1a1a2e' })],
    spacing: { after: 240 },
  }))

  if (ebook.subtitle) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: ebook.subtitle, size: 30, font: 'Georgia', color: '555555', italics: true })],
      spacing: { after: 480 },
    }))
  }

  if (ebook.authorName) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `by ${ebook.authorName}`, size: 26, font: 'Georgia', color: '333333' })],
      spacing: { after: 160 },
    }))
  }

  // Page break after cover
  children.push(new Paragraph({ children: [new PageBreak()] }))

  // ── Table of Contents ───────────────────────────────────────────────────────
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: 'Table of Contents', font: 'Arial', size: 36, bold: true, color: '1a1a2e' })],
    spacing: { after: 400 },
  }))

  // Introduction entry
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Introduction', size: 24, font: 'Georgia', color: '333333' })],
    spacing: { after: 160 },
    indent: { left: 0 },
  }))

  // Chapter entries
  for (const ch of ebook.chapters) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `Chapter ${ch.number}  `, size: 22, font: 'Arial', bold: true, color: 'C49A00' }),
        new TextRun({ text: ch.title, size: 24, font: 'Georgia', color: '1a1a2e' }),
      ],
      spacing: { after: 160 },
    }))
  }

  // Conclusion entry
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Conclusion', size: 24, font: 'Georgia', color: '333333' })],
    spacing: { after: 160 },
  }))

  children.push(new Paragraph({ children: [new PageBreak()] }))

  // ── Introduction ────────────────────────────────────────────────────────────
  if (ebook.introduction) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Introduction', font: 'Arial', size: 40, bold: true, color: '1a1a2e' })],
      spacing: { after: 320 },
    }))

    children.push(...textToParagraphs(ebook.introduction, true))
    children.push(new Paragraph({ children: [new PageBreak()] }))
  }

  // ── Chapters ─────────────────────────────────────────────────────────────────
  for (const ch of ebook.chapters) {
    // Chapter heading
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: `Chapter ${ch.number}`, font: 'Arial', size: 26, bold: true, color: '888888' })],
      spacing: { after: 80 },
    }))
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: ch.title, font: 'Arial', size: 44, bold: true, color: '1a1a2e' })],
      spacing: { after: 480 },
    }))

    // Chapter Preview
    if (ch.chapter_preview) {
      children.push(new Paragraph({
        children: [new TextRun({ text: ch.chapter_preview, size: 22, font: 'Georgia', color: '555555', italics: true })],
        spacing: { before: 0, after: 400, line: 320 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 6, color: 'dddddd', space: 12 },
        },
        indent: { left: 480 },
      }))
    }

    // Opening Quote
    if (ch.quote?.text) {
      children.push(spacer(160))
      children.push(new Paragraph({
        children: [new TextRun({ text: `\u201C${ch.quote.text}\u201D`, italics: true, size: 26, font: 'Georgia', color: '333333' })],
        spacing: { before: 160, after: 80, line: 340 },
        indent: { left: 720, right: 720 },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'C49A00', space: 12 } },
      }))
      children.push(new Paragraph({
        children: [new TextRun({ text: `\u2014 ${ch.quote.author}`, bold: true, size: 20, font: 'Arial', color: 'C49A00' })],
        spacing: { after: 320 },
        indent: { left: 720 },
      }))
    }

    // Introduction
    if (ch.story_starter) {
      children.push(sectionLabel('Introduction', 'C47F00'))
      children.push(spacer(80))
      children.push(...textToParagraphs(ch.story_starter, true))
    }

    // Core Lessons
    if (ch.core_lessons) {
      children.push(sectionLabel('Core Lessons', '1a6bb5'))
      children.push(spacer(80))
      children.push(...textToParagraphs(ch.core_lessons, true))
    }

    // Practical Steps
    if (ch.practical_steps?.length > 0) {
      children.push(sectionLabel('Practical Steps', '1a7a3c'))
      children.push(spacer(80))

      for (const step of ch.practical_steps) {
        // Step title
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: `Step ${step.step_number}: ${step.title}`, font: 'Arial', size: 26, bold: true, color: '1a1a2e' })],
          spacing: { before: 200, after: 80 },
        }))
        // What to do
        if (step.what_to_do) {
          children.push(...textToParagraphs(step.what_to_do))
        }
        // Why it matters
        if (step.why_it_matters) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: 'Why this matters: ', bold: true, size: 22, font: 'Arial', color: '444444' }),
              new TextRun({ text: step.why_it_matters, size: 22, font: 'Arial', color: '444444', italics: true }),
            ],
            spacing: { after: 80 },
          }))
        }
        // Common mistake
        if (step.common_mistake) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: '⚠ Common mistake: ', bold: true, size: 22, font: 'Arial', color: 'c0392b' }),
              new TextRun({ text: step.common_mistake, size: 22, font: 'Arial', color: 'c0392b' }),
            ],
            spacing: { after: 120 },
          }))
        }
      }
    }

    // Quick Win
    if (ch.quick_win) {
      children.push(sectionLabel('Quick Win', 'b8860b'))
      children.push(spacer(80))

      // Named quick win title
      if (ch.quick_win.name) {
        children.push(new Paragraph({
          children: [new TextRun({ text: ch.quick_win.name, bold: true, size: 28, font: 'Arial', color: 'b8860b' })],
          spacing: { after: 100 },
        }))
      }

      // Goal
      if (ch.quick_win.goal) {
        children.push(new Paragraph({
          children: [new TextRun({ text: ch.quick_win.goal, bold: true, size: 24, font: 'Georgia' })],
          spacing: { after: 120 },
        }))
      }

      // Instructions as numbered list — manually numbered to avoid Word counter bleed
      if (ch.quick_win.instructions?.length > 0) {
        ch.quick_win.instructions.forEach((inst, i) => {
          // Strip any leading "1." or "1)" the AI may have added
          const cleanInst = inst.replace(/^\d+[\.\)]\s*/, '').trim()
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${i + 1}.  `, bold: true, size: 24, font: 'Arial', color: 'b8860b' }),
              new TextRun({ text: cleanInst, size: 24, font: 'Georgia' }),
            ],
            spacing: { after: 100 },
            indent: { left: 360 },
          }))
        })
      }

      children.push(spacer(80))

      // Result
      if (ch.quick_win.immediate_result) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: '✓ Result: ', bold: true, size: 22, font: 'Arial', color: '1a7a3c' }),
            new TextRun({ text: ch.quick_win.immediate_result, size: 22, font: 'Arial', color: '1a7a3c', italics: true }),
          ],
          spacing: { after: 160 },
        }))
      }
    }

    // References
    if (ch.references && ch.references.length > 0) {
      children.push(spacer(200))
      children.push(new Paragraph({
        children: [new TextRun({ text: 'References', bold: true, size: 20, font: 'Arial', color: '888888', allCaps: true })],
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'dddddd', space: 4 } },
        spacing: { before: 0, after: 120 },
      }))
      ch.references.forEach((ref, i) => {
        children.push(new Paragraph({
          children: [new TextRun({ text: `${i + 1}.  ${ref}`, size: 18, font: 'Georgia', color: '888888', italics: true })],
          spacing: { after: 80 },
          indent: { left: 320, hanging: 320 },
        }))
      })
    }

    // Page break after each chapter (except last)
    children.push(new Paragraph({ children: [new PageBreak()] }))
  }

  // ── Conclusion ───────────────────────────────────────────────────────────────
  if (ebook.conclusion) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: 'Conclusion', font: 'Arial', size: 40, bold: true, color: '1a1a2e' })],
      spacing: { after: 320 },
    }))
    children.push(...textToParagraphs(ebook.conclusion, true))
  }

  // ── Build document ────────────────────────────────────────────────────────────
  return new Document({
    styles: {
      default: {
        document: { run: { font: 'Georgia', size: 24 } },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 44, bold: true, color: '1a1a2e' },
          paragraph: { spacing: { before: 480, after: 240 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 28, bold: true, color: '333333' },
          paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: ebook.title, size: 18, font: 'Arial', color: 'aaaaaa' })],
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'dddddd', space: 4 } },
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'dddddd', space: 4 } },
              children: [
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Arial', color: 'aaaaaa' }),
              ],
              spacing: { after: 60 },
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: ebook.authorName
                    ? `\u00A9 ${new Date().getFullYear()} ${ebook.authorName}. All rights reserved.`
                    : `\u00A9 ${new Date().getFullYear()}. All rights reserved.`,
                  size: 14,
                  font: 'Arial',
                  color: 'cccccc',
                }),
              ],
            }),
          ],
        }),
      },
      children,
    }],
  })
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const ebook = await request.json() as EbookData

    if (!ebook.title || !ebook.chapters?.length) {
      return NextResponse.json({ error: 'Missing ebook data' }, { status: 400 })
    }

    const doc = buildDocument(ebook)
    const buffer = await Packer.toBuffer(doc)

    const filename = `${ebook.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('DOCX generation error:', error)
    return NextResponse.json({ error: 'Failed to generate document' }, { status: 500 })
  }
}
