import { NextRequest, NextResponse } from 'next/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  PageBreak,
} from 'docx'

// POST /api/export/email-sequence
// Body: { emails: Array<{ day, subject_a?, subject_b?, subject?, body }>, title?: string }
// Returns: .docx file download with all emails, one per page

interface EmailEntry {
  day?: number
  subject_a?: string
  subject_b?: string
  subject?: string
  body?: string
}

function textToParagraphs(text: string): Paragraph[] {
  return text
    .split('\n')
    .map(line =>
      new Paragraph({
        children: [new TextRun({ text: line.trim() || ' ', size: 24 })],
        spacing: { after: 140 },
      }),
    )
}

export async function POST(request: NextRequest) {
  try {
    const { emails, title } = await request.json()

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'Missing or empty emails array' }, { status: 400 })
    }

    const docTitle = title || '7-Day Email Sequence'
    const children: Paragraph[] = []

    // Cover
    children.push(
      new Paragraph({
        children: [new TextRun({ text: docTitle, bold: true, size: 48, color: '1A1F36' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `${emails.length} emails`, size: 22, color: '6b7280' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
      }),
    )

    // One section per email
    emails.forEach((email: EmailEntry, idx: number) => {
      const day = email.day ?? idx + 1
      const primarySubject = email.subject_a || email.subject || `Email ${day}`

      // Day header
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `DAY ${day}`, bold: true, size: 22, color: 'F4B942' }),
          ],
          spacing: { before: 200, after: 80 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: primarySubject, bold: true, size: 32, color: '1A1F36' }),
          ],
          spacing: { after: 80 },
        }),
      )

      // A/B subject lines (if both present)
      if (email.subject_a && email.subject_b) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Subject A: ', bold: true, size: 20, color: '6b7280' }),
              new TextRun({ text: email.subject_a, size: 20 }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Subject B: ', bold: true, size: 20, color: '6b7280' }),
              new TextRun({ text: email.subject_b, size: 20 }),
            ],
            spacing: { after: 200 },
          }),
        )
      }

      // Body
      if (email.body) {
        children.push(...textToParagraphs(email.body))
      } else {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: '(no body content)', italics: true, size: 22, color: '9ca3af' })],
            spacing: { after: 200 },
          }),
        )
      }

      // Page break between emails (not after the last)
      if (idx < emails.length - 1) {
        children.push(
          new Paragraph({
            children: [new PageBreak()],
          }),
        )
      }
    })

    const doc = new Document({
      sections: [{ properties: {}, children }],
    })

    const buffer = await Packer.toBuffer(doc)
    const safeName = docTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeName}.docx"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Email sequence export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
