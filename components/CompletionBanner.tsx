import Link from 'next/link'

// ─── Shared module-completion surface ────────────────────────────────────────
// Design-system spec: green success banner, then an "Up Next" card with CTA,
// then a "Back to Dashboard" text link. Previously 3 divergent styles.

export function CompletionBanner({ moduleNumber, moduleTitle }: { moduleNumber: number; moduleTitle?: string }) {
  return (
    <div className="bg-[#10B981] rounded-2xl px-5 py-4 mb-5 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div>
        <p className="text-white font-bold text-base leading-tight">Module {moduleNumber} Complete!</p>
        {moduleTitle && <p className="text-white/80 text-xs mt-0.5">{moduleTitle}</p>}
      </div>
    </div>
  )
}

export function UpNextCard({
  moduleNumber,
  title,
  blurb,
  buttonLabel,
}: {
  moduleNumber: number
  title: string
  blurb?: string
  buttonLabel?: string
}) {
  return (
    <div className="bg-white border-2 border-[#F4B942] rounded-2xl px-5 py-4 mb-4 shadow-[0_0_16px_rgba(244,185,66,0.25)]">
      <p className="text-[#F4B942] text-[11px] font-bold uppercase tracking-wide mb-1">
        Up Next — Module {moduleNumber}
      </p>
      <p className="text-[#1A1F36] font-bold mb-1">{title}</p>
      {blurb && <p className="text-gray-500 text-sm mb-3 leading-relaxed">{blurb}</p>}
      <Link
        href={`/module/${moduleNumber}`}
        className="block w-full bg-[#F4B942] text-[#1A1F36] font-bold py-3 rounded-xl text-sm text-center hover:bg-[#e0a832] active:scale-[0.98] transition-all"
      >
        {buttonLabel ?? `Start Module ${moduleNumber}`}
      </Link>
    </div>
  )
}

export function BackToDashboardLink() {
  return (
    <Link
      href="/dashboard"
      className="block text-center text-gray-400 text-sm underline underline-offset-4 hover:text-gray-600 py-2"
    >
      Back to Dashboard
    </Link>
  )
}
