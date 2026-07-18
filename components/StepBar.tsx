// ─── Shared wizard step progress bar ─────────────────────────────────────────
// The dot progress bar under module headers (design-system spec):
//   completed = green fill + white check, active = gold fill + gold label,
//   future = grey. Connectors green when passed, grey when future.
// Previously hand-rolled with drifting markup in 6 module pages.

const GOLD = '#F4B942'
const GREEN = '#10B981'
const GREY = '#D1D5DB'

export default function StepBar({
  steps,
  currentIndex,
}: {
  steps: string[]
  currentIndex: number
}) {
  return (
    <div className="px-4 py-3 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {steps.map((label, i) => {
          const done = i < currentIndex
          const active = i === currentIndex
          const fill = done ? GREEN : active ? GOLD : GREY
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: fill }}
                >
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <span className="text-[10px] font-bold" style={{ color: active ? '#1A1F36' : '#fff' }}>
                      {i + 1}
                    </span>
                  )}
                </div>
                <span
                  className="text-[9px] font-semibold whitespace-nowrap"
                  style={{ color: done ? GREEN : active ? GOLD : '#9ca3af' }}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className="h-0.5 flex-1 mx-1 mb-4"
                  style={{ background: i < currentIndex ? GREEN : GREY }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
