import { NextRequest, NextResponse } from 'next/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
} from 'docx'

// POST /api/export/bonus
// Body: { bonus_name: string, format: string, content: string,
//         ebook_title?: string }
// Returns: .docx file download with the bonus content rendered.

function textToParagraphs(text: string): Paragraph[] {
  const lines = text.split('\n')
  return lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) {
      // Preserve blank lines as spacing
      return new Paragraph({ children: [], spacing: { after: 120 } })
    }
    // Section headers we want to render bigger and bold:
    // ALL-CAPS lines like "STEP 1:", "PROMPT 1:", "SECTION 1:", etc.
    const isHeading = /^[A-Z][A-Z0-9 \-—:.]{4,}$/.test(trimmed) && trimmed.length < 60
    if (isHeading) {
      return new Paragraph({
        children: [new TextRun({ text: trimmed, bold: true, size: 26, color: '1A1F36' })],
        spacing: { before: 200, after: 120 },
      })
    }
    // Bullet/checkbox-style lines render as themselves (plain text monospaced look)
    return new Paragraph({
      children: [new TextRun({ text: line.replace(/^\s+$/g, ''), size: 24 })],
      spacing: { after: 120 },
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const { bonus_name, format, content, ebook_title } = await request.json()

    if (!bonus_name || !content) {
      return NextResponse.json({ error: 'Missing bonus_name or content' }, { status: 400 })
    }

    const children: Paragraph[] = []

    // Cover header
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'BONUS', bold: true, size: 22, color: 'F4B942' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: bonus_name, bold: true, size: 44, color: '1A1F36' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
    )
    if (format) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: format, size: 22, color: '6b7280', italics: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
      )
    }
    if (ebook_title) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Companion bonus to: ${ebook_title}`, size: 20, color: '9ca3af' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 480 },
        }),
      )
    } else {
      children.push(new Paragraph({ children: [], spacing: { after: 480 } }))
    }

    // Body content
    children.push(...textToParagraphs(content))

    const doc = new Document({
      sections: [{ properties: {}, children }],
    })

    const buffer = await Packer.toBuffer(doc)
    const safeName = bonus_name.replace(/[^a-z0-9]/gi, '_').substring(0, 50)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeName}.docx"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('Bonus export error:', detail)
    return NextResponse.json({ error: 'Export failed', detail }, { status: 500 })
  }
}
