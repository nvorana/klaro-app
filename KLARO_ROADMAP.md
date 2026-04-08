# KLARO App — Roadmap & Continuity Document

> Last updated: April 2026
> Built by: Coach Jon Oraña (Negosyo University)
> Developer tool: Claude (Cowork mode / vibe coding)

---

## What is KLARO?

KLARO is a web app that guides students of Coach Jon's OPIS (One Person Income System) program through building their digital product business step by step. Each module is an AI-powered workspace that takes the student from idea → product → sales page → email sequence → lead magnet → social content.

The app is built with **Next.js 14 (App Router)**, **Supabase** (auth + database), **OpenAI** (AI generation), and **Tailwind CSS**. It is deployed on **Vercel**.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 App Router |
| Auth & Database | Supabase (SSR) |
| AI | OpenAI (GPT-4o) |
| Styling | Tailwind CSS |
| Deployment | Vercel |
| Payments / CRM | Systeme.io (webhook integration) |

---

## Design System

| Token | Value |
|---|---|
| Page background | `bg-gray-950` |
| Card background | `bg-gray-900` |
| Border color | `#374151` |
| Gold accent | `#F4B942` |
| Dark gold background | `#1c1500` |
| Dark navy (header) | `#1A1F36` |
| Body text | `text-white` / `text-gray-300` / `text-gray-400` |
| Font | Inter |
| Base font (mobile) | 14px |
| Base font (desktop) | 16px |
| Max width (mobile) | 430px |
| Max width (desktop) | `md:max-w-3xl` (768px) |

**Important rule:** Never mix `border` shorthand with `borderLeft` (or any individual side) in React inline styles. Always use all four sides individually: `borderTop`, `borderRight`, `borderBottom`, `borderLeft`.

---

## App Routes

| Route | Description |
|---|---|
| `/login` | Login page |
| `/signup` | Signup page (first name, last name, email, phone) |
| `/dashboard` | Main dashboard — shows all 6 modules + progress |
| `/module/1` | Clarity Builder |
| `/module/2` | Ebook Factory |
| `/module/3` | Sales Page Builder |
| `/module/4` | 7-Day Email Sequence |
| `/module/5` | Lead Magnet Builder |
| `/module/6` | Facebook Content Engine |
| `/my-work` | Library of all saved outputs |
| `/my-work/detail` | Detail view of a single saved output |
| `/profile` | Edit profile (first name, last name, phone) + sign out |
| `/progress` | Pace tracker, builds summary, milestones |

---

## API Routes

| Route | Description |
|---|---|
| `/api/generate/clarity` | Generates clarity sentence |
| `/api/generate/ebook-outline` | Generates ebook outline |
| `/api/generate/ebook-chapter` | Generates individual ebook chapters |
| `/api/generate/ebook-agent` | Ebook agent orchestration |
| `/api/generate/ebook-docx` | Exports ebook to .docx |
| `/api/generate/objections` | Generates sales objections |
| `/api/generate/validate` | Validates market/niche idea |
| `/api/generate/sales-page` | Generates sales page copy |
| `/api/generate/email-sequence` | Generates 7-day email sequence |
| `/api/generate/lead-magnet` | Generates lead magnet (S.I.N.G.L.E. WIN Framework) |
| `/api/generate/content-posts` | Generates Facebook posts (3 or 5, ~250 words each) |
| `/api/generate/bonus` | Generates bonus content |
| `/api/export/ebook` | Exports ebook |
| `/api/export/lead-magnet` | Exports lead magnet |
| `/api/webhooks/systeme` | Systeme.io webhook handler (file exists, not fully implemented) |

---

## Database (Supabase)

### `profiles` table
- `id` (uuid, FK to auth.users)
- `first_name` (text)
- `last_name` (text)
- `full_name` (text)
- `email` (text)
- `phone` (text)
- `access_level` (text)
- `enrolled_at` (timestamp)

### Other tables (used by modules)
- `clarity` — stores clarity sentence outputs
- `ebook` — stores ebook content
- `sales_page` — stores sales page copy
- `email_sequence` — stores 7-day email sequences
- `lead_magnet` — stores lead magnet content
- `content_posts` — stores Facebook post batches
- `module_progress` — tracks which modules are completed per user

---

## Modules — What Each One Does

### Module 1 — Clarity Builder
Helps the student define their target market, biggest pain point, and unique solution. Outputs a single "Clarity Sentence." Also validates the niche using AI.

### Module 2 — Ebook Factory
AI-powered ebook writer. Takes the clarity sentence and generates a full ebook outline, then writes each chapter. Exports to .docx.

### Module 3 — Sales Page Builder
Builds a complete sales page for the student's digital product. Handles objections and writes persuasive copy.

### Module 4 — 7-Day Email Sequence
Writes a 7-day automated email follow-up sequence based on the student's product and market.

### Module 5 — Lead Magnet Builder
Creates a free lead magnet using the **S.I.N.G.L.E. WIN Framework**:
- **S** — Specific Outcome
- **I** — Immediate Relevance
- **N** — No-Brainer Effort
- **G** — Guaranteed Micro Result
- **L** — Low Time Commitment
- **E** — Emotional Trigger
- **WIN** — Transformation Hook

Supports multiple formats: checklist, mini-guide, template, cheat sheet, script.

### Module 6 — Facebook Content Engine
Generates 3 or 5 Facebook posts (~250 words each) using the student's product and market. Posts include a scroll-stopping hook, value body, and CTA. Uses Taglish for Filipino audiences.

---

## Key Business Decisions Made

### Funnel Strategy
- The **₱400 ebook** ("The One-Page Income System") is a **lead magnet only** — ebook buyers get NO app access.
- The ebook sells them into **OPIS** (₱25,000+), which includes full or tiered app access.
- KLARO is the "proof of work" system that justifies the ₱25,000 price.

### Tier Access (PENDING FINAL CONFIRMATION from Coach Jon)
Proposed structure:

| Tier | Price | Modules | What they can do |
|---|---|---|---|
| Tier 1 | OPIS entry | 1, 2, 3 | Clarity → Ebook → Sales Page |
| Tier 2 | OPIS mid | 1–4, 6 | Above + Email Sequence + Facebook Content |
| Tier 3 | OPIS full | 1–6 | Complete system including Lead Magnet |

**Coach Jon has NOT yet confirmed these tier breakdowns. Do not build the access system until confirmed.**

### Systeme.io Webhook — Tag-Based Access Control
- Access is controlled by **tags** (not purchases directly)
- Two dimensions: **Tier** (what modules) × **Payment status** (partial vs full)
- Tag naming convention: `klaro-tier1-partial`, `klaro-tier1-full`, `klaro-tier2-partial`, etc.
- Auto-revoke on tag removal
- Coach manually controls weekly module unlocks
- Webhook file exists at `app/api/webhooks/systeme/route.ts` but is **not yet fully implemented**

---

## Completed Work (as of April 2026)

- [x] All 6 module pages built and functional
- [x] Full dark theme applied consistently across all pages
- [x] Responsive layout — mobile 430px, desktop 768px
- [x] Base font scales: 14px mobile → 16px desktop
- [x] KLARO logo (transparent PNG, cropped) applied to dashboard, login, signup
- [x] Dashboard caching fixed (`export const dynamic = 'force-dynamic'`)
- [x] Module 6 blank results bug fixed
- [x] Facebook posts limited to 3 or 5 options (~250 words each)
- [x] Scroll-stopping hook instructions strengthened in Module 6 prompt
- [x] Lead magnet prompt rewritten using S.I.N.G.L.E. WIN Framework
- [x] Signup form updated: first name, last name, email, phone
- [x] Supabase `profiles` table updated with `first_name`, `last_name`, `phone` columns
- [x] Profile page (`/profile`) built
- [x] Progress page (`/progress`) built — pace tracker, builds, milestones
- [x] Double avatar circle in dashboard header fixed
- [x] React border shorthand conflict fixed across Module 4, 5, 6
- [x] "ONE PERSON INCOME SYSTEM" tagline removed from login/signup (for future reuse with other programs)

---

## Pending Work

### High Priority
- [ ] **Tier access system** — waiting for Coach Jon to confirm tier 1/2/3 module breakdown
- [ ] **Systeme.io webhook** — full implementation (tag-based, two-dimensional: tier × payment status)
- [ ] **Module locking UI** — locked modules show padlock, not clickable until unlocked
- [ ] **Admin dashboard** (`/admin`) — monitor students, manually unlock modules, see who is struggling

### Medium Priority
- [ ] **Module 7** — folder with slides, prompts, and video already exists in `/TOPIS - App/Module 7/`. App page needs to be built.
- [ ] **Bottom nav** — verify Profile and Progress tabs are consistent across all module pages
- [ ] **Test full signup flow** — first name, last name, phone fields end-to-end

### Future / Long-term
- [ ] **Multi-program support** — KLARO is designed to eventually serve students from different Coach Jon programs, not just OPIS. Keep branding generic (no hardcoded "OPIS" or "One Person Income System" in UI).
- [ ] **Higher-tier offer modules** — as Coach Jon adds Tier 2/3 content, new modules will need to be added beyond Module 6/7.
- [ ] **VA / delegate features** — systematize and step-back features for advanced students (Chapter 10 of the ebook).

---

## Important Notes for Future Sessions

1. **Coach Jon is a non-developer** — he uses vibe coding. Keep explanations simple. Don't ask him for code decisions.
2. **Always use the dark theme** — `bg-gray-950` pages, `bg-gray-900` cards, gold `#F4B942` accents.
3. **Never suggest targeting college students, fresh graduates, or jobless people** as market examples — Coach Jon explicitly excludes these.
4. **Content is in Taglish** — Filipino-English mix, natural and conversational, not deep/formal Tagalog.
5. **The app may expand beyond 6 modules** — don't hardcode "6 modules" anywhere that would be hard to update.
6. **Logo file:** `public/Klaro_Logo-cropped.png` (transparent background, properly cropped, no whitespace padding).
