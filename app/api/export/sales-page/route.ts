import { NextRequest, NextResponse } from 'next/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx'

// POST /api/export/sales-page
// Body: { headline?: string, full_copy: string, title?: string }
// Returns: .docx file download

function textToParagraphs(text: string): Paragraph[] {
  return text
    .split('\n')
    .map(line =>
      new Paragraph({
        children: [new TextRun({ text: line.trim() || ' ', size: 24 })],
        spacing: { after: 160 },
      }),
    )
}

export async function POST(request: NextRequest) {
  try {
    const { headline, full_copy, title } = await request.json()

    if (!full_copy || typeof full_copy !== 'string') {
      return NextResponse.json({ error: 'Missing full_copy' }, { status: 400 })
    }

    const docTitle = title || 'Sales Page'
    const children: Paragraph[] = []

    // Title
    children.push(
      new Paragraph({
        children: [new TextRun({ text: docTitle, bold: true, size: 40, color: '1A1F36' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    )

    // Headline (if present)
    if (headline) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Headline', bold: true, size: 24, color: '6b7280' })],
          spacing: { after: 80 },
        }),
      )
      headline.split('\n').forEach((line: string) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line.trim(), bold: true, size: 32, color: '1A1F36' })],
            spacing: { after: 120 },
          }),
        )
      })
      children.push(new Paragraph({ children: [], spacing: { after: 200 } }))
    }

    // Body label
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Full Sales Copy', bold: true, size: 24, color: '6b7280' })],
        spacing: { after: 80 },
      }),
    )

    // Body paragraphs
    children.push(...textToParagraphs(full_copy))

    const doc = new Document({
      sections: [{ properties: {}, children }],
    })

    const buffer = await Packer.toBuffer(doc)
    const safeName = docTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeName}_sales_page.docx"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Sales page export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
