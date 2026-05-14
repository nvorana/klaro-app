import { NextRequest, NextResponse } from 'next/server'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  PageBreak,
} from 'docx'

// POST /api/export/content-posts
// Body: { full_post?: string, posts?: Array<{ hook?, value?, cta?, full_post? }>, title?: string }
// Returns: .docx file download with all Facebook posts

interface PostEntry {
  hook?: string
  value?: string
  cta?: string
  full_post?: string
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
    const body = await request.json()
    const { full_post, posts, title } = body as {
      full_post?: string
      posts?: PostEntry[]
      title?: string
    }

    const docTitle = title || 'Facebook Content Posts'
    const children: Paragraph[] = []

    // Cover
    children.push(
      new Paragraph({
        children: [new TextRun({ text: docTitle, bold: true, size: 44, color: '1A1F36' })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    )

    // Two supported shapes:
    //   (1) posts: [...] — array of post objects, one section per post
    //   (2) full_post: "..." — single concatenated string fallback
    if (Array.isArray(posts) && posts.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `${posts.length} posts`, size: 22, color: '6b7280' })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
      )

      posts.forEach((p: PostEntry, idx: number) => {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `POST ${idx + 1}`, bold: true, size: 22, color: 'F4B942' })],
            spacing: { before: 200, after: 80 },
          }),
        )

        const postText = p.full_post
          ?? [p.hook, p.value, p.cta].filter(Boolean).join('\n\n')
        if (postText) {
          children.push(...textToParagraphs(postText))
        } else {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: '(no content)', italics: true, size: 22, color: '9ca3af' })],
              spacing: { after: 200 },
            }),
          )
        }

        if (idx < posts.length - 1) {
          children.push(new Paragraph({ children: [new PageBreak()] }))
        }
      })
    } else if (typeof full_post === 'string' && full_post.trim()) {
      // Single concatenated text fallback
      children.push(...textToParagraphs(full_post))
    } else {
      return NextResponse.json({ error: 'Missing posts array or full_post text' }, { status: 400 })
    }

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
    console.error('Content posts export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
