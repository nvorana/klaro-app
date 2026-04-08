# KLARO — Claude Code Instructions

This is KLARO, an AI-powered web app for students of the One Person Income System (OPIS) coaching program by Negosyo University.

## What This App Does

KLARO gives students a guided workspace to execute each of the 6 program modules. Each module has an AI-powered tool that takes the student's personal data as input and produces a ready-to-use output (ebook, sales page, email sequence, etc.). Access is controlled via Systeme.io webhooks using tags.

**Full technical specification:** See `KLARO_Technical_Brief.md` in this folder.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Database + Auth:** Supabase
- **AI:** OpenAI API (GPT-4o)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

---

## First-Time Setup

### 1. Environment Variables
```bash
cp .env.local.example .env.local
# Fill in all values in .env.local
```

### 2. Database Setup
- Go to supabase.com → your project → SQL Editor
- Copy and run the entire SQL block from KLARO_Technical_Brief.md Section 4
- This creates all 11 tables, RLS policies, and the auto-profile trigger

### 3. Run Locally
```bash
npm run dev
# App runs at http://localhost:3000
```

---

## Project Structure

```
klaro-app/
├── app/
│   ├── page.tsx                    # Redirects to /dashboard
│   ├── layout.tsx                  # Root layout (Inter font, metadata)
│   ├── login/page.tsx              # Login page
│   ├── signup/page.tsx             # Signup + access pending screen
│   ├── dashboard/page.tsx          # Main dashboard (6 module cards)
│   ├── module/
│   │   ├── 1/page.tsx              # Module 1: Clarity Builder
│   │   ├── 2/page.tsx              # Module 2: Ebook Factory
│   │   ├── 3/page.tsx              # Module 3: Offer & Sales Page Builder
│   │   ├── 4/page.tsx              # Module 4: 7-Day Email Sequence
│   │   ├── 5/page.tsx              # Module 5: Lead Magnet Builder
│   │   └── 6/page.tsx              # Module 6: Facebook Content Engine
│   └── api/
│       ├── webhooks/systeme/       # Systeme.io webhook (BUILT)
│       └── generate/
│           ├── clarity/            # Generate problems + mechanisms (BUILT)
│           ├── validate/           # Validate clarity sentence (BUILT)
│           ├── objections/         # Generate objections for offer (BUILT)
│           ├── email-sequence/     # Generate 7-day email sequence (BUILT)
│           ├── content-posts/      # Generate Facebook posts (BUILT)
│           ├── ebook-outline/      # TODO: Build this
│           ├── ebook-chapter/      # TODO: Build this
│           ├── sales-page/         # TODO: Build this
│           └── lead-magnet/        # TODO: Build this
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client (BUILT)
│   │   ├── server.ts               # Server Supabase client (BUILT)
│   │   └── admin.ts                # Admin client for webhooks (BUILT)
│   ├── openai.ts                   # OpenAI client + model config (BUILT)
│   └── modules.ts                  # Module unlock logic (BUILT)
├── middleware.ts                   # Auth middleware + webhook bypass (BUILT)
├── KLARO_Technical_Brief.md        # Full product specification
└── .env.local.example              # Environment variables template
```

---

## Build Order (Recommended)

### Phase 1 — Foundation
1. Set up .env.local with Supabase + OpenAI keys
2. Run Supabase SQL to create all tables (Section 4 of Technical Brief)
3. Build /login page — email + password form with Supabase auth
4. Build /signup page — registration form + access pending screen
5. Test auth flow end to end

### Phase 2 — Dashboard
6. Build /dashboard page — fetch profile + module progress, render 6 module cards with correct lock/unlock states

### Phase 3 — Modules (in order)
7. Build Module 1 — The Clarity Builder (most critical — all other modules depend on it)
8. Build Module 2 — The Ebook Factory (build ebook-outline + ebook-chapter API routes first)
9. Build Module 3 — The Offer & Sales Page Builder (build sales-page API route first)
10. Build Module 4 — The 7-Day Email Sequence (API route already built, just needs UI)
11. Build Module 5 — The Lead Magnet Builder (build lead-magnet API route first)
12. Build Module 6 — The Facebook Content Engine (API route already built, just needs UI)

### Phase 4 — Export + Deploy
13. Build /api/export/ebook — generate .docx from ebook chapters using the docx npm package
14. Build /api/export/lead-magnet — generate .docx from lead magnet
15. Test Systeme.io webhook with a real tag event
16. Deploy to Vercel

---

## Key Data Flow

The Clarity Sentence from Module 1 feeds every other module:

```
Module 1 → clarity_sentences (target_market, problem, mechanism)
              ↓
Module 2 → ebooks (uses clarity_sentence)
              ↓
Module 3 → offers + sales_pages (uses clarity_sentence + ebook_title)
              ↓
Module 4 → email_sequences (uses clarity_sentence + sales_page_url)
              ↓
Module 5 → lead_magnets (uses clarity_sentence + ebook_title)
              ↓
Module 6 → content_posts (uses clarity_sentence)
```

---

## Design System

```
Primary (navy):   #1A1F36
Accent (gold):    #F4B942
Background:       #F8F9FA
Success:          #10B981
Warning:          #F59E0B
Error:            #EF4444
Text:             #1F2937
Font:             Inter
```

Layout decisions (locked in — do not change):
- Mobile-first: design for 375px phone width. Desktop layout adds sidebar nav.
- Bottom nav on mobile: 4 items — Home, My Work, Progress, Profile (NOT "Modules" tab — it's redundant with Home)
- Sidebar nav on desktop: same 4 items, left-aligned
- All module pages use a WIZARD / STEPPER layout — one step per full screen, NO scrolling through other steps

Key UI patterns:
- Selectable cards: border highlight + checkmark on selection
- Every AI output has a Regenerate button
- Every text output has a Copy button (show "Copied!" for 2s)
- Loading states: encouraging messages not generic spinners (e.g. "Finding the best problems for your market…")
- Mobile-first: all layouts must work on 375px phones

Module page — wizard/stepper behavior (CRITICAL):
- Each step occupies the FULL screen — the student sees only the current step
- A step progress bar sits below the module header: dots labeled by step name (e.g. Market → Problem → Solution → Clarity)
  - Future dots: grey filled, grey label
  - Active dot: gold filled (#F4B942), gold label
  - Completed dots: green filled (#10B981) with white SVG checkmark, green label
  - Dots connected by a horizontal line: green when passed, grey when future
- Step content fills the space between the progress bar and the bottom action bar
- Bottom action bar: fixed to the bottom, white background, contains one full-width primary button
  - Button label describes the action (e.g. "Find Their Biggest Problems", "Use This Problem", "Save My Clarity Sentence")
  - Final step button uses gold (.btn-next.gold)
- Back navigation: the gold back-chevron in the module header goes to the previous step (not back to dashboard)
- NO "Edit" buttons mid-flow — if the student wants to go back they use the back arrow

Dashboard — module card states:
- Completed: green border (#d1fae5), green checkmark in number badge, "View" button
- Next step (current unlocked): gold border (#F4B942), gold glow shadow, gold "Start" button
  → Show a small "Your next step" label ABOVE this card in #F4B942 gold
- Locked: opacity 0.55, padlock SVG icon, text reads "Unlocks in X days" (not just "X days")

Language rules (NO jargon):
- Never use "mechanism" in the UI — use "solution name" or "unique solution"
- Never use "avatar" to describe target audience — use "target market" or "who you want to help"
- Keep all copy simple enough for someone who has never done marketing

Completion states (REQUIRED on every module):
- After saving a module output, show a green success banner: "Module X Complete!"
- Below the banner show: the saved output (e.g. Clarity Sentence card), validation scores if applicable
- Always show a "Up Next — Module X+1" card with a CTA button to start it
- Always show a secondary "Back to Dashboard" text link

Icons — SVG only, no text emojis:
- Use SVG line icons (Heroicons / Lucide style) throughout
- Never use text emojis (✓ ✅ 🎉 etc.) in the UI — they render inconsistently on Android
- For checkmarks/verdicts: use <svg polyline points="20 6 9 17 4 12"> inline SVG

Progress bar:
- 1 of 6 modules done = 17%, not 25% — always calculate: (completed / total) * 100
- Display as both the fraction label ("1 of 6 modules done") AND the rounded percentage

---

## Important Notes

1. Webhook route is unauthenticated — middleware.ts already excludes /api/webhooks
2. Use admin client (lib/supabase/admin.ts) for webhook route only — bypasses RLS
3. Use server client (lib/supabase/server.ts) for server components and API routes
4. Use browser client (lib/supabase/client.ts) for client components
5. Change AI_MODEL in lib/openai.ts to 'gpt-4o-mini' during development to save costs
6. Module unlock logic is in lib/modules.ts — use isModuleUnlocked() and getDaysUntilUnlock()

---

## Target Audience

Filipino entrepreneurs learning to sell ebooks and digital products. Most are non-technical, many use mobile phones, and most are not comfortable with marketing or writing. The app does all the heavy lifting — students just make choices from options the app generates.
