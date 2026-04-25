# KLARO — Technical Brief
### One Person Income System | Negosyo University
**Version:** 1.0 (Phase 1)
**Build Method:** Vibe coding with Claude Code in VS Code

---

## 1. PROJECT OVERVIEW

**KLARO** is a web-based app built for students of the One Person Income System (OPIS) coaching program by Negosyo University. It gives students a guided, AI-powered workspace to execute each module of the 8-week program — replacing manual copy-pasting between worksheets and external AI tools.

Each of the 6 app features maps directly to one module of the program. Features unlock weekly based on the student's enrollment date. Access is controlled via Systeme.io webhooks — no manual account management required.

**Core Promise:** Every feature takes the student's personal data as input and produces a ready-to-use output. No blank pages. No guessing.

---

## 2. TECH STACK

| Layer | Tool | Notes |
|-------|------|-------|
| Framework | Next.js 14 (App Router) | Handles frontend + backend API routes |
| Database + Auth | Supabase | PostgreSQL, Auth, Storage |
| AI | OpenAI API (GPT-4o) | Powers all in-app generators |
| Styling | Tailwind CSS | Utility-first, mobile-responsive |
| Deployment | Vercel | Auto-deploy from GitHub |
| File Export | docx (npm package) | Exports ebooks and lead magnets as .docx |

---

## 3. ENVIRONMENT VARIABLES

Create a `.env.local` file in the project root with the following:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Systeme.io Webhook
SYSTEME_ACCESS_TAG=KLARO-FULLPAY
SYSTEME_ENROLLED_TAG=KLARO-ENROLLED

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Note:** `SYSTEME_ACCESS_TAG` and `SYSTEME_ENROLLED_TAG` are the exact tag names used in Systeme.io. Change these to match whatever tags are configured in the Systeme.io account.

---

## 4. DATABASE SCHEMA

Run the following SQL in the Supabase SQL editor to create all required tables.

```sql
-- Extend the default auth.users with a profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  systeme_contact_id TEXT,
  access_level TEXT NOT NULL DEFAULT 'pending' CHECK (access_level IN ('pending', 'enrolled', 'full_access')),
  enrolled_at TIMESTAMP WITH TIME ZONE,
  full_access_granted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Module progress tracking
CREATE TABLE module_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  module_number INTEGER NOT NULL CHECK (module_number BETWEEN 1 AND 6),
  unlocked_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, module_number)
);

-- Module 1: Clarity Sentence
CREATE TABLE clarity_sentences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_market TEXT,
  core_problem TEXT,
  unique_mechanism TEXT,
  full_sentence TEXT,
  validation_score INTEGER,
  validation_feedback JSONB,
  is_validated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Module 2: Ebook
CREATE TABLE ebooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  outline JSONB, -- array of {chapter_number, title, goal}
  chapters JSONB, -- array of {chapter_number, title, story_starter, core_lessons, quick_win}
  cover_prompt TEXT, -- prompt used for Canva cover
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'outline_done', 'generating', 'complete')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Module 3: Offer
CREATE TABLE offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  objections JSONB, -- array of selected objection strings
  bonuses JSONB, -- array of {name, value_peso, objection_addressed}
  total_value INTEGER, -- in pesos
  selling_price INTEGER, -- in pesos
  guarantee TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Module 3: Sales Page
CREATE TABLE sales_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  offer_id UUID REFERENCES offers(id),
  problem_section TEXT,
  solution_section TEXT,
  proof_section TEXT,
  offer_section TEXT,
  guarantee_section TEXT,
  cta_section TEXT,
  full_copy TEXT, -- assembled complete sales page
  published_url TEXT, -- student's Systeme.io sales page URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Module 4: Email Sequence
CREATE TABLE email_sequences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sales_page_url TEXT,
  emails JSONB, -- array of {day, subject, body, type: 'value'|'selling'}
  reusable_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Module 5: Lead Magnet
CREATE TABLE lead_magnets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  format TEXT CHECK (format IN ('checklist', 'quick_guide', 'free_report')),
  title TEXT,
  hook TEXT,
  introduction TEXT,
  main_content TEXT,
  quick_win TEXT,
  bridge_to_ebook TEXT,
  full_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Module 6: Facebook Content Posts
CREATE TABLE content_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_type TEXT CHECK (post_type IN ('problem_post', 'micro_lesson', 'personal_insight')),
  hook TEXT,
  value_content TEXT,
  cta TEXT,
  full_post TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook logs for debugging
CREATE TABLE webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payload JSONB,
  tag_name TEXT,
  contact_email TEXT,
  action TEXT,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) - users can only access their own data
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE clarity_sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_magnets ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view own module progress" ON module_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own clarity sentences" ON clarity_sentences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own ebooks" ON ebooks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own offers" ON offers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own sales pages" ON sales_pages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own email sequences" ON email_sequences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own lead magnets" ON lead_magnets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own content posts" ON content_posts FOR ALL USING (auth.uid() = user_id);

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## 5. AUTHENTICATION FLOW

KLARO uses Supabase Auth with **email + password** login.

### Registration Flow
1. Student visits `/signup`
2. Enters full name + email + password
3. Supabase creates account → profile row is auto-created via trigger
4. System checks if email has been granted access via Systeme.io webhook
5. If access granted → redirect to `/dashboard`
6. If no access → show "Access Pending" screen with instructions to complete enrollment

### Login Flow
1. Student visits `/login`
2. Enters email + password
3. Supabase authenticates
4. System checks `access_level` on their profile
5. If `full_access` or `enrolled` → redirect to `/dashboard`
6. If `pending` → show "Access Pending" screen

### Access Pending Screen
Display a clean message:
> "Your access to KLARO is not yet active. Please complete your enrollment payment to unlock the app. If you believe this is an error, contact us at [support email]."

---

## 6. SYSTEME.IO WEBHOOK INTEGRATION

### Webhook Endpoint
**Route:** `POST /api/webhooks/systeme`

This endpoint receives tag events from Systeme.io and grants or revokes access accordingly.

### Setting Up Webhooks in Systeme.io
1. Go to Systeme.io → Settings → Webhooks
2. Create a webhook for event: **"Contact tag added"**
   - URL: `https://yourdomain.com/api/webhooks/systeme`
3. Create a second webhook for event: **"Contact tag removed"**
   - URL: `https://yourdomain.com/api/webhooks/systeme`

### Expected Webhook Payload (Tag Added)
```json
{
  "event_type": "contact.tag_added",
  "contact": {
    "id": "12345",
    "email": "student@email.com",
    "first_name": "Maria",
    "last_name": "Santos"
  },
  "tag": {
    "name": "KLARO-FULLPAY"
  }
}
```

### Expected Webhook Payload (Tag Removed)
```json
{
  "event_type": "contact.tag_removed",
  "contact": {
    "id": "12345",
    "email": "student@email.com"
  },
  "tag": {
    "name": "KLARO-FULLPAY"
  }
}
```

### Webhook Processing Logic
```
1. Receive POST request
2. Parse payload — extract email and tag name
3. Log the raw payload to webhook_logs table
4. Check tag name against SYSTEME_ACCESS_TAG env variable

IF tag name matches SYSTEME_ACCESS_TAG:
  IF event is tag_added:
    - Find profile by email
    - Set access_level = 'full_access'
    - Set full_access_granted_at = NOW()
    - Set enrolled_at = NOW() (if not already set)
    - Trigger module unlock calculation (see Module Unlock Logic)
    - Update webhook_logs with action = 'access_granted'
  IF event is tag_removed:
    - Find profile by email
    - Set access_level = 'pending'
    - Update webhook_logs with action = 'access_revoked'

IF tag name matches SYSTEME_ENROLLED_TAG:
  IF event is tag_added:
    - Find profile by email
    - Set access_level = 'enrolled'
    - Set enrolled_at = NOW() (if not already set)
    - Update webhook_logs with action = 'enrolled'

IF profile not found by email:
  - Create a new profile record with the email and access_level
  - Student will complete signup later — profile will be linked on signup

5. Return 200 OK
```

### Important Note on Webhook Route
The webhook route MUST be excluded from Supabase auth middleware. It receives unauthenticated POST requests from Systeme.io. Add it to the middleware exclusion list.

---

## 7. MODULE UNLOCK LOGIC

Modules unlock on a weekly schedule based on `enrolled_at` date.

| Module | Unlocks After Enrollment |
|--------|--------------------------|
| Module 1 | Immediately (Day 0) |
| Module 2 | Day 7 |
| Module 3 | Day 14 |
| Module 4 | Day 21 |
| Module 5 | Day 28 |
| Module 6 | Day 35 |

### Unlock Check Function
On every dashboard load, calculate which modules should be unlocked:
```
days_since_enrollment = TODAY - enrolled_at (in days)

Module 1: always unlocked if enrolled
Module 2: unlocked if days_since_enrollment >= 7
Module 3: unlocked if days_since_enrollment >= 14
Module 4: unlocked if days_since_enrollment >= 21
Module 5: unlocked if days_since_enrollment >= 28
Module 6: unlocked if days_since_enrollment >= 35
```

### Payment Wall
If `access_level = 'enrolled'` (partial payment), modules still unlock on schedule BUT a persistent banner is shown:
> "Complete your payment to secure full access to KLARO. [Pay Now]"

If `access_level = 'pending'`, student is redirected to the Access Pending screen — no modules are accessible.

If `access_level = 'full_access'`, modules unlock on schedule with no banners.

---

## 8. APP PAGES & ROUTES

```
/                   → Redirect to /dashboard if logged in, else /login
/login              → Login page
/signup             → Signup page
/dashboard          → Main dashboard — shows all 6 modules with lock/unlock status
/module/1           → Module 1: The Clarity Builder
/module/2           → Module 2: The Ebook Factory
/module/3           → Module 3: The Offer & Sales Page Builder
/module/4           → Module 4: The 7-Day Email Sequence Builder
/module/5           → Module 5: The Lead Magnet Builder
/module/6           → Module 6: The Facebook Content Engine
/api/webhooks/systeme → Systeme.io webhook receiver (POST, unauthenticated)
/api/generate/clarity → AI: generate problems and mechanisms (POST)
/api/generate/validate → AI: validate clarity sentence (POST)
/api/generate/ebook-outline → AI: generate ebook outline (POST)
/api/generate/ebook-chapter → AI: generate single chapter (POST)
/api/generate/objections → AI: generate objections (POST)
/api/generate/sales-page → AI: generate sales page sections (POST)
/api/generate/email-sequence → AI: generate 7-day email sequence (POST)
/api/generate/lead-magnet → AI: generate lead magnet (POST)
/api/generate/content-posts → AI: generate Facebook posts (POST)
/api/export/ebook → Export ebook as .docx (GET)
/api/export/lead-magnet → Export lead magnet as .docx (GET)
```

---

## 9. DASHBOARD UI

The dashboard is the student's home base. It shows all 6 modules as cards in a grid.

### Module Card States
Each module card shows one of three states:

**Locked** (module not yet unlocked):
- Padlock icon
- Module name
- "Unlocks in X days" or the unlock date
- Card is greyed out, not clickable

**Unlocked — Not Started:**
- Module number badge
- Module name
- Short one-line description of what they'll produce
- "Start" button (primary color)

**In Progress / Completed:**
- Module number badge
- Module name
- Progress indicator or "Completed" checkmark
- "Continue" or "View" button

### Dashboard Header
Show the student's name, their program week number ("Week 3 of 8"), and a progress bar across the top.

---

## 10. FEATURE SPECIFICATIONS

---

### MODULE 1 — The Clarity Builder

**Goal:** Student walks away with a validated Clarity Sentence saved to their profile.

**Pre-loaded data:** None (this is the first module)

**Output stored in:** `clarity_sentences` table

---

#### Step 1 — Enter Target Market
- Show a text input: "Who do you want to help?"
- Placeholder: "e.g., OFW wives, burned-out corporate employees, homeschooling parents"
- Below the input, show a collapsible section: "Need ideas?" with a list of 10 common Filipino target markets as clickable chips (clicking fills the input)
- "Next" button proceeds to Step 2

---

#### Step 2 — Pick Your Problem
**AI Call:** `POST /api/generate/clarity` with `{ target_market, step: 'problems' }`

**OpenAI Prompt:**
```
You are a market research expert for the Philippine digital products market.

Target market: [TARGET_MARKET]

Generate a list of the top 10 most urgent, painful problems that this target market faces — problems they are actively seeking and willing to pay for a solution.

For each problem:
- Write it as a specific, relatable struggle (not generic)
- Keep language simple and Filipino-audience friendly
- Focus on problems that can be solved with an ebook or digital guide

Return as a JSON array:
[
  { "rank": 1, "problem": "...", "insight": "..." },
  ...
]

Rank by urgency and demand. Problem #1 should be the most urgent.
```

**UI:**
- Show a loading state while AI generates
- Display the 10 problems as selectable cards
- Each card shows the problem title and a short insight
- Student taps one card to select it (selected card highlights)
- "Use This Problem" button proceeds to Step 3

---

#### Step 3 — Pick Your Unique Mechanism
**AI Call:** `POST /api/generate/clarity` with `{ target_market, problem, step: 'mechanisms' }`

**OpenAI Prompt:**
```
You are a marketing strategist specializing in digital products for the Philippine market.

Target market: [TARGET_MARKET]
Problem: [PROBLEM]

Generate 5 unique mechanism names — these are branded solution concepts that will make an ebook stand out from competitors. Each mechanism should:
- Sound unique, specific, and compelling
- Be easy to understand for a non-marketer
- Imply a clear outcome
- Feel like something someone invented, not a generic phrase

Examples of good mechanisms: "The Mental Load Offloading System", "The Energy-First Planning Method", "The 3-Day Skin Reset Protocol"

Return as a JSON array:
[
  { "name": "...", "description": "One sentence explaining what this implies" },
  ...
]
```

**UI:**
- Display 5 mechanism options as selectable cards
- Each card shows the mechanism name and a one-sentence description
- Student taps one to select
- "Use This Mechanism" button proceeds to Step 4

---

#### Step 4 — Validate Your Clarity Sentence
- Auto-assemble the Clarity Sentence:
  > "I help [target_market] who struggle with [problem] through [mechanism]."
- Display the assembled sentence in a highlighted box
- Show a "Validate This Idea" button

**AI Call:** `POST /api/generate/validate` with the full clarity sentence

**OpenAI Prompt:**
```
You are a brutally honest business advisor for the Philippine digital products market.

Clarity Sentence: "I help [TARGET_MARKET] who struggle with [PROBLEM] through [MECHANISM]"

Analyze this idea honestly and return a JSON response:
{
  "problem_validation": "Is this a real, urgent problem Filipinos pay to solve?",
  "market_size": "Approximate number of this target market in the Philippines",
  "buying_behavior": "Are they currently spending money on this type of solution?",
  "existing_solutions": ["list of 3-5 competing products or services"],
  "price_validation": "What price range do similar solutions sell for in PH?",
  "urgency_score": 8,
  "market_demand_score": 7,
  "red_flags": "Any concerns to be aware of",
  "recommendation": "GO" or "REFINE",
  "recommendation_reason": "Why you recommend go or refine",
  "refinement_suggestion": "If REFINE — specific suggestion on what to change"
}

Be specific to Philippine culture, economics, and buying behavior. Do not be overly encouraging.
```

**UI:**
- Show a scoring card with:
  - Urgency Score (X/10) with colored indicator (green 7+, yellow 5-6, red below 5)
  - Market Demand Score (X/10) with colored indicator
  - GO or REFINE badge (green / orange)
  - Red flags section
  - Recommendation reason
- If REFINE: Show a "Go Back and Adjust" button that lets them return to Step 1, 2, or 3 individually
- If GO: Show a "Save My Clarity Sentence" button

#### Step 5 — Save and Complete
- Save to `clarity_sentences` table
- Mark Module 1 as completed in `module_progress`
- Show a success screen with the final Clarity Sentence in a styled card
- "Go to Dashboard" button

---

### MODULE 2 — The Ebook Factory

**Goal:** Student walks away with a complete ebook exported as a .docx file and a Canva cover prompt.

**Pre-loaded data:** Clarity Sentence from Module 1

**Output stored in:** `ebooks` table

---

#### Step 1 — Generate Title & Outline
Show the student their Clarity Sentence at the top.

**AI Call:** `POST /api/generate/ebook-outline`

**OpenAI Prompt:**
```
You are an ebook strategist for the Philippine digital products market.

Clarity Sentence: "I help [TARGET_MARKET] who struggle with [PROBLEM] through [MECHANISM]"

Task 1: Generate 3 clear, outcome-driven ebook title options. Each title should:
- Be specific and benefit-driven
- Appeal to a Filipino audience
- Be simple and easy to understand
- Imply a clear result

Task 2: For the best title, create a table of contents with 6 to 8 chapters. For each chapter include:
- Chapter number
- Chapter title
- Chapter goal (1 sentence — what the reader will learn)
- Quick win (1 sentence — what the reader can immediately do after this chapter)

Return as JSON:
{
  "titles": ["title 1", "title 2", "title 3"],
  "outline": [
    {
      "chapter_number": 1,
      "title": "...",
      "goal": "...",
      "quick_win": "..."
    }
  ]
}
```

**UI:**
- Show 3 title options as selectable cards
- Student picks one title
- Show the full chapter outline below as a numbered list
- "This Looks Good — Start Writing" button proceeds to chapter generation

---

#### Step 2 — Auto-Generate All Chapters
- Show a progress screen: "KLARO is writing your ebook... (Chapter 3 of 7)"
- Generate each chapter one at a time sequentially (do not batch)

**AI Call for each chapter:** `POST /api/generate/ebook-chapter`

**OpenAI Prompt (per chapter):**
```
You are an ebook ghostwriter for the Philippine market.

Ebook title: [TITLE]
Target market: [TARGET_MARKET]
Core problem: [PROBLEM]
Method: [MECHANISM]

You are writing Chapter [NUMBER]: [CHAPTER_TITLE]
Chapter goal: [GOAL]
Quick win: [QUICK_WIN]

Write this chapter in three sections:

SECTION 1 — STORY STARTER (300-400 words)
Write a short, relatable story about someone in [TARGET_MARKET] dealing with [CHAPTER_TOPIC].
Keep it simple. Avoid exaggeration. End with a transition into the lesson.

SECTION 2 — CORE LESSONS (400-600 words)
Write the main teaching content of this chapter.
Use simple language. Use short paragraphs. Give practical, actionable advice.
No hype. No exaggerated claims. Filipino-audience friendly.

SECTION 3 — QUICK WIN (150-200 words)
Give the reader one specific action they can take today related to this chapter.
Make it easy, doable, and immediately useful.

Tone: Warm, practical, encouraging. Not preachy.
```

**UI:**
- After all chapters are generated, show a "Your Ebook is Ready" screen
- Display a chapter-by-chapter accordion the student can expand to preview each chapter
- Individual "Regenerate" button on each chapter if they want a different version
- "Export as Word Document" button triggers the .docx download

---

#### Step 3 — Export & Cover
- On export, use the `docx` npm package to assemble all chapters into a formatted .docx file
- File structure:
  - Title page (ebook title, target market)
  - Table of contents
  - Each chapter with heading + three sections
- After export confirmation, show a "Generate Your Cover Design Prompt" button

**Cover Prompt Generation:**
Generate a text prompt the student can paste into Canva's AI image generator:

```
Generate a Canva cover prompt:

Ebook title: [TITLE]
Target market: [TARGET_MARKET]
Tone: Professional but approachable. Filipino audience.

Create a Canva ebook cover design prompt that includes:
- Suggested background color or gradient
- Font style recommendation
- Image or illustration suggestion
- Overall mood/aesthetic

Keep it simple enough for a non-designer to execute in Canva in under 30 minutes.
```

- Show the Canva prompt in a copyable text box
- Include a "Open Canva" button that links to canva.com

---

### MODULE 3 — The Offer & Sales Page Builder

**Goal:** Student walks away with a complete irresistible offer and a full sales page ready to publish on Systeme.io.

**Pre-loaded data:** Clarity Sentence from Module 1, Ebook title from Module 2

**Output stored in:** `offers` table + `sales_pages` table

---

#### PART A — Build the Irresistible Offer

**Step 1 — Surface Objections**

**AI Call:** `POST /api/generate/objections`

**OpenAI Prompt:**
```
You are a sales psychology expert for the Philippine digital products market.

Clarity Sentence: "I help [TARGET_MARKET] who struggle with [PROBLEM] through [MECHANISM]"

Generate the top 10 most common objections or hesitations that [TARGET_MARKET] would have BEFORE buying an ebook that solves [PROBLEM].

These should be real, specific objections — not generic ones. Think about:
- Skepticism about results
- Past failed attempts
- Time concerns
- Money concerns
- Trust issues
- "Is this for me?" doubts

Return as a JSON array:
[
  { "objection": "...", "underlying_fear": "The real fear behind this objection" },
  ...
]
```

**UI:**
- Display 10 objections as selectable cards with checkboxes
- Student selects 3 to 5
- "Build My Bonuses Around These" button proceeds to Step 2

---

**Step 2 — Generate Bonus Ideas**
For each selected objection, generate a bonus document idea:

**OpenAI Prompt (per objection):**
```
You are a digital product strategist.

Main ebook: "[EBOOK_TITLE]" — helps [TARGET_MARKET] with [PROBLEM]
Objection to neutralize: "[OBJECTION]"

Create ONE bonus digital document idea that directly addresses this objection.
The bonus should:
- Be a simple document (checklist, guide, template, cheat sheet — NOT audio or video)
- Feel like an immediate, practical solution to the specific objection
- Have a compelling name that implies a clear outcome
- Be something that could realistically be created as a 2-5 page document

Return as JSON:
{
  "bonus_name": "...",
  "description": "One sentence — what this bonus does for the reader",
  "format": "checklist / guide / template / cheat sheet"
}
```

**UI:**
- Show each generated bonus in an editable card (student can rename or edit)
- Below each bonus: input field for "Perceived Value (₱)" — student enters a peso value
- After setting all values, show a running total

---

**Step 3 — Complete the Offer Stack**
- Show a clean offer summary:
  - Main ebook + value in pesos
  - Bonus 1 + value
  - Bonus 2 + value
  - Bonus 3+ value
  - **Total Value: ₱X,XXX**
- Input: "Your Selling Price (₱)" — student enters their actual price
- App generates the anchor line: "Total value: ₱[total] — yours today for only ₱[price]"
- Dropdown or text input for guarantee: "30-day money-back guarantee" or custom text
- "Build My Sales Page" button proceeds to Part B

---

#### PART B — Generate the Sales Page

**AI Call:** `POST /api/generate/sales-page`
Send the full offer stack + clarity sentence in one call.

**OpenAI Prompt:**
```
You are an expert direct response copywriter specializing in the Philippine market.

Clarity Sentence: "I help [TARGET_MARKET] who struggle with [PROBLEM] through [MECHANISM]"
Ebook title: [TITLE]
Bonuses: [BONUS LIST WITH VALUES]
Total value: ₱[TOTAL]
Selling price: ₱[PRICE]
Guarantee: [GUARANTEE]

Write a complete sales page using this exact structure. Total length: 800-1000 words.

1. HEADLINE: One powerful, outcome-focused headline (not a question)

2. PROBLEM SECTION (150-200 words):
Describe the daily struggle of [TARGET_MARKET] with [PROBLEM].
Make the reader feel deeply understood. Use "you" language.
Avoid hype. No exaggerated claims.

3. SOLUTION SECTION (100-150 words):
Introduce the ebook and the [MECHANISM] as the solution.
Explain simply how it works and why it's different.

4. PROOF SECTION (100-150 words):
Explain logically why this approach works.
Use reasoning, not testimonials (since this is a new product).
Make it feel credible and grounded.

5. OFFER SECTION (200-250 words):
List what's inside the ebook (5-7 bullet points of key outcomes).
Then present each bonus with its name, what it does, and its value.
End with the total value stack and the selling price anchor line.

6. GUARANTEE SECTION (50-75 words):
State the guarantee clearly and warmly. Make it feel safe to buy.

7. CALL TO ACTION (50-75 words):
One clear, calm invitation to buy. Not pushy. State the price clearly.
Include a line about what happens next after they click.

Tone throughout: Simple, clear, conversational, warm. Filipino-audience friendly.
No hype. No fake urgency. No exaggerated income claims.
```

**UI:**
- Show each section as a separate editable card (Problem, Solution, Proof, Offer, Guarantee, CTA)
- Each section has a "Regenerate This Section" button
- Show the assembled full sales page at the bottom as a preview
- Input field: "Paste your Systeme.io sales page URL here" (saved to profile for use in Module 4)
- "Copy Full Sales Page" button copies the complete text
- "Mark as Complete" saves everything and marks Module 3 done

---

### MODULE 4 — The 7-Day Email Sequence Builder

**Goal:** Student walks away with 7 complete emails loaded-and-ready for their Systeme.io autoresponder.

**Pre-loaded data:** Clarity Sentence, Ebook title, Sales page URL from Module 3

**Output stored in:** `email_sequences` table

---

#### Step 1 — Confirm Sales Page URL
- Show the pre-loaded sales page URL from Module 3
- Allow editing if the URL has changed
- "Generate My Email Sequence" button

---

#### Step 2 — Generate All 7 Emails
Generate all 7 emails in a single AI call.

**AI Call:** `POST /api/generate/email-sequence`

**OpenAI Prompt:**
```
You are an email copywriter specializing in digital products for Filipino creators selling to whatever niche audience their clarity sentence specifies.

Clarity Sentence: "I help [TARGET_MARKET] who struggle with [PROBLEM] through [MECHANISM]"
Ebook title: [TITLE]
Sales page URL: [URL]

Write a 7-day email sequence with this arc:
- Emails 1-4: Pure value. Pain point storytelling. Zero selling. Make the reader feel deeply understood.
- Emails 5-7: Gradually introduce the product. Soft to medium selling. End each with a CTA linking to the sales page.

Style rules for ALL emails:
- Short. Personal. Conversational. Like a message from a friend.
- NOT corporate. NOT AI-sounding. NO buzzwords.
- Each email should feel like it lives inside the reader's world — their daily struggles, their feelings, their frustrations.
- NO subject lines that sound like marketing. Sound like a real person is writing.
- Length: 150-250 words per email (short is better)
- CTA in emails 5-7 should be a simple, non-pushy link to the sales page

Return as a JSON array:
[
  {
    "day": 1,
    "type": "value",
    "subject": "...",
    "body": "...",
    "cta": null
  },
  {
    "day": 5,
    "type": "selling",
    "subject": "...",
    "body": "...",
    "cta": "[SALES_PAGE_URL]"
  }
]
```

**UI:**
- Show all 7 emails as an accordion list (Day 1, Day 2... Day 7)
- Each email shows the subject line and a preview of the body
- Expand to see the full email
- Individual "Regenerate" button on each email
- "Copy All Emails" button copies everything in a format ready to paste into Systeme.io
- Show a reusable prompt card at the bottom:
  > "Use this prompt in ChatGPT anytime you want to write a new email: [reusable prompt template]"
- "Mark as Complete" saves and marks Module 4 done

---

### MODULE 5 — The Lead Magnet Builder

**Goal:** Student walks away with a complete lead magnet exported as a .docx file, ready to convert to PDF.

**Pre-loaded data:** Clarity Sentence, Ebook title from Module 2

**Output stored in:** `lead_magnets` table

---

#### Step 1 — Choose Format
Show three format options as large clickable cards:

| Format | Description |
|--------|-------------|
| Checklist | A quick, scannable list of action items |
| Quick Guide | A short 3-5 page how-to guide |
| Free Report | A slightly longer insight document with key findings |

Student picks one and clicks "Generate My Lead Magnet"

---

#### Step 2 — Generate Lead Magnet

**AI Call:** `POST /api/generate/lead-magnet`

**OpenAI Prompt:**
```
You are a lead magnet creator for Filipino digital product sellers.

Clarity Sentence: "I help [TARGET_MARKET] who struggle with [PROBLEM] through [MECHANISM]"
Main ebook title: [TITLE]
Lead magnet format: [FORMAT]

Create a lead magnet that follows these principles:
1. USEFUL: Gives real, actionable value that creates an "aha moment"
2. INCOMPLETE: Solves ONE small, specific piece of the bigger problem — but leaves the main solution for the paid ebook
3. AUTHORITY-BUILDING: Makes the reader feel the creator knows what they're talking about
4. BRIDGES TO THE EBOOK: The last section naturally leads the reader to want the paid ebook as the next logical step

Structure:
1. TITLE: Clear, benefit-driven, specific. Not generic.
2. HOOK (2-3 sentences): Immediately speak to the reader's pain. Make them feel seen.
3. INTRODUCTION (3-5 sentences): Establish credibility. What will they get from this?
4. MAIN CONTENT:
   - If checklist: 7-10 specific, actionable items with a one-line explanation each
   - If quick guide: 4-5 short sections with practical steps
   - If free report: 3-4 insight sections with key observations and one action per section
5. QUICK WIN OUTCOME (2-3 sentences): What the reader can do immediately after reading this
6. BRIDGE TO EBOOK (3-4 sentences): A soft, natural transition — NOT a hard sell. Acknowledge that this lead magnet only scratches the surface. Mention the ebook as the complete solution. Make it feel like the obvious next step.

Tone: Simple. Warm. Practical. Filipino-audience friendly. No hype.

Return as JSON:
{
  "title": "...",
  "hook": "...",
  "introduction": "...",
  "main_content": "...",
  "quick_win": "...",
  "bridge_to_ebook": "..."
}
```

**UI:**
- Show the generated lead magnet in a clean preview
- Each section displayed separately with a "Regenerate Section" button
- "Export as Word Document" button downloads the .docx
- Show a tip: "After downloading, save it as a PDF in Word (File → Save As → PDF) before sharing with your audience."
- "Mark as Complete" saves and marks Module 5 done

---

### MODULE 6 — The Facebook Content Engine

**Goal:** Student walks away with 3, 5, or 10 ready-to-post Facebook content pieces.

**Pre-loaded data:** Clarity Sentence from Module 1

**Output stored in:** `content_posts` table

---

#### Step 1 — Choose Content Type and Quantity

Show two selection rows:

**Content Type (pick one):**
- Problem Post — Opens with a pain point your audience deeply relates to
- Micro Lesson — Teaches one small, practical tip
- Personal Insight — Shares a perspective or observation about the audience's world

**How many posts? (pick one):**
- 3 posts
- 5 posts
- 10 posts

"Generate My Posts" button

---

#### Step 2 — Generate Posts

**AI Call:** `POST /api/generate/content-posts`

**OpenAI Prompt:**
```
You are a Facebook content strategist for Filipino digital product sellers.

Clarity Sentence: "I help [TARGET_MARKET] who struggle with [PROBLEM] through [MECHANISM]"
Content type: [TYPE]
Number of posts: [NUMBER]

Write [NUMBER] Facebook posts of type [TYPE].

Post format for ALL types:
1. HOOK (1 sentence): Scroll-stopping first line. Speaks directly to the reader's pain, curiosity, or experience. Must make them stop scrolling.
2. VALUE (3-5 sentences): The main content. Practical, relatable, specific to [TARGET_MARKET].
3. ENGAGEMENT CTA (1 sentence): Ask readers to comment a specific word OR send a DM. Do NOT include external links. Examples: "Comment 'GUIDE' below and I'll send this to you." or "DM me the word 'HELP' if this sounds familiar."

Content type guidelines:
- Problem Post: The entire post lives inside the reader's world. Describe their struggle in detail. Make them feel understood. Do not offer a solution in the post — that comes in the DM.
- Micro Lesson: Teach one small, specific, actionable tip. Keep it simple. One idea only.
- Personal Insight: Share an observation or perspective about [TARGET_MARKET]'s situation. Make it feel like the writer truly understands their world.

Rules for ALL posts:
- No hashtags
- No emojis (unless naturally Filipino in context)
- No links
- No selling in the post itself
- Sound like a real person, not a marketer
- Filipino-audience friendly (light Taglish is acceptable)

Return as a JSON array:
[
  {
    "hook": "...",
    "value": "...",
    "cta": "...",
    "full_post": "..."
  }
]
```

**UI:**
- Show each post as a separate card
- Display the full post text in each card
- "Copy" button on each post
- "Regenerate" button on each post
- "Copy All Posts" button at the top
- "Generate More Posts" button — takes them back to Step 1 to generate a new batch
- "Mark as Complete" saves and marks Module 6 done

---

## 11. UI/UX DESIGN GUIDELINES

### Color Palette
- **Primary:** Deep navy blue (`#1A1F36`) — premium, trustworthy
- **Accent:** Gold (`#F4B942`) — premium, aspirational
- **Background:** Off-white (`#F8F9FA`) — clean, easy to read
- **Success:** Emerald green (`#10B981`)
- **Warning:** Amber (`#F59E0B`)
- **Error:** Red (`#EF4444`)
- **Text:** Dark charcoal (`#1F2937`)

### Typography
- **Font:** Inter (Google Fonts) — clean, modern, highly readable
- **Headings:** Bold, 24-32px
- **Body:** Regular, 16px
- **Labels/Tags:** Medium, 14px

### Key Design Principles
1. **Mobile-first.** Many Filipino students will access KLARO on their phones. All layouts must work perfectly on mobile.
2. **One action per screen.** Never show two competing primary actions. One button per step.
3. **Always show progress.** Use step indicators (Step 1 of 4) on every multi-step flow.
4. **Copy buttons everywhere.** Any generated text must have a one-click copy button.
5. **Locked modules are visible but clearly unavailable.** Show what's coming — it builds excitement. Don't hide locked features.
6. **Loading states are encouraging.** Instead of a generic spinner, show messages like "KLARO is finding your market's biggest problems..." or "Writing Chapter 3 of 7..."

### Component Patterns
- **Selectable cards:** Used for choosing problems, mechanisms, bonuses, and post types. Cards have a clear selected state (border highlight + checkmark).
- **Regenerate buttons:** Small, secondary button on every AI-generated section. Icon: refresh/cycle symbol.
- **Copy buttons:** Every text output has a "Copy" button. Show a brief "Copied!" confirmation on click.
- **Export buttons:** Primary action on ebook and lead magnet completion screens.
- **Accordion:** Used for email sequence (Day 1, Day 2...) and ebook chapter preview.

---

## 12. NAVIGATION STRUCTURE

### Top Navigation Bar
- KLARO logo (left)
- Current module name (center, on module pages)
- Student name + avatar dropdown (right)
  - Dropdown: My Profile, Sign Out

### Sidebar (Dashboard and Module Pages)
- Dashboard (home icon)
- Module 1 — The Clarity Builder (with status indicator)
- Module 2 — The Ebook Factory
- Module 3 — The Offer & Sales Page Builder
- Module 4 — The 7-Day Email Sequence Builder
- Module 5 — The Lead Magnet Builder
- Module 6 — The Facebook Content Engine

Locked modules show a padlock icon in the sidebar.

---

## 13. DEPLOYMENT STEPS

1. Push project to a GitHub repository
2. Connect repository to Vercel (vercel.com → New Project → Import from GitHub)
3. Add all environment variables in Vercel project settings
4. Run the Supabase SQL schema (Section 4) in the Supabase SQL editor
5. Set the production domain in Supabase Auth → URL Configuration
6. Configure Systeme.io webhooks to point to the production webhook URL:
   - `https://yourdomain.com/api/webhooks/systeme`
7. Test the webhook by manually adding the `KLARO-FULLPAY` tag to a test contact in Systeme.io and verifying access is granted

---

## 14. PHASE 2 FEATURES (DO NOT BUILD NOW)

The following are planned for Phase 2 and should NOT be included in the initial build:

- Module 7: Facebook Ads Generator
- Module 8: TBD
- Human-sounding email copy (personal story input per email)
- In-app ebook text editor
- Analytics dashboard (email open rates, sales page visits)
- Student progress notifications / reminders

---

*KLARO — Built for Negosyo University | One Person Income System*
*Document Version 1.0 | April 2026*
