'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ValidatorFeedback from '../_components/ValidatorFeedback'

// Screen 6 — Lesson Map (per-module generation)
// User generates lessons ONE MODULE AT A TIME, per Doc 2.

interface LessonEntry {
  lesson_number: number
  title: string
  outcome: string
  action: string
  recommended_asset_type?: string
  estimated_length_minutes?: number
}

interface LessonMapModule {
  module_number: number
  module_title: string
  lessons: LessonEntry[]
}

interface LessonMapFullPayload {
  lesson_map: LessonMapModule[]
  complete: boolean
}

interface ModuleFromSkeleton {
  module_number: number
  title: string
  transformation: string
  estimated_lessons: number
}

interface QCResponse {
  draft: LessonMapFullPayload
  decision: 'pass' | 'revise' | 'escalate' | 'blocked_by_rule'
  decision_reason?: string
  weighted_average?: number | null
  validator_scores?: { name: string; score: number; recommendation: string }[]
  validator_feedback?: {
    name: string
    overall_score: number
    pass_recommendation: string
    top_issues?: string[]
    suggested_fixes?: string[]
  }[]
  hard_rule_failures?: { rule_id: string; message: string }[]
  duplicate_flags?: { message: string }[]
}

export default function LessonMapPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [generatingModule, setGeneratingModule] = useState<number | null>(null)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState('')
  const [moduleMap, setModuleMap] = useState<ModuleFromSkeleton[]>([])
  const [lessonMap, setLessonMap] = useState<LessonMapModule[]>([])
  const [lastQC, setLastQC] = useState<QCResponse | null>(null)
  const [expandedModule, setExpandedModule] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/module8/session')
      const data = await res.json()
      if (!data.session) { router.replace('/module/8'); return }

      // Pull the course skeleton from Screen 5's approved output
      const skeleton = data.approved_outputs_by_screen?.[5]
      if (!skeleton?.module_map) {
        setError('Screen 5 (Course Skeleton) must be completed first.')
        setLoading(false)
        return
      }
      setModuleMap(skeleton.module_map)

      // Load accumulated lessons so far
      const existing = data.approved_outputs_by_screen?.[6] as LessonMapFullPayload | undefined
      if (existing?.lesson_map) setLessonMap(existing.lesson_map)

      // Auto-expand first unfinished module
      const firstUnfinished = (skeleton.module_map as ModuleFromSkeleton[]).find(
        m => !(existing?.lesson_map ?? []).some(lm => lm.module_number === m.module_number)
      )
      if (firstUnfinished) setExpandedModule(firstUnfinished.module_number)

      setLoading(false)
    }
    load()
  }, [router])

  async function handleGenerateModule(moduleNumber: number) {
    setGeneratingModule(moduleNumber)
    setError('')
    setLastQC(null)
    try {
      const res = await fetch('/api/module8/screen/6/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_number: moduleNumber }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? data.error ?? 'Could not generate lessons for this module.')
        return
      }
      const payload = data.draft as LessonMapFullPayload
      setLessonMap(payload.lesson_map)
      setLastQC(data as QCResponse)

      // Auto-expand the newly generated module
      setExpandedModule(moduleNumber)
    } catch {
      setError('Could not generate lessons for this module.')
    } finally {
      setGeneratingModule(null)
    }
  }

  async function handleApprove() {
    if (lessonMap.length === 0) return
    setApproving(true)
    try {
      const payload: LessonMapFullPayload = {
        lesson_map: lessonMap,
        complete: lessonMap.length === moduleMap.length,
      }
      const res = await fetch('/api/module8/screen/6/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload }),
      })
      if (res.ok) {
        // Phase 2b ends here — Screens 7-9 are Phase 3-4
        alert('Phase 2b complete. Screens 7-9 come next.')
        router.push('/dashboard')
      }
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#F4B942] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const allModulesComplete = moduleMap.length > 0 && lessonMap.length === moduleMap.length

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="max-w-[430px] md:max-w-3xl mx-auto px-4 pt-6 pb-36">
        <Link href="/module/8/course-skeleton" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A1F36] mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#F4B942' }}>
            <span className="font-bold text-[#1A1F36] text-sm">6</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Module 8 · Screen 6</p>
            <h1 className="text-lg font-bold text-[#1A1F36]">Break Modules Into Lessons</h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
          <p className="text-xs font-semibold text-[#F4B942] uppercase tracking-wide mb-2">One module at a time</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Generate lessons for each module individually. This keeps outputs tight and lets you review/redo
            without losing progress on other modules.
          </p>
        </div>

        {/* Progress */}
        <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-200 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-600">
            {lessonMap.length} of {moduleMap.length} modules have lessons
          </p>
          <div className="h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#F4B942] transition-all"
              style={{ width: `${moduleMap.length > 0 ? (lessonMap.length / moduleMap.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {lastQC && (
          <ValidatorFeedback
            decision={lastQC.decision}
            decisionReason={lastQC.decision_reason}
            weightedAverage={lastQC.weighted_average}
            validatorScores={lastQC.validator_scores}
            validatorFeedback={lastQC.validator_feedback}
            hardRuleFailures={lastQC.hard_rule_failures}
            duplicateFlags={lastQC.duplicate_flags}
          />
        )}

        {/* Per-module sections */}
        {moduleMap.map(mod => {
          const lessonsForMod = lessonMap.find(lm => lm.module_number === mod.module_number)
          const hasLessons = !!lessonsForMod
          const isExpanded = expandedModule === mod.module_number
          const isGenerating = generatingModule === mod.module_number

          return (
            <div key={mod.module_number} className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
              <button
                onClick={() => setExpandedModule(isExpanded ? null : mod.module_number)}
                className="w-full text-left"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: hasLessons ? '#ecfdf5' : '#FFFBEB',
                      border: `1px solid ${hasLessons ? '#10B981' : '#F4B942'}`,
                    }}
                  >
                    {hasLessons ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <span className="text-[#F4B942] font-bold text-xs">{mod.module_number}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1A1F36]">{mod.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{mod.transformation}</p>
                    {hasLessons && (
                      <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                        {lessonsForMod!.lessons.length} lessons generated
                      </p>
                    )}
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  {hasLessons && (
                    <div className="space-y-2 mb-3">
                      {lessonsForMod!.lessons.map(lesson => (
                        <div key={lesson.lesson_number} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-[#F4B942]">L{lesson.lesson_number}</span>
                            {lesson.recommended_asset_type && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 capitalize">
                                {lesson.recommended_asset_type.replace(/_/g, ' ')}
                              </span>
                            )}
                            {lesson.estimated_length_minutes && (
                              <span className="text-[9px] text-gray-500">{lesson.estimated_length_minutes} min</span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-[#1A1F36] mb-1">{lesson.title}</p>
                          <p className="text-[11px] text-gray-600 leading-snug mb-1">
                            <span className="font-semibold">Outcome:</span> {lesson.outcome}
                          </p>
                          <p className="text-[11px] text-gray-600 leading-snug">
                            <span className="font-semibold">Action:</span> {lesson.action}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => handleGenerateModule(mod.module_number)}
                    disabled={isGenerating || generatingModule !== null}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{
                      background: hasLessons ? '#F3F4F6' : '#F4B942',
                      color: hasLessons ? '#6B7280' : '#1A1F36',
                      border: hasLessons ? '1px solid #e5e7eb' : undefined,
                    }}
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Generating…
                      </>
                    ) : hasLessons ? (
                      'Regenerate lessons for this module'
                    ) : (
                      'Generate lessons for this module'
                    )}
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {error && (
          <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div
        className="fixed bottom-0 bg-white px-4 py-4"
        style={{ borderTop: '1px solid #e5e7eb', width: '100%', maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}
      >
        <button
          onClick={handleApprove}
          disabled={!allModulesComplete || approving}
          className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: '#F4B942', color: '#1A1F36' }}
        >
          {approving ? 'Saving…' : allModulesComplete ? 'Lock In All Lessons →' : `Generate lessons for all ${moduleMap.length} modules to continue`}
        </button>
      </div>
    </div>
  )
}
