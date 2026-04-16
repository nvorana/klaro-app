'use client'

import { useEffect, useState } from 'react'

interface Review {
  module_number: number
  status: 'pending' | 'approved' | 'needs_revision'
  note: string | null
  updated_at: string
}

interface Props {
  moduleNumber: number
}

/**
 * Shows the coach review status for a completed module.
 * Auto-detects AP students and only renders for them.
 * Renders: Pending Review / Approved / Needs Revision with coach note.
 */
export default function ModuleReviewStatus({ moduleNumber }: Props) {
  const [review, setReview] = useState<Review | null>(null)
  const [isAPStudent, setIsAPStudent] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch reviews — if the table doesn't exist yet or user isn't AP, we gracefully handle it
    fetch('/api/student/reviews')
      .then(res => res.ok ? res.json() : { reviews: [] })
      .then(data => {
        const reviews = data.reviews ?? []
        // If we got reviews back, this student has the table set up
        // We also need to check program_type — fetch from profile endpoint
        const r = reviews.find((r: Review) => r.module_number === moduleNumber)
        setReview(r ?? null)
        // Check if AP student
        return fetch('/api/student/program-type')
      })
      .then(res => res.ok ? res.json() : { programType: null })
      .then(data => {
        setIsAPStudent(data.programType === 'accelerator')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [moduleNumber])

  // Don't render anything for non-AP students
  if (!isAPStudent) return null
  if (loading) return null

  // No review yet — show "Submitted for Review"
  if (!review) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div>
          <p className="text-blue-800 font-bold text-sm">Submitted for Review</p>
          <p className="text-blue-600 text-xs mt-0.5 leading-relaxed">
            Your coach will review your work and provide feedback. You&apos;ll see the result here.
          </p>
        </div>
      </div>
    )
  }

  // Approved
  if (review.status === 'approved') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
        </div>
        <div>
          <p className="text-emerald-800 font-bold text-sm">Coach Approved!</p>
          <p className="text-emerald-600 text-xs mt-0.5 leading-relaxed">
            Your coach reviewed and approved this module. Great work — keep going!
          </p>
        </div>
      </div>
    )
  }

  // Needs revision
  if (review.status === 'needs_revision') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div>
            <p className="text-amber-800 font-bold text-sm">Revision Requested</p>
            <p className="text-amber-600 text-xs mt-0.5 leading-relaxed">
              Your coach reviewed this module and requested some changes.
            </p>
          </div>
        </div>
        {review.note && (
          <div className="mt-3 ml-11 bg-amber-100/60 border border-amber-200 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">Coach&apos;s Note</p>
            <p className="text-amber-800 text-sm leading-relaxed">{review.note}</p>
          </div>
        )}
      </div>
    )
  }

  return null
}
