// ───────────────────────────────────────────────────────────────────────────
// Module 8 — Test Foundations (Preset Mock Student Data)
// ───────────────────────────────────────────────────────────────────────────
//
// Used by the admin test runner so Module 8 can be exercised end-to-end
// without real Modules 1-6 data. Each foundation represents one student
// archetype across different niches to test Module 8 generation quality.

export interface TestFoundation {
  id: string
  label: string
  description: string
  // Upstream context that Module 8 screens require
  clarity_sentence: string
  target_market: string
  core_problem: string
  unique_mechanism: string
  ebook_title: string
  ebook_chapters: { chapter_number: number; title: string; core_lessons: string }[]
  offer_statement?: string
  offer_bonuses?: { name: string; value_peso: number; objection_addressed: string }[]
  offer_price?: number
}

export const TEST_FOUNDATIONS: TestFoundation[] = [
  {
    id: 'softening_silence',
    label: 'Healing / Grief — Softening the Silence',
    description:
      'Cheryl Dulay\'s ebook from Appendix A. Tests emotional/trauma niche handling, protective clauses, audience low-bandwidth scenarios.',
    clarity_sentence:
      'I help women struggling with infertility and silent grief feel whole again after years of emotional numbness through my Softening the Silence Framework.',
    target_market: 'women struggling with infertility and silent grief',
    core_problem: 'emotional numbness after years of unspoken pain',
    unique_mechanism: 'Softening the Silence Framework (Awareness, Expression, Reconnection)',
    ebook_title: 'Softening the Silence: A Healing Journey Through Infertility and Grief',
    ebook_chapters: [
      { chapter_number: 1, title: 'The Weight of Unspoken Pain', core_lessons: 'Naming pain, disenfranchised grief intro, early grounding practices' },
      { chapter_number: 2, title: 'Understanding the Grief No One Talks About', core_lessons: 'Disenfranchised grief, psychological toll, why grief is valid' },
      { chapter_number: 3, title: 'Why Numbness Becomes the Default', core_lessons: 'Freeze response, protective shutdown, cost of numbness, thawing' },
      { chapter_number: 4, title: 'Introducing the Softening the Silence Framework', core_lessons: 'The 3 pillars overview' },
      { chapter_number: 5, title: 'Pillar 1 – Awareness: Naming the Pain', core_lessons: 'Affect labeling, body scan, sentence starters' },
      { chapter_number: 6, title: 'Pillar 2 – Expression: Giving Voice to Silence', core_lessons: 'Journaling, art, voice, movement, safe sharing' },
      { chapter_number: 7, title: 'Pillar 3 – Reconnection: Coming Home to Yourself', core_lessons: 'Body, identity, spirit reconnection' },
      { chapter_number: 8, title: 'Rewriting the Story of You', core_lessons: 'Narrative therapy, reframes, affirmations, visualization' },
      { chapter_number: 9, title: 'Life After Numbness – What Healing Looks Like', core_lessons: 'Post-traumatic growth, nonlinear healing, setbacks' },
      { chapter_number: 10, title: 'A Letter to the Silent Woman', core_lessons: 'Closing letter, practical next steps, blessing' },
    ],
    offer_statement: 'Healing journey ebook + 4 gentle support bonuses for ₱300',
    offer_bonuses: [
      { name: 'Unspoken Emotions Journal', value_peso: 750, objection_addressed: 'Hindi ko alam paano i-express' },
      { name: 'Invisible Grief Tracker', value_peso: 850, objection_addressed: 'Parang stuck lang ako' },
      { name: 'Comfort Rituals Cheat Sheet', value_peso: 700, objection_addressed: 'Wala akong oras' },
      { name: 'Support Circle Starter Pack', value_peso: 750, objection_addressed: 'Wala akong masabihan' },
    ],
    offer_price: 300,
  },
  {
    id: 'pet_fleas',
    label: 'Pet Care — Pawsitive Shield Flea Prevention',
    description:
      'Filipino dog owner dealing with recurring flea problems. Tests practical/tactical niche with checklist-heavy content.',
    clarity_sentence:
      'I help Filipino dog owners eliminate recurring flea and tick problems at home through my Pawsitive Shield 3-Zone Flea Elimination System.',
    target_market: 'Filipino dog owners with persistent flea and tick problems',
    core_problem: 'dogs keep scratching and expensive products stop working within weeks',
    unique_mechanism: 'Pawsitive Shield 3-Zone Flea Elimination System (Home, Dog, Prevention)',
    ebook_title: 'Pawsitive Shield: Keep Fleas and Ticks Off Your Dog for Good',
    ebook_chapters: [
      { chapter_number: 1, title: 'Why Fleas Keep Coming Back', core_lessons: 'Life cycle, breeding hotspots, why store products fail' },
      { chapter_number: 2, title: 'Zone 1 — The Home Treatment', core_lessons: 'Bedding, floors, furniture, outdoor spaces' },
      { chapter_number: 3, title: 'Zone 2 — Treating Your Dog', core_lessons: 'Bathing protocol, topical treatments, natural alternatives' },
      { chapter_number: 4, title: 'Zone 3 — Prevention Maintenance', core_lessons: 'Weekly inspection, seasonal adjustments, early warning signs' },
      { chapter_number: 5, title: 'Natural vs Chemical — What Works When', core_lessons: 'Pros/cons, safe combinations, age considerations' },
      { chapter_number: 6, title: 'Handling Infested Environments', core_lessons: 'Deep cleaning protocol, when to call professionals' },
      { chapter_number: 7, title: 'Your 30-Day Flea-Free Plan', core_lessons: 'Daily/weekly checklist, milestones, troubleshooting' },
    ],
    offer_statement: 'Flea elimination ebook + 4 implementation bonuses for ₱297',
    offer_bonuses: [
      { name: 'Customized Flea & Tick Solution', value_peso: 497, objection_addressed: 'My dog breed is different' },
      { name: '5-Minute Flea & Tick Prevention Routine', value_peso: 497, objection_addressed: 'Wala akong oras' },
      { name: 'Flea & Tick Fighter Quick Start Checklist', value_peso: 497, objection_addressed: 'Saan ba ako magsisimula?' },
      { name: 'Home Breeding Hotspot Map', value_peso: 497, objection_addressed: 'Di ko alam saan sila galing' },
    ],
    offer_price: 297,
  },
  {
    id: 'ofw_savings',
    label: 'Finance / OFW — First ₱100K Roadmap',
    description:
      'Filipino OFW building first savings while supporting family. Tests money/tactical niche with spreadsheet-heavy content.',
    clarity_sentence:
      'I help Filipino OFWs build their first ₱100,000 in savings within 12 months without cutting remittances through my Dual-Envelope System.',
    target_market: 'Filipino OFWs supporting family back home who have never saved before',
    core_problem: 'every peso goes to family remittances and monthly expenses, nothing left to save',
    unique_mechanism: 'Dual-Envelope System (Send-Envelope + Seed-Envelope)',
    ebook_title: 'The OFW First ₱100K Roadmap: From Zero Savings to Your First Milestone',
    ebook_chapters: [
      { chapter_number: 1, title: 'Why OFWs Struggle to Save', core_lessons: 'Family pressure, lifestyle inflation, no system' },
      { chapter_number: 2, title: 'The Dual-Envelope System', core_lessons: 'Core concept, why 2 envelopes, not 1 big budget' },
      { chapter_number: 3, title: 'Setting Up Your Send-Envelope', core_lessons: 'Remittance ceiling, family communication, emergency reserve' },
      { chapter_number: 4, title: 'Setting Up Your Seed-Envelope', core_lessons: 'Savings account strategy, auto-transfer, yield' },
      { chapter_number: 5, title: 'Hitting ₱25K Milestone (Month 3)', core_lessons: 'Weekly tracking, celebration markers, adjustments' },
      { chapter_number: 6, title: 'Hitting ₱50K Milestone (Month 6)', core_lessons: 'Scaling the system, lifestyle checks, middle slump' },
      { chapter_number: 7, title: 'Hitting ₱100K Milestone (Month 12)', core_lessons: 'Final push, what comes next, investing readiness' },
    ],
    offer_statement: 'Savings roadmap ebook + 3 tracking tools for ₱497',
    offer_bonuses: [
      { name: 'Dual-Envelope Tracker (Google Sheets)', value_peso: 700, objection_addressed: 'Hindi ako magaling sa Excel' },
      { name: '30 OFW Money Scripts for Family Pressure', value_peso: 600, objection_addressed: 'Paano sasabihin sa family?' },
      { name: 'Monthly Milestone Review Template', value_peso: 500, objection_addressed: 'Paano malalaman kung on track?' },
    ],
    offer_price: 497,
  },
]

export function getTestFoundation(id: string): TestFoundation | null {
  return TEST_FOUNDATIONS.find(f => f.id === id) ?? null
}
