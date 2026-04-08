import { NextRequest, NextResponse } from 'next/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx'

// POST /api/export/lead-magnet
// Body: { title, format, hook, introduction, main_content, quick_win, bridge_to_ebook }
// Returns: .docx file download

export async function POST(request: NextRequest) {
  try {
    const {
      title,
      format,
      hook,
      introduction,
      main_content,
      quick_win,
      bridge_to_ebook,
    } = await request.json()

    const formatLabel: Record<string, string> = {
      checklist: 'Checklist',
      quick_guide: 'Quick Guide',
      free_report: 'Free Report',
    }

    function sectionHeading(text: string): Paragraph {
      return new Paragraph({
        text,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
        border: {
          bottom: {
            color: 'F4B942',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    }

    function bodyText(text: string): Paragraph[] {
      return text
        .split('\n')
        .filter(line => line.trim())
        .map(
          line =>
            new Paragraph({
              children: [new TextRun({ text: line.trim(), size: 24, font: 'Calibri' })],
              spacing: { after: 160 },
            })
        )
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: { font: 'Calibri', size: 24, color: '1F2937' },
          },
        },
      },
      sections: [
        {
          children: [
            // Title block
            new Paragraph({
              children: [
                new TextRun({
                  text: title || 'Lead Magnet',
                  bold: true,
                  size: 48,
                  color: '1A1F36',
                  font: 'Calibri',
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 120 },
            }),

            // Format badge
            new Paragraph({
              children: [
                new TextRun({
                  text: formatLabel[format] || 'Free Guide',
                  bold: true,
                  size: 20,
                  color: 'F4B942',
                  font: 'Calibri',
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // Divider
            new Paragraph({
              text: '─────────────────────────────────────',
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // Hook section
            sectionHeading('Introduction'),
            ...bodyText(hook || ''),
            new Paragraph({ text: '', spacing: { after: 100 } }),
            ...bodyText(introduction || ''),

            // Main content
            sectionHeading('What You\'ll Discover'),
            ...bodyText(main_content || ''),

            // Quick win
            sectionHeading('Your Quick Win'),
            ...bodyText(quick_win || ''),

            // Bridge to ebook
            sectionHeading('Ready to Go Deeper?'),
            ...bodyText(bridge_to_ebook || ''),

            // Footer note
            new Paragraph({ text: '', spacing: { before: 400 } }),
            new Paragraph({
              children: [
                new TextRun({
                  text: '─ End of Free Guide ─',
                  italics: true,
                  size: 18,
                  color: '9CA3AF',
                  font: 'Calibri',
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        },
      ],
    })

    const buffer = await Packer.toBuffer(doc)

    const safeTitle = (title || 'lead-magnet').replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeTitle}.docx"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Lead magnet export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
