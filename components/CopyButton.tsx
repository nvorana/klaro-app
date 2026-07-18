'use client'

import { useState } from 'react'

// ─── Shared copy-to-clipboard button ─────────────────────────────────────────
// Replaces 8 divergent per-page implementations. Shows "Copied!" for 2s
// (design-system rule). Renders as a small pill button; pass className to
// restyle in place.

export default function CopyButton({
  text,
  label = 'Copy',
  className,
}: {
  text: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (http / permissions) — leave the button as-is.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[#1A1F36] hover:bg-gray-50 active:scale-[0.97] transition-all'
      }
    >
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          {label}
        </>
      )}
    </button>
  )
}
