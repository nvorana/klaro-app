// Tier → max module number unlocked (immediate, no time-gating)
export const TIER_MODULE_LIMITS: Record<string, number> = {
  'tier1':       1,
  'tier2':       4,
  'tier3':       7,
  'tier4':       7,
  'full_access': 7,
  'enrolled':    7, // legacy: treat as full for time-gated logic
}

/**
 * Returns how many modules a student can access based on their access_level.
 * Returns 0 for 'pending' or unknown values.
 */
export function getModuleLimitForAccess(accessLevel: string | null): number {
  if (!accessLevel) return 0
  return TIER_MODULE_LIMITS[accessLevel] ?? 0
}

/**
 * Returns true if a module is unlocked based purely on tier (no time-gating).
 * Use this for tier1/tier2/tier3/full_access students.
 */
export function isModuleUnlockedByTier(accessLevel: string | null, moduleNumber: number): boolean {
  const limit = getModuleLimitForAccess(accessLevel)
  return moduleNumber <= limit
}

/**
 * Primary unlock check.
 *
 * Policy (program-first pacing — everyone in a program runs at program pace
 * regardless of payment method):
 *
 * 1. Module 1 is always available to any non-pending student
 * 2. If program_type = 'topis' → weekly drip only (0, 7, 14, 21, 28, 35, 42
 *    days since enrolled_at). Payment tier does NOT skip the drip — a
 *    fully-paid TOPIS student is paced the same as an installment-paying one.
 * 3. If program_type = 'accelerator' → unlocked_modules array (modules 1-2
 *    on enrollment, next unlocks when student completes current, or coach
 *    unlocks manually)
 * 4. Otherwise (tier students / legacy / admins-assigned-full_access with
 *    no program_type): access_level decides. tier1=1, tier2=4, tier3/tier4/
 *    full_access=7. No pacing enforced.
 */
export function isModuleUnlockedForStudent(
  unlockedModules: number[] | null | undefined,
  accessLevel: string | null,
  enrolledAt: string | null,
  moduleNumber: number,
  programType?: string | null
): boolean {
  // Module 1 is always available to any non-pending student
  if (moduleNumber === 1 && accessLevel && accessLevel !== 'pending') {
    return true
  }

  // ── TOPIS: always weekly drip, ignoring access_level tier ─────────────
  if (programType === 'topis') {
    return isModuleUnlocked(enrolledAt, moduleNumber)
  }

  // ── Accelerator: unlocked_modules array controls access ───────────────
  if (programType === 'accelerator') {
    if (unlockedModules && unlockedModules.length > 0) {
      return unlockedModules.includes(moduleNumber)
    }
    // Safety fallback: if array empty, only Module 1 (already handled above)
    return false
  }

  // ── Non-program students: unlocked_modules takes priority if populated
  if (unlockedModules && unlockedModules.length > 0) {
    return unlockedModules.includes(moduleNumber)
  }

  // Tier-based fallback (tier1/2/3/4/full_access without program_type)
  if (accessLevel && ['tier1', 'tier2', 'tier3', 'tier4', 'full_access'].includes(accessLevel)) {
    return isModuleUnlockedByTier(accessLevel, moduleNumber)
  }

  // Legacy time-based fallback (very old accounts pre-program_type)
  return isModuleUnlocked(enrolledAt, moduleNumber)
}

// Module unlock schedule — days after enrollment
export const MODULE_UNLOCK_DAYS: Record<number, number> = {
  1: 0,   // Unlocks immediately
  2: 7,   // Week 2
  3: 14,  // Week 3
  4: 21,  // Week 4
  5: 28,  // Week 5
  6: 35,  // Week 6
  7: 42,  // Week 7
}

export const MODULE_INFO = [
  {
    number: 1,
    title: 'The Clarity Builder',
    description: 'Find your target market, their biggest problem, and your unique solution.',
    output: 'Your Clarity Sentence',
  },
  {
    number: 2,
    title: 'The Ebook Factory',
    description: 'Write and export your complete ebook with a Canva cover prompt.',
    output: 'Your Full Ebook (.docx)',
  },
  {
    number: 3,
    title: 'The Irresistible Offer Builder',
    description: 'Build a compelling offer with the right bonuses, price, and guarantee.',
    output: 'Your Irresistible Offer Statement',
  },
  {
    number: 4,
    title: 'The Sales Page Builder',
    description: 'Generate your full sales page copy section by section using your offer.',
    output: 'Your Sales Page Copy',
  },
  {
    number: 5,
    title: 'The 7-Day Email Sequence',
    description: 'Generate 7 emails that nurture readers and sell your ebook.',
    output: 'Your Email Sequence',
  },
  {
    number: 6,
    title: 'The Lead Magnet Builder',
    description: 'Create a free lead magnet that attracts subscribers and builds trust.',
    output: 'Your Lead Magnet (.docx)',
  },
  {
    number: 7,
    title: 'The Facebook Content Engine',
    description: 'Generate ready-to-post Facebook content that drives conversations.',
    output: 'Your Facebook Posts',
  },
]

export function getUnlockDate(enrolledAt: string, moduleNumber: number): Date {
  const enrolled = new Date(enrolledAt)
  const daysToAdd = MODULE_UNLOCK_DAYS[moduleNumber] ?? 999
  const unlockDate = new Date(enrolled)
  unlockDate.setDate(unlockDate.getDate() + daysToAdd)
  return unlockDate
}

export function isModuleUnlocked(enrolledAt: string | null, moduleNumber: number): boolean {
  if (!enrolledAt) return false
  const unlockDate = getUnlockDate(enrolledAt, moduleNumber)
  return new Date() >= unlockDate
}

export function getDaysUntilUnlock(enrolledAt: string, moduleNumber: number): number {
  const unlockDate = getUnlockDate(enrolledAt, moduleNumber)
  const today = new Date()
  const diff = unlockDate.getTime() - today.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
