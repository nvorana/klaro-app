'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { getAccessExpiry, daysUntilExpiry } from '@/lib/accessExpiry'
import BottomNav from '@/components/BottomNav'

interface ProfileData {
  first_name: string
  last_name: string
  phone: string
  email: string
  access_level: string
  enrolled_at: string | null
  created_at: string | null
  access_expires_at: string | null
}

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Editable fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone, access_level, enrolled_at, full_name, created_at, access_expires_at')
        .eq('id', user.id)
        .single()

      const profileData: ProfileData = {
        first_name: data?.first_name || data?.full_name?.split(' ')[0] || '',
        last_name: data?.last_name || data?.full_name?.split(' ').slice(1).join(' ') || '',
        phone: data?.phone || '',
        email: user.email || '',
        access_level: data?.access_level || 'pending',
        enrolled_at: data?.enrolled_at || null,
        created_at: data?.created_at || null,
        access_expires_at: data?.access_expires_at || null,
      }

      setProfile(profileData)
      setFirstName(profileData.first_name)
      setLastName(profileData.last_name)
      setPhone(profileData.phone)
      setLoading(false)
    }
    loadProfile()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!profile) return
    setError('')
    setSaving(true)
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: saveErr } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        phone: phone.trim(),
      })
      .eq('id', user.id)

    if (saveErr) {
      setError('Could not save changes. Please try again.')
    } else {
      setProfile(prev => prev ? { ...prev, first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() } : prev)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const inputClass = "w-full bg-white text-[#1F2937] text-sm px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#F4B942]"
  const labelClass = "block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5"

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] max-w-[430px] md:max-w-3xl mx-auto flex flex-col">
      <div className="px-4 pt-6 pb-32 flex-1">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0" style={{ background: '#F4B942', color: '#1A1F36' }}>
            {firstName ? firstName[0].toUpperCase() : '?'}
          </div>
          <div>
            <h1 className="text-[#1A1F36] font-bold text-lg leading-tight">{firstName} {lastName}</h1>
            <p className="text-gray-500 text-xs">{profile?.email}</p>
          </div>
        </div>

        {/* Access badge */}
        {(() => {
          const expiryDate = profile ? getAccessExpiry(profile) : null
          const daysLeft = profile ? daysUntilExpiry(profile) : null
          const expiresOn = expiryDate ? expiryDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) : null
          const expired = daysLeft !== null && daysLeft <= 0
          const urgentColor = expired ? '#DC2626' : daysLeft !== null && daysLeft <= 14 ? '#EA580C' : '#B45309'
          const borderColor = expired ? '#FECACA' : daysLeft !== null && daysLeft <= 14 ? '#FED7AA' : '#F4B942'

          return (
            <div
              className="rounded-xl px-4 py-3 mb-6"
              style={{ background: '#FFFBEB', border: `1px solid ${borderColor}` }}
            >
              <div className="flex items-center gap-3 mb-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={urgentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <p style={{ color: urgentColor }} className="text-xs font-bold uppercase tracking-wide">
                  {profile?.access_level === 'full_access' ? 'Full Access' : profile?.access_level === 'enrolled' ? 'Enrolled' : 'Pending Access'}
                </p>
              </div>

              {/* Countdown bar */}
              {daysLeft !== null && expiresOn && (
                <>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] text-gray-600">
                      {expired ? 'Access expired' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
                    </span>
                    <span className="text-[11px] text-gray-500">ends {expiresOn}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#FDE68A' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(0, Math.min(100, (daysLeft / 90) * 100))}%`,
                        background: urgentColor,
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {/* Personal Info */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 mb-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-4">Personal Information</p>

          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className={labelClass}>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label className={labelClass}>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className={labelClass}>Email Address</label>
            <div className="w-full px-4 py-3 rounded-xl text-sm text-gray-500 flex items-center gap-2 bg-gray-50 border border-gray-200">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              {profile?.email}
            </div>
            <p className="text-[10px] text-gray-400 mt-1 pl-1">Email cannot be changed here. Contact support.</p>
          </div>

          <div>
            <label className={labelClass}>Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+63 912 345 6789"
              className={inputClass}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-red-600 text-sm rounded-xl px-4 py-3 mb-4 bg-red-50 border border-red-200">
            {error}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-xl font-bold text-sm mb-3 flex items-center justify-center gap-2 transition-all"
          style={{
            background: saved ? '#ECFDF5' : '#F4B942',
            color: saved ? '#059669' : '#1A1F36',
            border: saved ? '1px solid #10B981' : 'none',
          }}
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-[#1A1F36] border-t-transparent rounded-full animate-spin" />
              Saving…
            </>
          ) : saved ? (
            <>
              <CheckIcon />
              Changes Saved
            </>
          ) : (
            'Save Changes'
          )}
        </button>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full py-3.5 rounded-xl font-semibold text-sm text-red-500 transition-all bg-red-50 border border-red-200"
        >
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </button>

      </div>

      {/* Bottom Nav */}
      <BottomNav active="profile" />
    </div>
  )
}
