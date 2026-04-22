# 04. Reusable Quality Control Pipeline

## Document Purpose

This document defines the reusable quality control pipeline for KLARO knowledge-product builders. It is designed to work first for Module 8: Course Expansion, but it must be reusable later for other builder types such as workshops, live events, webinars, coaching programs, mini-courses, and challenges.

This is Document 4 of 5 for the KLARO Module 8 handoff set.

This document defines:
- universal QC principles
- reusable validator stages
- scoring and pass logic
- anti-slop enforcement
- revision loop behavior
- rule-based checks
- LLM-based checks
- product-type-specific QC extensions

This document does **not** replace the product-specific UX flow in Document 2 or the orchestration mechanics in Document 3. It provides the reusable validation layer that those documents call into.

---

## Relationship to Other Documents

This document should be read alongside:
- `01_Master_System_Handoff_Module8_Course_Expansion_v4.md`
- `02_Product_Flow_and_UX_Spec_Module8_Course_Expansion_v3.md`
- `03_Agent_and_Orchestration_Architecture_Module8_Course_Expansion_v5.md`

If this document conflicts with:
- **Document 2** on screen sequence or user flow, Document 2 wins.
- **Document 3** on who calls whom, scoring execution, or orchestration behavior, Document 3 wins.
- **Appendix A** on JSON field names or step output contract, Appendix A wins.

This document is the source of truth for:
- reusable QC concepts
- validator rubric structure
- anti-slop review categories
- default QC rules that can be extended by product type

---

## QC Philosophy

The QC pipeline exists to prevent the system from producing polished but weak outputs.

The pipeline must optimize for:
- clarity over cleverness
- learner progress over content volume
- structure over verbosity
- useful differentiation over inflated language
- completion over comprehensiveness
- user escalation over weak auto-pass when quality is uncertain

A knowledge product should not pass QC because it sounds good. It should pass because it is:
- strategically aligned
- instructionally sound
- commercially believable
- implementable
- not bloated
- not repetitive
- not AI-slop

---

## Reusable QC Layers

All knowledge-product builders should pass through the same five QC layers.

### Layer 1: Structural Integrity
Checks whether the draft has a coherent shape.

Questions:
- Is the structure complete enough for this stage?
- Is the sequence logical?
- Are there obvious gaps, overlaps, or redundancies?
- Are step outputs valid for the current stage?

Typical failure examples:
- too many modules
- duplicate lessons
- missing learner outcomes
- unsupported transitions between sections

### Layer 2: Learner Progression
Checks whether the learner can realistically move through the product.

Questions:
- Is the sequence beginner-friendly?
- Does each section tell the learner what to do next?
- Is the product likely to create momentum?
- Where is the learner likely to get stuck?

Typical failure examples:
- theory overload
- unclear next actions
- large jumps in difficulty
- weak implementation support

### Layer 3: Market Value
Checks whether the product feels worth buying and solves a real problem.

Questions:
- Is the promise specific enough?
- Is the scope aligned with the perceived value?
- Does this solve a meaningful pain point?
- Is this differentiated enough from generic free content?

Typical failure examples:
- vague transformation
- commodity positioning
- bloated scope without stronger value
- mismatch between audience and promise

### Layer 4: Anti-Slop
Checks whether the output is padded, generic, repetitive, or fake-deep.

Questions:
- Is this saying something concrete?
- Is language inflated or empty?
- Are titles generic?
- Is there repetition disguised as depth?

Typical failure examples:
- “ultimate,” “complete,” or “mastering” titles
- repeated lesson ideas across modules
- fluffy descriptions
- premium-sounding filler

### Layer 5: Output Contract Integrity
Checks whether the output is valid for downstream use.

This is a **conceptual QC layer**, not a separate execution stage. In practice, Output Contract Integrity checks are executed during:
- **Stage A: Rule-Based Precheck** before LLM validators run
- **Stage E: Recheck** after revision

They do **not** run during Stage B because validators are not expected to produce schema violations.

Questions:
- Are required fields present?
- Are closed-list values valid?
- Does the JSON shape match the expected schema?
- Are there invalid enums or extra unsupported values?

Typical failure examples:
- wrong field names
- missing required objects
- invalid enum values
- mixing free text into a closed list field

---

## Universal QC Stages

All builder types should use the same stage pattern.

### Stage A: Rule-Based Precheck
Fast checks before LLM validators run.

This is the primary execution point for **Layer 5: Output Contract Integrity** checks.

Use this stage to catch:
- count limits
- empty required fields
- invalid enum values
- duplicate title heuristics
- banned hype words
- overlong descriptions at blueprint stage
- schema and output-contract violations

If the draft fails a hard rule here, it should not proceed to LLM validation until revised.

### Stage B: Validator Review
Run the assigned LLM validators for the current step.

The exact validators and weights are defined by the orchestration document, but the QC pipeline provides the rubrics they should use.

### Stage C: Aggregation
Combine:
- rule-based results
- validator scores
- validator comments
- hard-rule failures
- revision recommendations

### Stage D: Revision
If required, revise only the failed or weak parts.

The reviser must preserve approved content whenever possible. It must not rewrite the entire artifact unless the orchestrator explicitly allows a full rebuild.

### Stage E: Recheck
After revision, run:
- hard rules again
- output contract checks again
- the assigned validators again
- a lightweight drift check to ensure the revision did not break approved upstream logic

For this system, the lightweight drift check is concrete and deterministic:
- use the step's Required Context table from Document 3 to identify approved upstream fields that must remain unchanged
- run string equality comparison on those approved upstream values against the revised draft
- if any approved upstream value has been modified inside the revised draft, reject the revision as `drift_detected`
- return the revision to the Revision Agent with the instruction: `Do not modify approved upstream values.`

This drift check is not an LLM judgment call. It is a rule-based comparison against approved upstream context.

---

## Universal Pass Logic

Document 3 defines the live scoring behavior. This document defines the reusable logic model.

### Standard result states
- `pass`
- `pass_with_notes`
- `revise`
- `escalate`
- `blocked_by_rule`

### General policy
- Hard-rule failures can block a pass even when validator scores are high.
- Validator scores can force revision even when no hard rule fails.
- Repeated revision failure should escalate rather than auto-pass weak work.
- The system should prefer user escalation over hidden quality compromise.

### Default interpretation
- `blocked_by_rule`: one or more hard-rule failures must be fixed before full validation
- `revise`: validator score band or qualitative feedback says the step is salvageable without user intervention
- `escalate`: the system lacks confidence, revisions stalled, or the business choice is genuinely ambiguous

---

## Universal Hard Rules

These are reusable across most knowledge-product builders unless a product-specific extension overrides them.

### 1. Require one clear outcome per major section
Every module, session, or major block must declare one specific learner or attendee outcome.

Fail if:
- outcome is missing
- outcome is vague
- outcome is purely descriptive and not learner-centered

### 2. Reject oversized structures at blueprint stage
Blueprint-stage drafts must stay compact.

Default limits for courses:
- max 7 modules
- max 6 lessons per module
- lesson description max 2 sentences at blueprint stage

These defaults may be overridden by product-specific rules, but the override must be explicit.

### 3. Reject unsupported hype titles
Flag titles using inflated, vague, or commodity words without a specific outcome.

Default banned terms to flag:
- mastering
- ultimate
- complete
- comprehensive

These do not automatically fail in all contexts, but they must trigger review and likely rewrite at blueprint stage.

### 4. Reject duplicate or near-duplicate titles
Duplicate detection should be concrete, not subjective.

Default rule:
- use normalized cosine similarity on embeddings
- flag if similarity > 0.85
- fallback to token-level Jaccard similarity > 0.70 if embedding API is unavailable

Duplicate detection runs within peer sets only:
- lesson-to-lesson within the same module
- module-to-module within the same course
- session-to-session within the same workshop or live event
- section-to-section within the same webinar or equivalent artifact

Do not run duplicate detection across unlike levels such as module-to-lesson unless a product-specific override explicitly adds that rule.

When a duplicate is detected:
- both items must be flagged
- the Revision Agent is instructed to differentiate them
- the Revision Agent may not delete either item without orchestrator approval

### 5. Require actionability where appropriate
Every lesson, session, or guided section must answer at least one of these:
- what the learner will understand
- what the learner will do
- what the learner will complete

If none are clear, flag for revision.

### 6. Reject theory-only sections that should include support
When the product type implies implementation, sections that are explanation-only must be flagged if they obviously need:
- worksheet
- checklist
- prompt_pack
- template
- tracker
- demo_walkthrough
- script_card
- faq

### 7. Enforce closed lists
Any field declared as a closed list must use only approved enum values.

Fail if:
- invalid values appear
- casing is inconsistent where enum values must be exact
- unsupported extra values are added

### 8. Reject over-generation
The system must not create more sections, lessons, assets, or outputs than the current step requires.

Examples:
- generating lesson content during blueprint stage
- generating 10 asset ideas where 3 are allowed
- inventing extra modules beyond the approved course skeleton

---

## Canonical Anti-Slop Review Categories

These categories should be available to all validators and revisers.

### A. Inflated Language
Examples:
- premium-sounding but vague
- exaggerated without substance
- “everything you need” style claims without scope control

### B. Repetition
Examples:
- the same lesson idea reframed multiple times
- repeated promises across modules
- multiple titles teaching the same concept

### C. Fake Specificity
Examples:
- invented examples
- unsupported claims dressed as case-study logic
- arbitrary numbers or claims not grounded in source data

### D. Content Padding
Examples:
- extra lessons added only to make the course look bigger
- unnecessary intros
- descriptions longer than needed at blueprint stage

### E. Misfit Complexity
Examples:
- advanced language for a beginner audience
- too many layers too early
- unnecessary jargon

### F. Weak Differentiation
Examples:
- could be confused with generic free YouTube content
- no unique method or angle
- no clear reason to buy instead of self-study

---

## Validator Rubric Template

Every validator should return:
- `overall_score`
- `dimension_scores`
- `hard_rule_failures`
- `warnings`
- `recommended_action`
- `revision_notes`

### Standard score scale
Use the scoring scale defined in Document 3 and Appendix A.

### Reusable dimensions
Each validator can score some or all of these dimensions:
- clarity
- sequence_logic
- audience_fit
- actionability
- implementation_strength
- differentiation
- anti_slop
- confidence
- output_contract_integrity

Product-specific validators may add dimensions, but they must not remove required contract fields.

---

## Product-Type QC Extensions

The reusable QC layer should support a base + extension model.

### Base model
Always include:
- structural integrity
- learner progression
- market value
- anti-slop
- output contract integrity

### Product-type extension
Add checks specific to the builder type.

#### Course extension
Focus on:
- module sequence
- lesson progression
- implementation assets
- completion logic

#### Workshop extension
Focus on:
- live pacing
- interactive moments
- time realism
- facilitator prompts
- energy management

#### Webinar extension
Focus on:
- hook strength
- tension progression
- objection handling
- offer transition
- CTA timing

#### Coaching-program extension
Focus on:
- accountability design
- milestone pacing
- client workload realism
- session-to-session progression
- support boundaries

#### Live-event extension
Focus on:
- run-of-show logic
- audience engagement moments
- transitions
- stage timing
- contingency handling

---

## Product-Type Overrides

The QC engine should allow overrides without rewriting the whole system.

Override categories:
- max section count
- max asset count
- required support type
- validator assignment
- validator weights
- banned language terms
- pass thresholds
- escalation thresholds

If an override exists, it must be explicit in the product-specific config. Silent overrides are not allowed.

---

## Revision Policy

The revision layer must be surgical.

### Default rule
Revise only the failed or weak areas.

### Preserve by default
The reviser should preserve:
- approved upstream fields
- accepted titles unless they are specifically flagged
- approved transformation logic
- approved audience definitions

This preservation rule must be enforced structurally, not left to model goodwill.

The Revision Agent receives:
- `writable_fields`: only the fields explicitly flagged for revision
- `read_only_context`: approved fields and upstream context that must not be changed

Approved fields passed as `read_only_context` are not writable and must be stripped from the revision output before merge. The merge layer should only accept edits to fields present in `writable_fields`.

### Rebuild only if:
- the structure is fundamentally broken
- multiple validators recommend rebuild
- the orchestrator explicitly authorizes rebuild
- the user requests a full regeneration

### Revision note quality
Every revision should be traceable.

The reviser should record:
- what changed
- why it changed
- which validator(s) triggered the change
- whether downstream review is now required

---

## Escalation Policy

Escalation is a feature, not a failure.

Escalate when:
- revisions stall after the allowed loop count
- validators disagree in a way that reflects a real business decision
- source material is insufficient
- the transformation is too vague to safely continue
- multiple plausible product directions exist
- market fit remains uncertain after revision
- user preference is required to resolve tradeoffs

Escalation should not be phrased as system failure. It should be phrased as:
- a strategic choice is needed
- more context is needed
- user approval is required before continuing

---

## Output Contract Checks

QC is not only about quality. It is also about downstream reliability.

Every step should validate:
- required JSON fields exist
- JSON types are correct
- enums match source-of-truth vocabulary
- optional fields are either valid or absent
- arrays stay within count limits
- references to previous approved objects are resolvable

If an output fails contract validation, it should be marked `blocked_by_rule` until fixed.

---

## Reusable QC Configuration Model

The QC pipeline should be implemented as configuration, not hard-coded per product where possible.

Recommended config structure:
- `product_type`
- `step_id`
- `hard_rules`
- `assigned_validators`
- `validator_weights`
- `pass_thresholds`
- `asset_limits`
- `banned_terms`
- `output_schema_ref`
- `override_notes`

This allows the same QC engine to support multiple builders.

---

## Default QC Artifact Log

For each validated step, persist:
- step_id
- draft_version
- rule_check_results
- validator_results
- aggregated_decision
- revision_count
- escalation_flag
- downstream_review_flags
- approved_at
- approved_version

This log is important for:
- debugging
- audits
- replaying failures
- improving prompts
- comparing product-type performance later

---

## Minimal Reusable QC Checklist

A draft should not proceed unless the QC system can answer yes to these:

1. Does this step match the expected output contract?
2. Does the learner outcome remain clear?
3. Is the structure compact enough for this stage?
4. Is there obvious duplication or filler?
5. Is the value believable and specific?
6. Does the learner know what happens next?
7. Are invalid enums or unsupported values absent?
8. If revised, did the revision preserve approved upstream logic?

---

## Course-Specific Starter Configuration for Module 8

This section gives the first reusable implementation example.

### For Module 8, the QC engine should start with:
- product_type: `course`
- default hard rules from this document enabled
- default duplicate detection enabled
- blueprint-stage compactness rules enabled
- anti-slop categories enabled
- step-specific validator assignments and weights pulled from Document 3
- output schemas pulled from Appendix A where available

### For Screen 7 implementation assets
Enforce:
- minimum 1 asset per module
- maximum 3 assets per module
- asset types must come from the canonical list defined in Document 2

### For Screen 9 final blueprint
Require:
- all prior approved outputs present
- final assembled JSON object valid
- unresolved downstream warning flags surfaced
- blueprint status set correctly before export or approval

---

## Future Vocabulary Lock Note

If a Module 8 Vocabulary Lock is later created, this document must treat it as the source of truth for:
- enum names
- closed-list values
- field naming consistency

Until then, use Document 2, Document 3, and Appendix A as the practical vocabulary sources.

---

## Final Summary

This QC pipeline is designed to be reused.

The builder can change:
- course
- workshop
- webinar
- coaching
- live event

The QC engine should largely stay the same:
- same stage pattern
- same anti-slop categories
- same output-contract discipline
- same revision philosophy
- same escalation logic
- same configuration-first design

That is what makes the system scalable.
