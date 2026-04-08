'use client'

import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SignOutButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center focus:outline-none"
        aria-label="Account menu"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 rounded-xl shadow-lg py-1 z-20 min-w-[140px]" style={{ background: '#1f2937', border: '1px solid #374151' }}>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2.5 text-sm text-red-400 font-semibold flex items-center gap-2 hover:bg-white/5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
