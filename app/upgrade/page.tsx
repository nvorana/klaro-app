import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// ─── Upgrade / Paywall Page ───────────────────────────────────────────────────
// Lite workshop users land here when they try to generate ebook chapters or
// access any module past Module 2's outline preview. Shows THEIR clarity
// sentence + outline (if they have one) at the top to anchor them in their
// own work, then the Accelerator Program offer.
//
// Mirrors pages.negosyouniversity.com/accelerator copy: workshop pricing
// expires Monday May 18, ₱28,000 one-time (or ₱15,500 installment).

export const dynamic = 'force-dynamic'

export default async function UpgradePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: clarity }, { data: ebook }] = await Promise.all([
    supabase.from('profiles').select('full_name, access_level').eq('id', user.id).maybeSingle(),
    supabase.from('clarity_sentences').select('target_market, core_problem, unique_mechanism, full_sentence').eq('user_id', user.id).maybeSingle(),
    supabase.from('ebooks').select('title, outline').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  // If already on a paid tier, no need to show paywall — send to dashboard
  const accessLevel = profile?.access_level
  if (accessLevel && ['enrolled', 'full_access', 'tier2', 'tier3', 'tier4'].includes(accessLevel)) {
    redirect('/dashboard')
  }

  const firstName = (profile?.full_name as string | null)?.split(' ')[0] ?? 'there'
  const outlineChapters = (ebook?.outline as { chapter_outlines?: Array<{ title?: string }> })?.chapter_outlines ?? []

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A1F36] via-[#1A1F36] to-[#0d1020] text-white">
      <div className="max-w-2xl mx-auto px-5 pt-8 pb-16">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <img src="/Klaro_Logo-cropped.png" alt="KLARO" className="h-8 w-auto" />
          <Link href="/dashboard" className="text-white/60 text-xs hover:text-white">← Back</Link>
        </div>

        {/* Urgency banner */}
        <div className="bg-[#F4B942] text-[#1A1F36] rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1F36" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <p className="text-sm font-bold">Workshop pricing ends Monday, May 18.</p>
        </div>

        {/* Headline + their work */}
        <div className="mb-7">
          <p className="text-[#F4B942] text-xs font-bold uppercase tracking-wider mb-2">Hi {firstName} — your project is started.</p>
          <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-4">
            One click away from your full ebook + a launch-ready business.
          </h1>
          <p className="text-white/70 text-sm leading-relaxed">
            You&apos;ve already done the hardest part. Here&apos;s what KLARO has on file for you right now:
          </p>
        </div>

        {/* Their clarity sentence */}
        {clarity?.full_sentence && (
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 mb-4">
            <p className="text-[10px] font-bold text-[#F4B942] uppercase tracking-wide mb-2">Your Clarity Sentence ✓</p>
            <p className="text-white text-lg font-semibold leading-snug">&ldquo;{clarity.full_sentence}&rdquo;</p>
          </div>
        )}

        {/* Their ebook outline */}
        {ebook?.title && outlineChapters.length > 0 && (
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10 mb-7">
            <p className="text-[10px] font-bold text-[#F4B942] uppercase tracking-wide mb-2">Your Ebook Outline ✓</p>
            <p className="text-white text-lg font-bold leading-snug mb-3">{ebook.title}</p>
            <ul className="space-y-1.5">
              {outlineChapters.slice(0, 8).map((ch, i) => (
                <li key={i} className="text-white/70 text-sm flex gap-2">
                  <span className="text-[#F4B942] font-bold flex-shrink-0">{i + 1}.</span>
                  <span>{ch.title ?? `Chapter ${i + 1}`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* The gap */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mb-7">
          <p className="text-amber-300 text-sm leading-relaxed">
            <span className="font-bold">What&apos;s next:</span> generate all 8 chapters with stories, quotes, content, and quick wins — built in your audience&apos;s language and ready as a polished .docx file.
          </p>
          <p className="text-amber-200/70 text-xs mt-2 italic">
            Doing this manually with ChatGPT: 8-12 hours of prompting and editing. With KLARO: 5 minutes.
          </p>
        </div>

        {/* The offer */}
        <div className="bg-white text-[#1A1F36] rounded-3xl p-6 md:p-8 mb-6 shadow-2xl">
          <div className="text-center mb-5">
            <p className="text-[10px] font-bold text-[#F4B942] uppercase tracking-widest mb-1">The Accelerator Program</p>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight mb-2">Full KLARO + Coach Jon, one-on-one</h2>
            <p className="text-gray-500 text-sm">Everything you need to launch your first digital product business.</p>
          </div>

          <div className="space-y-2.5 mb-6">
            <Bullet>Full KLARO access — all 7 modules unlocked immediately</Bullet>
            <Bullet>Generate your full ebook (8 chapters with stories, quotes, quick wins) in minutes</Bullet>
            <Bullet>Build your offer + 3-5 bonus deliverables with actual content (not just names)</Bullet>
            <Bullet>Sales Page AutoMagically — full sales copy section by section</Bullet>
            <Bullet>Email Copy AutoMagically — 7-day launch sequence</Bullet>
            <Bullet>Social Traffic AutoMagically — ready-to-post Facebook content</Bullet>
            <Bullet>Lead Magnet Builder — attract subscribers before launch</Bullet>
            <Bullet><span className="font-bold">30 days of one-on-one coaching with Coach Jon Oraña</span> — twice a week until your launch</Bullet>
            <Bullet>Lifetime access to all AutoMagically training updates</Bullet>
            <Bullet>Private community of AI &amp; ChatGPT users</Bullet>
          </div>

          {/* Pricing */}
          <div className="bg-[#F8F9FA] rounded-2xl p-5 mb-5">
            <div className="flex items-baseline justify-between mb-2">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">One-time payment</p>
                <p className="text-3xl font-bold text-[#1A1F36]">₱28,000</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">or installment</p>
                <p className="text-base font-semibold text-gray-700">₱15,500 down</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-500">100% Money-Back Guarantee. Try the full program — if it doesn&apos;t deliver, get a full refund.</p>
          </div>

          {/* CTAs */}
          <a
            href="https://pages.negosyouniversity.com/accelerator"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-[#1A1F36] text-white font-bold py-4 rounded-xl text-base hover:bg-[#2d3458] active:scale-[0.98] transition-all"
          >
            I&apos;m in — let&apos;s launch →
          </a>
          <p className="text-center text-[11px] text-gray-500 mt-3">
            Secure payment via BDO, GCash, Maya, Credit Card, or online banking.
          </p>
        </div>

        {/* Coach Jon trust line */}
        <div className="text-center mb-8">
          <p className="text-white/60 text-sm leading-relaxed">
            <span className="text-[#F4B942] font-semibold">Coach Jon Oraña</span> · Negosyo University<br/>
            Sold over ₱350 Million worth of digital products. Twice-a-week one-on-one coaching for 30 days.
          </p>
        </div>

        {/* Secondary action */}
        <div className="text-center">
          <Link href="/dashboard" className="text-white/40 text-xs hover:text-white/60 underline underline-offset-2">
            Maybe later, take me back to my project
          </Link>
        </div>

      </div>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 items-start">
      <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span className="text-sm text-gray-700 leading-relaxed">{children}</span>
    </div>
  )
}
