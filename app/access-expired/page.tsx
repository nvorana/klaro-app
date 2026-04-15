import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '../dashboard/SignOutButton'

export default async function AccessExpiredPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, created_at, enrolled_at')
    .eq('id', user.id)
    .maybeSingle()

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const startDate = profile?.created_at ?? profile?.enrolled_at
  const expiresOn = startDate
    ? new Date(new Date(startDate).getTime() + 90 * 24 * 60 * 60 * 1000)
        .toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col max-w-[430px] md:max-w-3xl mx-auto">

      {/* Header */}
      <div className="bg-[#1A1F36] px-5 pt-4 pb-5 flex items-center justify-between">
        <img src="/Klaro_Logo-cropped.png" alt="KLARO" className="h-10 w-auto" />
        <div className="flex items-center gap-3">
          <span className="text-white/60 text-sm font-medium">{firstName}</span>
          <div className="w-9 h-9 rounded-full bg-[#f87171] flex items-center justify-center text-white text-sm font-bold">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <SignOutButton />
        </div>
      </div>

      {/* Expired message */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">

        {/* Lock icon */}
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[#1A1F36] mb-3 leading-tight">
          Your access has expired.
        </h1>

        <p className="text-gray-500 text-sm leading-relaxed mb-6 max-w-xs">
          Hi {firstName}, your 90-day TOPIS access period
          {expiresOn ? ` ended on ${expiresOn}` : ' has ended'}.
          To continue using KLARO, please reach out to our support team.
        </p>

        {/* Saved work reassurance card */}
        <div className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 mb-6 text-left shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span className="text-sm font-semibold text-[#1A1F36]">Your work is safe</span>
          </div>
          <p className="text-gray-500 text-sm leading-relaxed">
            Everything you&apos;ve built inside KLARO &mdash; your clarity sentence, your ebook,
            your content &mdash; is saved and secure. Nothing has been deleted.
          </p>
        </div>

        {/* Contact support */}
        <a
          href="mailto:jon@negosyouniversity.com"
          className="w-full bg-[#1A1F36] text-white font-bold py-3.5 rounded-xl text-sm hover:bg-[#2d3458] active:scale-[0.98] transition-all text-center block mb-4"
        >
          Contact Support
        </a>

        <p className="text-gray-400 text-xs">
          Email us at{' '}
          <a href="mailto:jon@negosyouniversity.com" className="text-[#1A1F36] underline underline-offset-2">
            jon@negosyouniversity.com
          </a>{' '}
          and we&apos;ll help you out.
        </p>

      </div>
    </div>
  )
}
