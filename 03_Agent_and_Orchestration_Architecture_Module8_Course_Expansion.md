# 03. Agent and Orchestration Architecture

## Document Purpose
This document defines the multi-agent architecture for KLARO Module 8: Course Expansion.

It specifies:
- the role of each agent
- who calls whom
- which validators run at which step
- pass / revise / escalate logic
- revision loop limits
- parallel vs sequence execution rules
- what data is passed between agents
- what gets persisted after each stage

This document is implementation-oriented. The coding agent should treat this as the operating contract for the Module 8 agent workflow.

## Relationship to Other Documents
This document works with:
- `01_Master_System_Handoff_Module8_Course_Expansion_v4.md`
- `02_Product_Flow_and_UX_Spec_Module8_Course_Expansion_v3.md`
- `Appendix_A_Worked_Example.md`

If this document conflicts with Document 1, Document 1 controls product intent. If this document conflicts with Appendix A on step outputs, JSON shape, field names, or score payload format, Appendix A wins. Scoring uses the 1 to 10 scale defined here and mirrored in Appendix A.

## Architectural Principle
The system must not rely on a single generator agent to create a full course blueprint in one pass.

Instead, the workflow is:
1. orchestrator assembles approved context for the current step
2. creator agent drafts the step output
3. assigned validators review the output
4. orchestrator aggregates validator results
5. revision agent revises if needed
6. orchestrator either approves, retries, or escalates to the user

The purpose of this design is to reduce hallucination, reduce AI slop, preserve state, and stop weak outputs from flowing into downstream steps.

## Agent Inventory

### 1. Orchestrator Agent
Role:
- workflow manager and gatekeeper
- decides which step runs next
- assembles only the minimum approved context needed for that step
- triggers creator, validators, and revision agent
- enforces thresholds and revision caps
- persists approved outputs and review metadata
- flags downstream steps for re-review when upstream edits affect them

The orchestrator does not author the main course output unless a fallback summary or user-facing explanation is needed.

### 2. Course Creator Agent
Role:
- drafts the main output for the active step
- uses approved upstream state only
- produces structured outputs, not just prose
- does not self-approve final outputs

Implementation note:
- this is one shared agent shell, not one static prompt
- the Course Creator Agent must load a step-specific system prompt and output schema for the active screen from a prompt library
- prompts should be maintained in a separate `/prompts/module8/` directory or equivalent prompt registry
- each Screen 1 to Screen 8 flow may use a different prompt variant while still being treated as the same Course Creator Agent in orchestration

### 3. Curriculum Validator Agent
Role:
- checks instructional architecture
- checks module and lesson sequence
- checks outcome clarity
- checks redundancy and scope
- checks whether structure supports learner progression

### 4. Learner Experience Validator Agent
Role:
- checks beginner fit
- checks cognitive load and overwhelm
- checks implementation clarity
- checks whether the student knows what to do next
- checks whether the proposed blueprint supports completion

### 5. Market Validator Agent
Role:
- checks commercial attractiveness
- checks promise clarity and differentiation
- checks whether the scope feels worth paying for
- checks whether the course type fits the transformation and audience

### 6. Revision Agent
Role:
- revises failed outputs based on validator feedback
- preserves approved elements
- fixes only flagged issues where possible
- avoids rewriting entire outputs unless necessary

## Execution Order: Who Calls Whom
For every Module 8 step, the execution order is:

1. **Access / state check**
   - orchestrator verifies the user can access the step
   - orchestrator loads approved upstream state
   - orchestrator checks whether downstream steps are currently flagged as may_need_review

2. **Creator draft**
   - orchestrator calls Course Creator Agent
   - creator returns the draft output in the required structured format

3. **Rule-based pre-check**
   - orchestrator runs non-LLM hard checks first
   - examples: required fields present, enum validity, max lesson count, max module count, banned phrasing checks, blueprint-stage description length, duplicate title similarity threshold
   - if hard checks fail, the draft does not go to validators; it goes directly to Revision Agent

4. **Validator review**
   - orchestrator calls only the validators assigned to that step
   - assigned validators run in parallel by default

5. **Aggregation**
   - orchestrator aggregates validator scores and failure reasons
   - orchestrator decides pass / revise / escalate based on thresholds

6. **Revision loop if needed**
   - orchestrator calls Revision Agent with:
     - the failed draft
     - validator comments
     - failed rule checks
     - approved upstream context
   - revision output returns to rule-based pre-check, then validator review

7. **Approval or escalation**
   - if passed, orchestrator saves approved output and unlocks the next step
   - if capped revision count is reached without passing, orchestrator escalates to the user

## Parallel vs Sequence Rules
### Default rule
Assigned validators run in parallel.

### Exception rule
Sequence is used only when:
- a hard non-LLM rule can cheaply reject the draft before LLM validation
- a later validator depends on a transformed artifact produced by an earlier stage, which is not expected in normal Module 8 blueprint steps

### Practical implementation rule
The system should run:
1. rule-based checks first
2. assigned validators in parallel second
3. aggregation third

## Validator Assignment by Step
The following mapping is required.

### 
**Screen 0 handling note:** Screen 0 (Welcome/Orientation) does not invoke the Course Creator, validators, or Revision Agent. The Orchestrator simply verifies unlock status and persists orientation acknowledgment before allowing Screen 1 to start.
Screen 1: Course Readiness Check
Creator:
- Course Creator Agent

Validators:
- Learner Experience Validator Agent
- Market Validator Agent

Reason:
- this step is primarily about readiness, fit, and recommended path

### Screen 2: Reconfirm the Transformation
Creator:
- Course Creator Agent

Validators:
- Curriculum Validator Agent
- Market Validator Agent

Reason:
- this step defines the core transformation and commercial clarity

### Screen 3: Choose the Right Course Type
Creator:
- Course Creator Agent

Validators:
- Learner Experience Validator Agent
- Market Validator Agent

Reason:
- this step is about depth and delivery fit for the audience and use case

### Screen 4: Audit the E-book Before Turning It Into a Course
Creator:
- Course Creator Agent

Validators:
- Curriculum Validator Agent

Reason:
- this is primarily structural and instructional

### Screen 5: Build the Course Skeleton
Creator:
- Course Creator Agent

Validators:
- Curriculum Validator Agent
- Learner Experience Validator Agent
- Market Validator Agent

Reason:
- this step shapes the overall promise, scope, sequence, and perceived value

### Screen 6: Break Modules Into Lessons
Creator:
- Course Creator Agent

Validators:
- Curriculum Validator Agent
- Learner Experience Validator Agent

Reason:
- this step is about pacing, sequence, and usability

### Screen 7: Add the Implementation Layer
Creator:
- Course Creator Agent

Validators:
- Learner Experience Validator Agent
- Curriculum Validator Agent

Reason:
- this step is about actionability and instructional support

### Screen 8: Define the Student Experience
Creator:
- Course Creator Agent

Validators:
- Learner Experience Validator Agent
- Market Validator Agent

Reason:
- this step shapes delivery experience and perceived fit

### Screen 9: Final Course Blueprint Summary
Creator:
- Orchestrator Agent assembles summary from approved outputs

Validators:
- none by default

Exception:
- if any upstream step is still flagged as may_need_review, Screen 9 cannot be approved as blueprint_approved

## Scoring Model
Each assigned validator scores the draft on a 1 to 10 scale.

### Score meaning
- **1 to 3** = unacceptable
- **4 to 5** = major problems
- **6** = usable but weak / requires revision
- **7** = acceptable and solid
- **8** = strong and usable
- **9 to 10** = excellent

### Required output from each validator
Each validator must return:
- `overall_score`
- `dimension_scores`
- `pass_recommendation` (`pass`, `revise`, `escalate`)
- `top_issues` (array)
- `suggested_fixes` (array)
- `confidence` (`low`, `medium`, `high`)

### Critical failure rule
If any validator returns an `overall_score` below 6, the step cannot pass.

### Direct pass rule
A step passes directly when:
- no assigned validator returns below 6
- weighted average score is 8.0 or above
- no hard non-LLM rule has failed

### Revision rule
A step must revise when:
- any validator returns exactly 6
- weighted average is 7.0 to 7.9
- any hard non-LLM rule has failed
- one validator returns 6 while the weighted average remains below 8.0

A step may still pass with one validator at 7 if the weighted average is 8.0 or above and no hard non-LLM rule has failed. This is intentional to avoid unnecessary escalations while still preserving a high-quality threshold.

### Escalation rule
A step escalates immediately only when:
- validators disagree so strongly that no coherent revision target exists
- required user intent is missing or contradictory
- the step depends on a business decision AI should not invent

Otherwise, escalation occurs only after the revision cap is reached.

### Quality-over-speed design note
Module 8 prefers user escalation over weak auto-pass. The system is intentionally conservative at blueprint stage because a weak structure compounds downstream. It is acceptable for a meaningful minority of first-pass drafts to enter revision or escalate when the alternative would be approving a vague, bloated, or commercially weak blueprint.

## Weighting Model
The orchestrator should use these default weights unless a step-specific override is declared.

Default weights:
- Curriculum Validator: 0.40
- Learner Experience Validator: 0.35
- Market Validator: 0.25

### Default rule
When fewer validators are assigned and no override exists, weights should be normalized across only the assigned validators.

### Step-specific override rule
If a step has an explicit override, that override wins and normalization does not apply.

### Required override for Screen 1
Because Screen 1 is a readiness and fit decision, it must not inherit the default normalized weighting model.

Use this explicit override for Screen 1:
- Learner Experience Validator: 0.45
- Market Validator: 0.55

### Extension rule
Additional step-specific weight overrides may be defined later in the QC document if the default distribution does not fit a particular step. Until then, only Screen 1 uses an override.

## Revision Loop Cap
### Standard cap
Each step gets a maximum of **2 automatic revision loops** after the initial creator draft.

That means the full attempt sequence is:
1. creator draft
2. validation
3. revision 1
4. validation
5. revision 2
6. validation
7. if still not passed, escalate to user

### No infinite retry rule
The system must never continue revising indefinitely without user intervention.

## Escalation to User
When escalation happens, the orchestrator must:
- stop auto-generation for the current step
- present the user with the failed area in plain language
- show the top 1 to 3 conflicts or missing decisions
- ask only for the minimal decision needed to continue
- preserve the latest failed draft for manual editing or guided retry

Examples of appropriate escalations:
- transformation is too broad and needs narrowing
- course depth and delivery format conflict with stated available time
- module scope is too large and there are multiple valid cut options
- the e-book appears better suited to a workshop than a course

## Hard Non-LLM Rules
These rules must run before validators whenever relevant.

### Global blueprint rules
- all closed-list fields must match allowed enum values
- no required field may be null once the step is submitted for generation
- lesson descriptions at blueprint stage must be no longer than 2 sentences
- any module with more than 6 lessons is auto-flagged for revision
- any lesson title containing banned hype-heavy words must be flagged
- duplicate lesson titles that exceed the duplicate detection threshold must be flagged
- module count above 7 is flagged unless explicitly user-approved later
- each module must contain exactly one explicit learner outcome field

### Banned hype-heavy words list
At minimum:
- mastering
- ultimate
- complete
- comprehensive

This list may be extended in the QC document.

### Duplicate lesson title detection rule
The system must use normalized cosine similarity on embeddings to compare lesson titles within the same course blueprint.

Flag a duplicate when:
- cosine similarity is greater than 0.85

Fallback rule if embeddings are unavailable:
- use token-level Jaccard similarity
- flag a duplicate when Jaccard similarity is greater than 0.70

The duplicate rule applies only within the same course blueprint and same blueprint version.

## Anti-Slop Enforcement
The orchestrator and revision agent must enforce the anti-slop guardrails from the master handoff.

At minimum, the revision agent must check that:
- outputs are specific, not padded
- modules do not repeat the same promise in different wording
- lessons move the learner toward a result
- implementation support is present where needed
- descriptions do not sound premium without adding clarity
- the blueprint is not bloated to manufacture value

## Data Passed Between Agents
### Orchestrator to Creator
The orchestrator sends only the minimum context required for the active step.

Typical payload includes:
- user id
- module_8 step id
- approved upstream outputs relevant to the step
- current user edits for the active step
- locked vocabulary / enum values when applicable
- step-specific output contract reference

### Orchestrator to Validators
The orchestrator sends:
- active step id
- approved upstream summary
- current draft output
- validator-specific rubric
- hard rule results

### Orchestrator to Revision Agent
The orchestrator sends:
- active step id
- failed draft output
- validator comments
- failed hard rules
- approved upstream summary
- instruction to preserve approved subcomponents where possible

## Persistence Model
For each step, the system should persist:
- creator draft
- validator results
- hard rule results
- revision count
- approved output
- approval timestamp
- escalation status
- user overrides
- may_need_review flags for downstream steps where applicable

## Downstream Impact Rules
If the user edits an approved field that affects downstream steps, the orchestrator must:
- require explicit confirmation before saving the change
- flag affected downstream steps as `may_need_review`
- prevent Screen 9 from being approved until flagged steps are revisited and re-approved

The affected fields are defined in Document 2 and must be honored here.

## Screen 9 Assembly Rule
Screen 9 is not created by the Course Creator Agent.

The Orchestrator Agent assembles the final course blueprint from all prior approved outputs into:
- `final_course_blueprint`
- `blueprint_version`
- `module_8_completion_status`
- `blueprint_approved_at`

If any upstream step is incomplete or flagged `may_need_review`, Screen 9 may render but cannot finalize to `blueprint_approved`.

## Failure Modes to Log
The orchestrator must log these failure classes for later tuning:
- vague transformation
- oversized scope
- theory overload
- duplicate lesson intent
- weak implementation layer
- course type mismatch
- market-value mismatch
- insufficient user inputs
- hard rule violation
- revision cap reached

## Definition of Done
This document is considered implemented when the system can:
- run each Module 8 step through the required creator / validator / revision flow
- enforce step-specific validator assignment
- apply numeric pass thresholds
- enforce a hard cap of 2 revision loops
- escalate to the user when needed
- persist approved outputs and review metadata
- assemble Screen 9 only from approved prior outputs
- prevent unresolved upstream changes from silently corrupting downstream steps
