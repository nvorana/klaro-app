# Appendix A: Worked Example — Softening the Silence

## Purpose of this Appendix

This appendix walks through Module 8 end-to-end using **one real student foundation** — Cheryl Dulay's *Softening the Silence* e-book and offer. It follows the finalized Module 8 screen model and output contracts.

Mapping note:
- Unlock Check = pre-screen orchestration gate
- Orientation = Screen 0
- Readiness = Screen 1
- Transformation = Screen 2
- Course Type = Screen 3
- Chapter Audit = Screen 4
- Module Map = Screen 5
- Lesson Map = Screen 6
- Implementation Asset Map = Screen 7
- Student Experience Plan = Screen 8
- Final Course Blueprint Summary = Screen 9

For each screen, this appendix shows:

1. **What the step receives as input** (which fields from Modules 1–6)
2. **What the AI agent(s) must do**
3. **What the approved output looks like** (structured JSON)
4. **What "good" and "bad" look like**

**Important:** This is ONE illustrative student. Module 8 must work for all niches — business, income, health, relationships, spirituality, skills. This example is a **reference shape**, not a template. The coding agent must not hardcode anything niche-specific from this appendix. The AI agents must learn the pattern, not the content.

---

## The Student Foundation (Inputs from Modules 1–6)

Before Module 8 begins, this student has already completed the beginner path. Here is the data Module 8 inherits from the database:

### From `clarity_sentences`
```json
{
  "full_sentence": "I help women struggling with infertility and silent grief feel whole again after years of emotional numbness through my Softening the Silence Framework.",
  "target_market": "women struggling with infertility and silent grief",
  "core_problem": "emotional numbness after years of unspoken pain",
  "unique_mechanism": "Softening the Silence Framework (Awareness, Expression, Reconnection)"
}
```

### From `ebooks`
```json
{
  "title": "Softening the Silence: A Healing Journey Through Infertility and Grief",
  "chapters": [
    {"chapter_number": 1, "title": "The Weight of Unspoken Pain", "core_lessons": "Naming pain, disenfranchised grief intro, early grounding practices"},
    {"chapter_number": 2, "title": "Understanding the Grief No One Talks About", "core_lessons": "Disenfranchised grief, psychological toll, why grief is valid"},
    {"chapter_number": 3, "title": "Why Numbness Becomes the Default", "core_lessons": "Freeze response, protective shutdown, cost of numbness, thawing"},
    {"chapter_number": 4, "title": "Introducing the Softening the Silence Framework", "core_lessons": "The 3 pillars overview"},
    {"chapter_number": 5, "title": "Pillar 1 – Awareness: Naming the Pain", "core_lessons": "Affect labeling, body scan, sentence starters"},
    {"chapter_number": 6, "title": "Pillar 2 – Expression: Giving Voice to Silence", "core_lessons": "Journaling, art, voice, movement, safe sharing"},
    {"chapter_number": 7, "title": "Pillar 3 – Reconnection: Coming Home to Yourself", "core_lessons": "Body, identity, spirit reconnection"},
    {"chapter_number": 8, "title": "Rewriting the Story of You", "core_lessons": "Narrative therapy, reframes, affirmations, visualization"},
    {"chapter_number": 9, "title": "Life After Numbness – What Healing Looks Like", "core_lessons": "Post-traumatic growth, nonlinear healing, setbacks"},
    {"chapter_number": 10, "title": "A Letter to the Silent Woman", "core_lessons": "Closing letter, practical next steps, blessing"}
  ]
}
```

### From `offers`
```json
{
  "selling_price": 300,
  "total_value": 3000,
  "bonuses": [
    {"name": "Unspoken Emotions Journal", "value_peso": 750, "objection_addressed": "Hindi ko alam paano i-express"},
    {"name": "Invisible Grief Tracker", "value_peso": 850, "objection_addressed": "Parang stuck lang ako"},
    {"name": "Comfort Rituals Cheat Sheet", "value_peso": 700, "objection_addressed": "Wala akong oras"},
    {"name": "Support Circle Starter Pack", "value_peso": 750, "objection_addressed": "Wala akong masabihan"}
  ],
  "guarantee": "30-Day Gentle Money-Back Guarantee"
}
```

### From `sales_pages`, `email_sequences`, `lead_magnets`, `content_posts`
All present and completed. Key elements Module 8 cares about:
- Voice/tone: compassionate, gentle, psychology-based, light Taglish
- Core emotional hook: "release the weight you've been carrying alone"
- Audience state: exhausted, low energy, numb, afraid of overwhelm

---

## Pre-Screen — Unlock Check

### What happens
The orchestrator checks whether the student is eligible for Module 8.

### Input
```json
{
  "user_id": "uuid",
  "access_level": "full_access",
  "enrolled_at": "2026-01-15T00:00:00Z",
  "module_progress": [
    {"module_number": 1, "completed_at": "2026-01-22T00:00:00Z"},
    {"module_number": 2, "completed_at": "2026-02-05T00:00:00Z"},
    {"module_number": 3, "completed_at": "2026-02-19T00:00:00Z"},
    {"module_number": 4, "completed_at": "2026-03-04T00:00:00Z"},
    {"module_number": 5, "completed_at": "2026-03-18T00:00:00Z"},
    {"module_number": 6, "completed_at": "2026-04-01T00:00:00Z"}
  ],
  "course_module_override": false
}
```

### Logic
- All 6 prior modules have `completed_at IS NOT NULL` ✓
- `access_level = 'full_access'` ✓
- `enrolled_at` was 97 days ago (≥ 60 days) ✓
- Result: **ELIGIBLE**

### Approved Output
```json
{
  "step": "unlock_check",
  "eligible": true,
  "reasons_passed": ["all_modules_completed", "full_access", "minimum_days_met"],
  "reasons_failed": [],
  "approved_at": "2026-04-22T14:30:00Z"
}
```

### What "bad" looks like
- Agent invents a "soft unlock" because user asks nicely — **REJECTED**. Unlock is deterministic, not AI-generated.
- Agent skips the day-count check because "modules are done" — **REJECTED**. All three conditions must hold.

---

## Screen 0 — Orientation

### What happens
User sees what Module 8 does, what KLARO will pull from their existing work, and what they will walk away with. **No AI generation at this step.** Pure UI.

### Approved Output
```json
{
  "screen": 0,
  "orientation_acknowledged_at": "2026-04-22T14:32:00Z",
  "orientation_version": "v1"
}
```

---

## Screen 1 — Readiness Evaluation

### What happens
The orchestrator asks the user a short self-assessment to confirm course creation is the right next step. This is a **gate**. If readiness is weak, Module 8 should recommend the user stabilize their e-book business first instead of building a course on a shaky foundation.

### Input
The user answers 5 categorical questions. Each answer is scored internally on a 0–2 scale. The user does not see the numeric points.

```json
{
  "ebook_finished_status": "finished",
  "ebook_sales_signal": "10_plus_sales",
  "buyer_feedback_signal": "yes_multiple",
  "audience_pull_signal": "yes_directly_asked",
  "time_energy_next_6_weeks": "some"
}
```

### Internal scoring logic
- `ebook_finished_status = finished` → 2
- `ebook_sales_signal = 10_plus_sales` → 2
- `buyer_feedback_signal = yes_multiple` → 2
- `audience_pull_signal = yes_directly_asked` → 2
- `time_energy_next_6_weeks = some` → 1

Total score range:
- 8–10 = Ready
- 5–7 = Borderline
- 0–4 = Not Ready

This example totals **9/10 → Ready**.

### Approved Output
```json
{
  "screen": 1,
  "readiness_score": 9,
  "readiness_verdict": "ready",
  "recommended_next_path": "course_ready",
  "coach_notes": "Student has enough traction and signal to proceed. Monitor emotional bandwidth at week 3 of build.",
  "approved_at": "2026-04-22T14:40:00Z"
}
```

### What "bad" looks like
- Agent writes 3 paragraphs of encouragement before giving the score. **REJECTED** — output must be structured data, not prose.
- Agent scores 10/10 because it wants to be nice. **REJECTED** — score must reflect actual answers.

- Agent writes 3 paragraphs of encouragement before giving the score. **REJECTED** — output must be structured data, not prose.
- Agent scores 10/10 because it wants to be nice. **REJECTED** — score must reflect actual answers.

---

## Screen 2 — Course Transformation Statement

### What happens
The user reviews and sharpens the *promised result* of the course. The e-book already has a transformation; the course transformation must be **bigger, more specific, and more outcome-driven**.

### Input
```json
{
  "ebook_transformation_implied": "Learn a framework to soften silent infertility grief",
  "clarity_sentence": "I help women struggling with infertility and silent grief feel whole again...",
  "chapter_9_outcomes": "laughing without forcing, feeling emotions without drowning, imagining a future"
}
```

### Course Creator Agent drafts 3 candidate transformation statements
```json
{
  "candidates": [
    "Help women carrying silent infertility grief move from emotional numbness to genuine aliveness in 6 weeks using the Softening the Silence Framework.",
    "Guide women through a 6-week gentle healing journey that transforms silent grief into a safe, integrated part of their life — so they can feel joy, speak their truth, and reconnect with who they are beyond infertility.",
    "In 6 weeks, a woman who has been emotionally numb for years will name her grief, express it safely, reconnect with her body and identity, and rewrite the story she tells herself — without rushing, forcing, or performing healing."
  ]
}
```

### Validator checks
- **Curriculum Validator**: Does each promise have a clear, testable outcome? → Candidate 3 is strongest (4 explicit outcomes).
- **Market Validator**: Does this justify a 10x+ price jump over ₱300 ebook? → Candidate 3 justifies ₱3,000–₱6,000 anchor.
- **Learner Experience Validator**: Is this overwhelming for an already-exhausted audience? → Candidate 3 explicitly addresses "without rushing" — passes.

### User approves Candidate 3 (possibly with edits)

### Approved Output
```json
{
  "screen": 2,
  "course_transformation_statement": "In 6 weeks, a woman who has been emotionally numb for years will name her grief, express it safely, reconnect with her body and identity, and rewrite the story she tells herself — without rushing, forcing, or performing healing.",
  "target_learner": "women who have been emotionally numb for years because of infertility and silent grief",
  "course_outcome": "name grief, express it safely, reconnect with body and identity, and rewrite the internal story",
  "unique_method": "Softening the Silence Framework (Awareness, Expression, Reconnection)",
  "implicit_outcomes": [
    "Name her grief out loud",
    "Express grief safely and regularly",
    "Reconnect with body and identity",
    "Rewrite her internal story"
  ],
  "duration_commitment": "6 weeks",
  "audience_protective_clause": "without rushing, forcing, or performing",
  "validator_scores": {"curriculum": 9, "market": 8, "learner_experience": 9},
  "approved_at": "2026-04-22T14:55:00Z"
}
```

### What "bad" looks like
- "Transform your life and heal completely." — **REJECTED** by Market Validator (generic, unfalsifiable).
- "Eliminate infertility grief forever using 47 proven techniques." — **REJECTED** by Learner Experience Validator (overwhelming, false promise).

---

## Screen 3 — Course Type Recommendation

### What happens
The system recommends **two independent values**, not one combined label:
1. `course_depth`
2. `delivery_format`

The recommendation must be justified by the audience state, price anchor, and transformation complexity.

### Closed list of course depth values
- `quick_start`
- `implementation`
- `deep_dive`

### Closed list of delivery format values
- `self_paced`
- `self_paced_with_support`
- `cohort_live`
- `hybrid_drip`
- `workshop_intensive`

### Course Creator Agent reasoning
```text
Audience state analysis:
- Emotional bandwidth: LOW (explicit in sales copy: "Wala akong oras", "exhausted")
- Need for privacy: HIGH (grief topic, not publicly shareable)
- Need for pacing control: HIGH ("at your own pace" is a core promise)
- Transformation complexity: MODERATE TO HIGH, because implementation and emotional safety matter

Recommended course_depth: implementation
- The learner needs a guided path, not just information
- The course must help the student do the healing practices, not only understand them

Recommended delivery_format: self_paced_with_support
- Preserves pacing control
- Adds premium support without forcing weekly attendance
- Better match than cohort_live or workshop_intensive for an exhausted audience
```

### Approved Output
```json
{
  "screen": 3,
  "course_depth": "implementation",
  "delivery_format": "self_paced_with_support",
  "course_type_rationale": "Your audience needs a guided implementation path, not a broad theory course. They also need privacy, pacing control, and emotional safety. Self-paced with support preserves the 'no rushing' promise while adding premium help.",
  "rejected_alternatives": [
    {"value": "cohort_live", "reason": "Conflicts with audience low-bandwidth state and privacy needs"},
    {"value": "workshop_intensive", "reason": "Violates the 'do not rush healing' promise"},
    {"value": "quick_start", "reason": "Too light for the emotional and implementation depth this topic requires"}
  ],
  "approved_at": "2026-04-22T15:05:00Z"
}
```

### What "bad" looks like
- Agent invents a new type called "Gentle Healing Journey Bundle™". **REJECTED** — must pick from closed lists.
- Agent recommends `cohort_live` because "it builds community". **REJECTED** — ignores audience bandwidth and privacy signal.

## Screen 4 — Chapter-to-Course Audit

### What happens
Every chapter from the e-book is classified using a **two-field closed verdict schema**. No free-form prose replaces the contract.

### Field 1: `structural_verdict` (pick one)
- `KEEP`
- `EXPAND`
- `MERGE`
- `SPLIT`
- `ADAPT`
- `MOVE`
- `REMOVE`

### Field 2: `support_needs` (multi-select)
- `demo_walkthrough`
- `worksheet`
- `template`
- `simplification`
- `none`

### Curriculum Validator Agent output
```json
{
  "screen": 4,
  "chapter_audit": [
    {
      "source_chapter_id": 1,
      "chapter_title": "The Weight of Unspoken Pain",
      "structural_verdict": "KEEP",
      "support_needs": ["worksheet"]
    },
    {
      "source_chapter_id": 2,
      "chapter_title": "Understanding the Grief No One Talks About",
      "structural_verdict": "MERGE",
      "support_needs": ["simplification"]
    },
    {
      "source_chapter_id": 3,
      "chapter_title": "Why Numbness Becomes the Default",
      "structural_verdict": "SPLIT",
      "support_needs": ["demo_walkthrough"]
    },
    {
      "source_chapter_id": 4,
      "chapter_title": "Introducing the Softening the Silence Framework",
      "structural_verdict": "KEEP",
      "support_needs": ["none"]
    },
    {
      "source_chapter_id": 5,
      "chapter_title": "Pillar 1 – Awareness: Naming the Pain",
      "structural_verdict": "EXPAND",
      "support_needs": ["worksheet", "template"]
    },
    {
      "source_chapter_id": 6,
      "chapter_title": "Pillar 2 – Expression: Giving Voice to Silence",
      "structural_verdict": "EXPAND",
      "support_needs": ["demo_walkthrough", "template"]
    },
    {
      "source_chapter_id": 7,
      "chapter_title": "Pillar 3 – Reconnection: Coming Home to Yourself",
      "structural_verdict": "EXPAND",
      "support_needs": ["worksheet"]
    },
    {
      "source_chapter_id": 8,
      "chapter_title": "Rewriting the Story of You",
      "structural_verdict": "KEEP",
      "support_needs": ["template"]
    },
    {
      "source_chapter_id": 9,
      "chapter_title": "Life After Numbness – What Healing Looks Like",
      "structural_verdict": "ADAPT",
      "support_needs": ["worksheet"]
    },
    {
      "source_chapter_id": 10,
      "chapter_title": "A Letter to the Silent Woman",
      "structural_verdict": "MOVE",
      "support_needs": ["none"]
    }
  ],
  "summary": {
    "KEEP": 3,
    "EXPAND": 3,
    "MERGE": 1,
    "SPLIT": 1,
    "ADAPT": 1,
    "MOVE": 1,
    "REMOVE": 0
  },
  "approved_at": "2026-04-22T15:20:00Z"
}
```

### What "bad" looks like
- Agent says "Chapter 2 is really meaningful and should absolutely be kept in full." **REJECTED** — prose, not the contract.
- Agent verdicts all 10 chapters as `KEEP`. **REJECTED** — this just copies the e-book, which is the failure mode Module 8 exists to prevent.

## Screen 5 — Module Map


### What happens
Using the chapter audit, the Course Creator Agent drafts the module structure. **Anti-slop rule: no course may have more than 7 modules in Phase 1.**

### Approved Output
```json
{
  "screen": 5,
  "modules": [
    {
      "module_number": 1,
      "title": "The Weight You Carry",
      "transformation": "Student can name her grief out loud and understand why it became silent.",
      "estimated_lessons": 4,
      "source_chapters": [1, 2, 3]
    },
    {
      "module_number": 2,
      "title": "The Softening Path",
      "transformation": "Student understands the 3-pillar framework and commits to walking it.",
      "estimated_lessons": 2,
      "source_chapters": [4]
    },
    {
      "module_number": 3,
      "title": "Pillar 1 — Awareness",
      "transformation": "Student can name what she feels, in her body and in her words, daily.",
      "estimated_lessons": 4,
      "source_chapters": [5]
    },
    {
      "module_number": 4,
      "title": "Pillar 2 — Expression",
      "transformation": "Student has a sustainable daily expression practice in at least one modality.",
      "estimated_lessons": 4,
      "source_chapters": [6]
    },
    {
      "module_number": 5,
      "title": "Pillar 3 — Reconnection",
      "transformation": "Student reconnects with body, identity, and spirit through weekly rituals.",
      "estimated_lessons": 4,
      "source_chapters": [7]
    },
    {
      "module_number": 6,
      "title": "Rewriting Your Story",
      "transformation": "Student rewrites the internal narrative and recognizes her own signs of healing.",
      "estimated_lessons": 3,
      "source_chapters": [8, 9, 10]
    }
  ],
  "total_modules": 6,
  "total_estimated_lessons": 21,
  "validator_checks": {
    "module_count_within_limit": true,
    "each_module_has_testable_transformation": true,
    "logical_progression": true,
    "no_redundancy": true
  },
  "approved_at": "2026-04-22T15:35:00Z"
}
```

### What "bad" looks like
- 12 modules. **REJECTED** — exceeds anti-slop limit of 7.
- Module titles like "Module 1: Everything You Need to Know About Silent Grief". **REJECTED** — vague, kitchen-sink framing.

---

## Screen 6 — Lesson Map

### What happens
For each module, the Course Creator Agent drafts lesson titles + one-sentence outcome per lesson. **Anti-slop rule: no module may have more than 6 lessons. No lesson description may exceed 2 sentences at blueprint stage.**

### Approved Output (abbreviated — showing Module 3 only as illustration)
```json
{
  "screen": 6,
  "module_3": {
    "title": "Pillar 1 — Awareness",
    "lessons": [
      {
        "lesson_number": 1,
        "title": "The Weather Inside You",
        "outcome": "Student completes a 7-day one-word emotional weather log.",
        "estimated_length_minutes": 15
      },
      {
        "lesson_number": 2,
        "title": "Where Grief Lives in the Body",
        "outcome": "Student completes a guided body scan and identifies 3 physical signal points.",
        "estimated_length_minutes": 20
      },
      {
        "lesson_number": 3,
        "title": "Sentence Starters for the Unsayable",
        "outcome": "Student writes 5 awareness sentences using structured prompts.",
        "estimated_length_minutes": 20
      },
      {
        "lesson_number": 4,
        "title": "Permission to Feel",
        "outcome": "Student writes and signs her own Permission List.",
        "estimated_length_minutes": 15
      }
    ]
  },
  "anti_slop_checks": {
    "max_6_lessons_per_module": true,
    "all_descriptions_under_2_sentences": true,
    "no_banned_words_in_titles": true,
    "every_lesson_has_testable_outcome": true
  },
  "approved_at": "2026-04-22T15:50:00Z"
}
```

### What "bad" looks like
- Lesson title: "The Complete Ultimate Guide to Mastering Your Awareness Journey". **REJECTED** — contains banned words (Complete, Ultimate, Mastering).
- Lesson outcome: "Student will gain a deep understanding and profound insight into the transformative power of awareness." **REJECTED** — not testable, pure AI slop.

---

## Screen 7 — Implementation Asset Map

### What happens
For each module, the Learner Experience Validator Agent identifies what **implementation support** is needed. Assets come from the canonical closed list.

### Canonical asset type list
- `video`
- `text_lesson`
- `worksheet`
- `checklist`
- `prompt_pack`
- `template`
- `tracker`
- `audio_guide`
- `script_card`
- `demo_walkthrough`
- `case_study`
- `faq`

### Rule
Each approved module gets a minimum of **1** and maximum of **3** implementation assets. Final blueprint approval requires asset coverage across **all approved modules**.

### Approved Output
```json
{
  "screen": 7,
  "module_assets": [
    {
      "module_number": 1,
      "assets": [
        {"type": "worksheet", "title": "The Weight Inventory", "purpose": "Surface and name what the student has been carrying"}
      ]
    },
    {
      "module_number": 2,
      "assets": [
        {"type": "checklist", "title": "Your Softening Path Setup", "purpose": "Help the student prepare emotionally and practically for the framework journey"}
      ]
    },
    {
      "module_number": 3,
      "assets": [
        {"type": "tracker", "title": "7-Day Weather Log", "purpose": "Build awareness muscle through daily naming"},
        {"type": "audio_guide", "title": "The 5-Minute Body Scan", "purpose": "Guide the body-awareness practice"},
        {"type": "prompt_pack", "title": "25 Awareness Sentence Starters", "purpose": "Break through emotional suppression"}
      ]
    },
    {
      "module_number": 4,
      "assets": [
        {"type": "prompt_pack", "title": "Expression Modalities Menu", "purpose": "Let student choose her natural expression channel"},
        {"type": "demo_walkthrough", "title": "The Shaking Release Practice", "purpose": "Demonstrate a body-based expression practice without words"}
      ]
    },
    {
      "module_number": 5,
      "assets": [
        {"type": "audio_guide", "title": "Coming Home Ritual", "purpose": "Support weekly reconnection practice"},
        {"type": "checklist", "title": "Reconnection Ritual Checklist", "purpose": "Turn reconnection into a repeatable rhythm"}
      ]
    },
    {
      "module_number": 6,
      "assets": [
        {"type": "script_card", "title": "Support Circle Starter Script", "purpose": "Help the student speak to a trusted person without overexplaining"},
        {"type": "template", "title": "Rewrite Your Story Template", "purpose": "Guide the student through a gentle narrative rewrite"}
      ]
    }
  ],
  "reused_from_offer_stack": [
    "Unspoken Emotions Journal → adapt as Module 4 prompt_pack",
    "Invisible Grief Tracker → adapt as Module 3 tracker",
    "Comfort Rituals Cheat Sheet → adapt as Module 5 checklist",
    "Support Circle Starter Pack → adapt as Module 6 script_card"
  ],
  "asset_coverage_complete": true,
  "approved_at": "2026-04-22T16:05:00Z"
}
```

### Why this is important
The student already *has* 4 bonus assets from her offer stack. Module 8 recognizes them and **repurposes** them instead of inventing new ones. This is a core anti-slop behavior.

### What "bad" looks like
- Every module gets 7 assets. **REJECTED** — exceeds 3-per-module limit.
- Agent invents a new asset type called "Soul Journey Companion Bundle". **REJECTED** — must pick from the canonical closed list.
- Agent ignores the existing offer stack bonuses. **REJECTED** — fails to reuse approved work.

## Screen 8 — Student Experience Plan


### What happens
Final step before Phase 1 completes. Defines **how** the course is delivered and experienced. Uses a structured schema.

### Schema (fixed fields)
```json
{
  "delivery_cadence": "enum: all_at_once | weekly_drip | biweekly_drip | self_paced_unlocked",
  "support_channel": "enum: none | async_email | group_chat | live_monthly | live_weekly | one_on_one",
  "community_access": "enum: none | optional_private | required_private | public",
  "live_session_frequency": "enum: none | monthly | biweekly | weekly",
  "completion_model": "enum: none | self_report | milestone_checkpoints | coach_verified",
  "certification": "enum: none | completion_badge | formal_certificate"
}
```

### Approved Output
```json
{
  "screen": 8,
  "plan": {
    "delivery_cadence": "self_paced_unlocked",
    "support_channel": "live_monthly",
    "community_access": "optional_private",
    "live_session_frequency": "monthly",
    "completion_model": "self_report",
    "certification": "none"
  },
  "rationale_for_user": "Your audience explicitly struggles with pressure and timelines. Every choice here protects their pace. Self-paced unlocks honor the 'no rushing' promise. Optional community means they can lurk without pressure to post. Monthly Sanctuary Calls give premium support without weekly obligation. No certification — completion is internal, not performative.",
  "approved_at": "2026-04-22T16:15:00Z"
}
```

### What "bad" looks like
- `"community_access": "required_private"` for a grief audience. **REJECTED** by Learner Experience Validator — forces social labor on exhausted audience.
- `"completion_model": "coach_verified"` adding surveillance pressure. **REJECTED** — conflicts with transformation statement's "without performing" clause.

---

## Screen 9 — Course Blueprint Summary

### What happens
The orchestrator assembles all approved outputs from Screen 1 through Screen 8 into a single **Course Blueprint** document. This is what the student ends Module 8 with.

### Approved Blueprint (top-level shape)
```json
{
  "blueprint_id": "uuid",
  "user_id": "uuid",
  "created_at": "2026-04-22T16:20:00Z",
  "module_8_completion_status": "blueprint_approved",
  "blueprint_version": 1,
  "course_name_draft": "Softening the Silence: The 6-Week Gentle Healing Course",
  "course_transformation_statement": "{from Screen 2}",
  "course_depth": "{from Screen 3}",
  "delivery_format": "{from Screen 3}",
  "suggested_price_peso": 4500,
  "duration": "6 weeks",
  "total_modules": 6,
  "total_lessons": 21,
  "total_implementation_assets": 11,
  "experience_plan": "{from Screen 8}",
  "chapter_audit": "{from Screen 4}",
  "module_map": "{from Screen 5}",
  "lesson_map": "{from Screen 6}",
  "asset_map": "{from Screen 7}",
  "validator_scores_summary": {
    "curriculum": 9,
    "market": 8,
    "learner_experience": 9,
    "anti_slop_compliance": "all_checks_passed"
  }
}
```

This blueprint is what detailed lesson drafting will consume as input. **No long-form lesson content has been generated yet.** That is correct. Architecture first, content second.

## What This Worked Example Proves


1. Every step produces **structured data**, not prose — a coding agent can implement storage and UI with zero ambiguity.
2. Every AI decision is **bounded** (closed lists, hard limits, validator gates) — slop cannot escape.
3. Existing student assets (offer stack bonuses, chapter content) are **reused**, not reinvented.
4. The hardest niche (emotional healing, not business/income) was handled cleanly — so easier niches will handle even better.
5. Nothing here required one-shot generation. Every step is small, reviewable, revisable.

---

## Reminder to the Coding Agent

This appendix shows **one** student foundation. The actual Module 8 system must:
- Accept any clarity sentence, any ebook, any niche.
- Never hardcode infertility, grief, healing, or any specific domain vocabulary.
- Use the data shapes shown here as the **contract** for what each step must produce.
- Treat the closed lists (course types, verdict types, asset types, schema enums) as **enforced** constraints, not suggestions.
