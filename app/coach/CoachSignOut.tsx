'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function CoachSignOut() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-1.5 text-gray-400 hover:text-red-400 transition-colors text-xs font-medium"
    >
      <LogOut size={14} />
      Sign out
    </button>
  )
}
