import Link from 'next/link'

// ─── Shared bottom navigation ────────────────────────────────────────────────
// The 4-item student nav (Home / My Work / Progress / Profile). Previously
// copy-pasted in 5 pages with drifting colors; this is now the only copy.
// Dark bar over light pages is intentional (matches the dashboard).

const GOLD = '#F4B942'
const GREY = '#9ca3af'

type NavKey = 'home' | 'my-work' | 'progress' | 'profile'

const ITEMS: Array<{ key: NavKey; href: string; label: string; icon: (color: string) => React.ReactNode }> = [
  {
    key: 'home', href: '/dashboard', label: 'Home',
    icon: c => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    key: 'my-work', href: '/my-work', label: 'My Work',
    icon: c => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    key: 'progress', href: '/progress', label: 'Progress',
    icon: c => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    key: 'profile', href: '/profile', label: 'Profile',
    icon: c => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

export default function BottomNav({ active }: { active: NavKey }) {
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] md:max-w-3xl bg-gray-900 border-t border-gray-800 px-2 pt-2.5 pb-6 flex justify-around items-center z-30">
      {ITEMS.map(item => {
        const color = item.key === active ? GOLD : GREY
        return (
          <Link key={item.key} href={item.href} className="flex flex-col items-center gap-1">
            {item.icon(color)}
            <span
              className="text-[10px] font-semibold"
              style={{ color: item.key === active ? GOLD : undefined }}
            >
              <span className={item.key === active ? '' : 'text-gray-400'}>{item.label}</span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}
