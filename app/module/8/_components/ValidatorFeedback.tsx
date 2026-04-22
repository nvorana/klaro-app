'use client'

// Reusable validator feedback panel for Module 8 screens.
// Shows decision (pass/revise/escalate/blocked_by_rule), weighted average,
// per-validator scores, top issues, and suggested fixes.

interface ValidatorFeedbackProps {
  decision: 'pass' | 'revise' | 'escalate' | 'blocked_by_rule'
  decisionReason?: string
  weightedAverage?: number | null
  validatorScores?: { name: string; score: number; recommendation: string }[]
  validatorFeedback?: {
    name: string
    overall_score: number
    pass_recommendation: string
    top_issues?: string[]
    suggested_fixes?: string[]
  }[]
  hardRuleFailures?: { rule_id: string; message: string }[]
  duplicateFlags?: { message: string }[]
}

const DECISION_COPY: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  pass:            { label: 'Passed',               color: '#065f46', bg: '#ecfdf5', border: '#10B981', icon: '✓' },
  revise:          { label: 'Revise (optional)',    color: '#92400e', bg: '#FFFBEB', border: '#F4B942', icon: '↻' },
  escalate:        { label: 'Needs your attention', color: '#7f1d1d', bg: '#fef2f2', border: '#f87171', icon: '!' },
  blocked_by_rule: { label: 'Blocked — please fix', color: '#7f1d1d', bg: '#fef2f2', border: '#f87171', icon: '⚠' },
}

const VALIDATOR_LABELS: Record<string, string> = {
  curriculum:         'Curriculum',
  learner_experience: 'Learner Experience',
  market:             'Market',
}

export default function ValidatorFeedback(props: ValidatorFeedbackProps) {
  const copy = DECISION_COPY[props.decision]
  const hasIssues =
    (props.validatorFeedback?.some(v => (v.top_issues?.length ?? 0) > 0)) ||
    (props.hardRuleFailures?.length ?? 0) > 0 ||
    (props.duplicateFlags?.length ?? 0) > 0

  if (!hasIssues && props.decision === 'pass') return null  // no need to show anything

  return (
    <div
      className="rounded-2xl p-4 mb-4"
      style={{
        background: copy.bg,
        border: `1px solid ${copy.border}`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: copy.color }}>
            AI Quality Check {copy.icon}
          </p>
          <p className="text-sm font-bold text-[#1A1F36] mt-0.5">{copy.label}</p>
        </div>
        {props.weightedAverage != null && (
          <span className="text-xs font-bold text-[#1A1F36] bg-white px-2 py-1 rounded-full">
            {props.weightedAverage.toFixed(1)}/10
          </span>
        )}
      </div>

      {/* Hard rule failures (show first — must fix) */}
      {(props.hardRuleFailures ?? []).length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-1.5">Rule Violations</p>
          <ul className="space-y-1">
            {props.hardRuleFailures!.map((f, i) => (
              <li key={i} className="text-xs text-red-700 flex items-start gap-1.5">
                <span className="mt-0.5">●</span>
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Duplicate flags */}
      {(props.duplicateFlags ?? []).length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1.5">Duplicate Detection</p>
          <ul className="space-y-1">
            {props.duplicateFlags!.map((f, i) => (
              <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                <span className="mt-0.5">●</span>
                <span>{f.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-validator scores */}
      {(props.validatorScores ?? []).length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Reviewer Scores</p>
          <div className="flex flex-wrap gap-2">
            {props.validatorScores!.map(v => (
              <span
                key={v.name}
                className="text-xs px-2 py-1 rounded-full bg-white border"
                style={{
                  borderColor: v.score >= 8 ? '#10B981' : v.score >= 6 ? '#F4B942' : '#f87171',
                  color: '#1A1F36',
                }}
              >
                {VALIDATOR_LABELS[v.name] ?? v.name}: <strong>{v.score}/10</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top issues + fixes per validator */}
      {(props.validatorFeedback ?? []).map((v, i) => {
        const hasAny = (v.top_issues?.length ?? 0) > 0 || (v.suggested_fixes?.length ?? 0) > 0
        if (!hasAny) return null
        return (
          <div key={i} className="mb-3 last:mb-0">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">
              {VALIDATOR_LABELS[v.name] ?? v.name} — {v.overall_score}/10
            </p>
            {(v.top_issues ?? []).length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-semibold text-gray-500 mb-0.5">Issues</p>
                <ul className="space-y-0.5">
                  {v.top_issues!.map((issue, j) => (
                    <li key={j} className="text-xs text-gray-700 flex items-start gap-1.5">
                      <span className="mt-0.5">●</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(v.suggested_fixes ?? []).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 mb-0.5">Suggested fixes</p>
                <ul className="space-y-0.5">
                  {v.suggested_fixes!.map((fix, j) => (
                    <li key={j} className="text-xs text-gray-700 flex items-start gap-1.5">
                      <span className="mt-0.5 text-emerald-600">→</span>
                      <span>{fix}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      })}

      {/* Decision reason */}
      {props.decisionReason && (
        <p className="text-[10px] text-gray-500 italic mt-2 pt-2 border-t border-gray-200">
          {props.decisionReason}
        </p>
      )}
    </div>
  )
}
