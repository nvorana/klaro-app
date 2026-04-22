# 02. Product Flow and UX Spec
## KLARO Module 8: Course Expansion

## Document Purpose
This document defines the user-facing product flow and UX behavior for KLARO Module 8: Course Expansion.

This is the app behavior document.

It explains:
- what the user sees
- what the app asks for
- what KLARO auto-pulls from prior modules
- what decisions the user must make
- what outputs are created at each step
- how save, edit, review, regenerate, and progression should work
- what edge cases and failure modes must be handled

This document is intentionally focused on product flow and user experience, not low-level implementation details.

**Future revision note:** A Module 8 Vocabulary Lock document does not exist yet. When it is created, this document must defer to it as the source of truth for all closed lists, field names, and enum values.

---

# 1. Module Identity

## Module Name
**Module 8: Turn Your E-book Into a Course**

## Internal Product Name
**Course Expansion**

## Role Inside KLARO
Module 8 is an advanced post-e-book module that helps the student convert their existing e-book, clarity foundation, offer, and sales messaging into a structured, high-value course.

This module is not meant for brand-new beginners starting from scratch.

Modules 1 to 7 help the student:
- gain clarity
- create an e-book
- shape an offer
- write a sales page
- generate emails
- create a lead magnet
- create content assets

Module 8 helps them evolve those assets into a course.

---

# 2. Core UX Philosophy

Module 8 must feel:
- guided
- calm
- intelligent
- anti-overwhelm
- anti-slop
- outcome-first
- modular
- editable
- structured

It must not feel like:
- a blank page
- a giant prompt box
- a one-shot AI generator
- a confusing course factory
- a dumping ground for everything they know

## User Promise
The user should feel:

> “KLARO already knows my business. It is helping me make smart decisions, not just generate words.”

## UX Principle
**Decide first, generate second.**

The app must guide the user through strategic decisions before generating detailed course assets.

---

# 3. Unlock Logic

## Recommended Unlock Logic
Module 8 should remain locked until one of the following is true:
- student completes Modules 1 to 7
- student reaches a defined program milestone
- coach/admin manually unlocks Module 8
- enough required source assets exist to support course conversion

## Preferred Default Rule
Recommended default:
- unlocked after Modules 1 to 7 are completed
- optionally delayed by time or coach approval depending on program logic

## Why This Matters
This preserves beginner simplicity and prevents course creation from distracting early users.

---

# 4. Required Existing Inputs

Before Module 8 begins, KLARO should auto-pull existing user data from prior modules.

## Required Inputs
- clarity sentence
- target market
- problem statement
- unique mechanism or solution approach
- e-book title
- e-book chapter list
- e-book summary or chapter summaries if available
- offer statement
- offer structure
- sales page promise/headline if available
- major objections if already captured

## Nice-to-Have Inputs
- email hooks
- FAQ copy
- lead magnet angle
- testimonial or proof inputs
- past student/customer questions

## UX Behavior
The user should not be asked to re-enter information KLARO already has.

The module should clearly communicate:

> “We pulled this from your earlier work. Review and improve it if needed.”

---

# 5. Module-Level Flow Overview

Module 8 has 10 backend steps rendered as 10 user-facing screens (Screen 0 through Screen 9).

Screen 0: Welcome / Orientation
Screen 1: Course Readiness Check
Screen 2: Reconfirm the Transformation
Screen 3: Choose the Right Course Type
Screen 4: Audit the E-book Before Turning It Into a Course
Screen 5: Build the Course Skeleton
Screen 6: Break Modules Into Lessons
Screen 7: Add the Implementation Layer
Screen 8: Define the Student Experience
Screen 9: Final Course Blueprint Summary

Unlock gating (access check) happens before Screen 0 and is invisible to the user. It is handled by the orchestrator, not a screen.

---

# 6. Screen-by-Screen UX Spec

## Screen 0: Module 8 Landing / Welcome

### Purpose
Orient the user and set expectations.

### What the User Sees
**Title:** Turn Your E-book Into a Course

**Subheadline:**
You already built the foundation. Now KLARO will help you turn your e-book, offer, and core method into a structured, high-value course.

### Show These Sections
#### What KLARO Will Use
- your clarity sentence
- your e-book
- your offer
- your sales message
- your existing product promise

#### What You’ll Build
- your course promise
- your course structure
- your module outline
- your lesson breakdown
- implementation tools
- your student experience plan

#### Important Note
This is not about turning every page of your e-book into a video. It’s about helping your students get the result with less confusion.

### Primary CTA
**Start Module 8**

### Secondary CTA
**Review My Existing Materials**

### Output Saved
- orientation_acknowledged_at
- orientation_version

---

## Screen 1: Course Readiness Check

### Purpose
Determine whether a course is the right next step and what kind of course path KLARO should recommend.

### What the App Asks
1. Is your e-book finished?
   - Yes
   - Almost finished
   - No

2. Have you sold this e-book yet?
   - Yes, multiple times
   - Yes, a few times
   - Not yet

3. Why do you want to create a course now?
   - I want a higher-value product
   - My topic needs step-by-step guidance
   - My customers need more support to get results
   - I want a more premium version of my idea
   - I want a path toward coaching or consulting
   - Other

4. What should this course do?
   - Help beginners get started
   - Help students implement the e-book
   - Go deeper than the e-book
   - Prepare students for coaching
   - Replace the e-book

5. How much time/energy do you realistically have over the next 6 weeks to build this?
   - plenty
   - some
   - very little

### Internal Scoring Logic
Each answer is scored internally on a 0–2 scale. The user does not see the numeric score.

Total score range: 0–10.

Thresholds:
- 8–10 = Ready
- 5–7 = Borderline
- 0–4 = Not Ready

### What KLARO Should Do
Generate both a readiness verdict and a qualitative recommendation:
- course-ready
- workshop may be better
- needs clearer proof first
- better as an implementation course
- better as a quick-start course

### UX Rule
This step should feel advisory, not punitive.

### Output Saved
- readiness_score
- readiness_verdict
- recommended_next_path
- coach_notes

### Primary CTA
**Continue**

### Secondary CTA
**Edit Answers**

---

## Screen 2: Reconfirm the Transformation

### Purpose
Turn the e-book promise into a course transformation statement.

### What KLARO Auto-Fills
- who the course is for
- painful problem
- promise from clarity sentence
- unique mechanism

### What the App Asks the User to Review or Add
1. Who is this course for?
2. What painful problem are they trying to solve?
3. What exact result should they get by the end?
4. What method or approach are you teaching?
5. What should students be able to DO after finishing this course?

### UX Guidance Message
A course should not only teach ideas. It should help people do something.

### What KLARO Generates
- course transformation statement
- end-of-course outcome statement
- student capability statement

### Output Saved
- approved_course_audience
- approved_course_problem
- approved_course_result
- approved_course_method
- approved_course_transformation_statement
- approved_end_of_course_capability

### User Actions
- Accept
- Edit manually
- Regenerate
- Save draft

---

## Screen 3: Choose the Right Course Type

### Purpose
Help the user choose the most appropriate course depth and delivery format.

### UX Model
The user makes two independent choices, not one combined choice.

### Choice 1: Course Depth
Closed list only:
- quick_start
- implementation
- deep_dive

### Choice 2: Delivery Format
Closed list only:
- self_paced
- self_paced_with_support
- cohort_live
- hybrid_drip
- workshop_intensive

### What the App Asks
1. Which course depth fits the transformation best?
2. Which delivery format fits the audience, promise, and current business model best?

### What KLARO Generates
- one recommended value from the course depth list
- one recommended value from the delivery format list
- rationale for each recommendation
- rejected alternatives with brief explanation

### UX Rule
KLARO should recommend one value from each list based on the transformation statement and audience, with rationale.
The user may accept, override, or regenerate each recommendation independently.

### Output Saved
- approved_course_depth
- approved_delivery_format
- course_type_rationale
- rejected_alternatives

---

## Screen 4: Audit the E-book Before Turning It Into a Course

### Purpose
Help the user decide what parts of the e-book belong in the course and what kind of support each chapter needs.

### What the User Sees
A list of e-book chapters pulled from Module 2.

### For Each Chapter, User Can Classify
Each chapter gets two fields.

#### Field 1: structural_verdict
Closed list, pick one:
- KEEP
- EXPAND
- MERGE
- SPLIT
- ADAPT
- MOVE
- REMOVE

Definitions:
- KEEP — carries forward largely intact
- EXPAND — becomes a full module
- MERGE — combined with another chapter
- SPLIT — becomes two or more lessons
- ADAPT — reused but reframed
- MOVE — relocated to intro, closing, or bonus position
- REMOVE — does not carry into the course

#### Field 2: support_needs
Closed list, multi-select:
- demo_walkthrough
- worksheet
- template
- simplification
- none

### UX Guidance Message
Not every chapter should become a lesson. Your e-book is raw material, not the final course structure.

### What KLARO Generates
Per chapter, a recommendation with rationale.

Example outputs:
- KEEP with simplification
- MERGE with Chapter 4 and add demo_walkthrough
- MOVE to bonus position with none
- ADAPT with worksheet and template

### Output Saved
- chapter_audit_map
- chapter_structural_verdicts
- chapter_support_needs
- chapter_recommendation_notes

### User Actions
- Accept recommendation
- Override classification
- Add note
- Regenerate for one chapter only

### Important UX Rule
The user must be able to review chapter by chapter. Avoid one giant output block.

---

## Screen 5: Build the Course Skeleton

### Purpose
Create the module-level structure.

### What the User Sees
KLARO proposes:
- course title options
- number of modules
- module names
- module outcomes
- recommended sequence

### What the App Asks the User to Confirm
1. How many modules should this course have?
2. Does this sequence feel logical for the student?
3. Is anything missing?
4. Is anything unnecessary?

### UX Guidance Message
Your course should follow the student’s journey, not just your knowledge categories.

### What KLARO Generates
- recommended 4 to 7 module structure
- one outcome per module
- sequence rationale

### Output Saved
- approved_course_title
- approved_module_count
- approved_module_map
- approved_module_outcomes
- approved_module_sequence_notes

### User Actions
- Accept structure
- Rename modules
- Reorder modules
- Regenerate full structure
- Regenerate selected module only

---

## Screen 6: Break Modules Into Lessons

### Purpose
Turn modules into practical lessons without bloat.

### UX Structure
This should be done one module at a time, not all modules at once.

### For Each Module, Ask
1. What should students understand here?
2. What should students do here?
3. What should students complete before moving on?

### What KLARO Generates
For each module:
- 3 to 5 lesson titles
- lesson objective
- lesson action step
- recommended asset type from the canonical list

### Canonical Asset Type List
Use this closed list everywhere in the document:
- video
- text_lesson
- worksheet
- checklist
- prompt_pack
- template
- tracker
- audio_guide
- script_card
- demo_walkthrough
- case_study
- faq

### Output Saved
- lesson_map_by_module
- lesson_objectives
- lesson_action_steps
- lesson_asset_type_recommendations

### UX Rule
Do not encourage overproduction. Default recommendation should be concise.

### User Actions
- Accept lesson set
- Edit lesson titles
- Add lesson manually
- Remove lesson
- Regenerate per module
- Mark lesson as optional or required

---

## Screen 7: Add the Implementation Layer

### Purpose
Upgrade the course from information to execution.

### What the User Sees
For each module, KLARO asks:

Which implementation assets would help your student most here?

Use only the canonical closed list:
- video
- text_lesson
- worksheet
- checklist
- prompt_pack
- template
- tracker
- audio_guide
- script_card
- demo_walkthrough
- case_study
- faq

### Rule
Each module has a minimum of 1 and maximum of 3 implementation assets.

### What KLARO Generates
For each module:
- recommended implementation assets
- rationale for each asset
- draft versions later in follow-up builders

### UX Guidance Message
Students are happiest when they know exactly what to do next.

### Output Saved
- implementation_asset_plan
- asset_type_by_module
- implementation_support_notes

### User Actions
- accept asset suggestions
- remove asset
- add asset manually
- regenerate asset plan per module

---

## Screen 8: Define the Student Experience

### Purpose
Design how the student will move through the course.

### What the App Asks
1. How will this course be delivered?
   - self_paced
   - self_paced_with_support
   - cohort_live
   - hybrid_drip
   - workshop_intensive

2. Should students get everything at once or step by step?
   - all unlocked
   - drip over time
   - module-by-module release

3. What pace do you want students to follow?
   - 7-day sprint
   - 14-day sprint
   - 30-day guided journey
   - flexible/self-paced

4. Will there be assignments or checkpoints?
   - yes
   - no

5. Will there be support?
   - none
   - community only
   - live calls
   - coach feedback

### What KLARO Generates
- recommended student completion timeline
- suggested onboarding message
- progress milestone plan
- completion support recommendations

### Output Saved
- delivery_model
- release_model
- pacing_model
- support_model
- student_experience_plan
- onboarding_outline
- milestone_plan

### UX Guidance Message
The course experience begins after the content is uploaded. Completion should be designed.

---

## Screen 9: Final Course Blueprint Summary

### Purpose
Give the user a structured summary of everything approved so far.

### What the User Sees
A clean summary of:
- course title
- target student
- transformation statement
- course depth
- delivery format
- module map
- lesson map
- implementation assets
- student experience model

### Primary CTA
**Continue to Build Course Assets**

### Secondary CTAs
- Edit blueprint
- Export blueprint
- Save for later

### Output Saved
- final_course_blueprint
- blueprint_version
- module_8_completion_status
- blueprint_approved_at

---

# 7. User Decisions the Module Must Force

Module 8 must force high-value decisions instead of encouraging passive generation.

## Required Decisions
1. Is a course really the right next product?
2. What exact transformation should the course create?
3. What course depth is most appropriate?
4. What delivery format is most appropriate?
5. What content from the e-book belongs in the course?
6. What should students do, not just know?
7. What support assets are needed?
8. What kind of student experience will this course create?

If these decisions are not made, the course quality will suffer.

---

# 8. Assumptions the UX Should Challenge

The module should actively challenge these assumptions throughout the flow.

## Assumption 1
“My course should contain everything I know.”

### Correction
A valuable course is about helping students get the result with less confusion.

## Assumption 2
“Every chapter should become a lesson.”

### Correction
Some chapters should be merged, removed, simplified, adapted, moved, or turned into support material.

## Assumption 3
“A longer course is more valuable.”

### Correction
Longer often lowers completion and creates overwhelm.

## Assumption 4
“Video automatically makes it premium.”

### Correction
Sometimes a worksheet, checklist, prompt_pack, template, tracker, or demo_walkthrough is more useful than a long video.

## Assumption 5
“Once the content exists, the course is done.”

### Correction
The student experience must also be designed.

---

# 9. Save, Edit, and Regenerate Behavior

## Save Rules
- save structured outputs after each step
- allow save draft before approval
- preserve both AI draft and user-approved version where useful

## Edit Rules
The user must be able to:
- edit AI outputs manually
- rename modules and lessons
- reorder modules and lessons
- override recommendations

## Regenerate Rules
Regeneration should be scoped.

Allowed:
- regenerate one section
- regenerate one module
- regenerate one chapter audit
- regenerate one lesson set

Avoid:
- regenerate the entire module after deep user editing unless user explicitly wants that

Each regenerate action is limited to 5 uses per 24-hour rolling window per user per step. After 5 regenerations on a single step, the regenerate button for that step is disabled until the window resets. The disabled state shows this message: "You've regenerated this 5 times today. Try editing manually, or come back tomorrow with fresh eyes."

## UX Principle
Regeneration should feel precise, not destructive.

---

# 10. Progress and Navigation

## Progress Display
Show clear progress like:
- Screen 1 of 10
- Module 8 progress bar
- section completed indicators

## Navigation Rules
Allow:
- back to prior screen
- save and exit
- continue later
- revisit approved screen for edits

Editing any of the following fields after approval triggers a mandatory confirmation dialog before the edit is saved:
- course_transformation_statement (affects all downstream steps)
- course_depth or delivery_format (affects module map, lesson map, experience plan)
- module_map (affects lesson map, asset map)
- lesson_map (affects asset map)

The dialog must state which downstream steps will be flagged as "may need review" and require explicit user confirmation. Flagged downstream steps get a yellow warning badge until the user revisits and re-approves them.

Example:
> Changing your course transformation may require reworking your module outline.

---

# 11. Error States and Edge Cases

## Edge Case 1: Missing E-book Data
If chapter data or source materials are missing:
- explain what is missing
- provide option to sync prior module output
- allow manual input fallback

## Edge Case 2: E-book Too Weak or Incomplete
If readiness result says the foundation is weak:
- explain why
- recommend what to improve first
- allow user to proceed only if they understand the risk, or direct them back to improve source material

## Edge Case 3: User Wants a Course Too Broad for Beginners
KLARO should warn when:
- promise is too broad
- modules are too many
- lesson count is exploding
- student level is inconsistent

## Edge Case 4: User Already Has Existing Course Materials
Allow optional upload or paste later in deeper builders, but do not require everything at blueprint stage.

## Edge Case 5: User Stops Midway
Module 8 must support resumable progress with structured saved state.

## Edge Case 6: User Overrides Smart Recommendations
Allow this, but preserve AI notes and warnings where useful.

---

# 12. Downstream Builders That Should Follow Module 8

Module 8 should end with a blueprint, not full production of every detailed asset.

After the blueprint is approved, future builders may include:
- lesson content builder
- worksheet builder
- checklist builder
- prompt pack builder
- course sales page adapter
- course launch email builder
- onboarding and milestone builder

This keeps Module 8 focused on architecture and quality decisions first.

---

# 13. Definition of Done for Product Flow

Module 8 product flow is successful when the user exits with:
- an approved course transformation statement
- approved course depth and delivery format
- a vetted chapter audit with structural_verdict and support_needs per chapter
- a clear module map with outcomes
- a lesson map by module
- an implementation asset plan using the canonical asset type list
- a student experience plan
- a final approved course blueprint ready for downstream builders
