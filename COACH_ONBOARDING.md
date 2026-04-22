# Coach Onboarding Guide — KLARO

**For:** Edgar Oribiana
**Role:** Accelerator Program Coach
**Last updated:** April 21, 2026

---

## Welcome to KLARO

KLARO is the central workspace where you and your Accelerator Program clients execute the 6 modules of the program. Everything in one place — your students do their work here, and you review, unlock, and guide them here.

**How KLARO fits with your coaching:**
- Students execute their modules (ebook, offer, sales page, etc.) inside KLARO
- You review their work, approve modules, and request revisions
- Communication still happens via **email and Zoom** — KLARO is the work/progress tracker, not a chat tool
- You manually unlock modules weekly as students finish their coaching calls

---

## 1. Getting Started

### Your login
- **URL:** https://klaro.chillyonaryo.com/login
- **Email:** edgar.negosyouniversity@gmail.com
- **Password:** (set during first login — check your email for the setup link)

### First-time setup
1. Log in at the URL above
2. You'll be taken to `/coach` automatically (the Coach Dashboard)
3. If you see "Dashboard" instead, go directly to `/coach` in your browser

### Who your students are
You only see the students **assigned to you** (program_type: `accelerator` + `coach_id` = you). Right now you have **3 active AP students**:
1. Rowena Marie Pagulayan
2. Junnie Daleon
3. Romel Agustin

As new Accelerator students enroll (via the `Accel-Enrolled` tag in Systeme.io), they will be automatically assigned to you.

---

## 2. The Coach Dashboard

When you log in, this is what you'll see:

### Top: Tabs
- **Accelerator** tab — your AP students (the main focus)
- **TOPIS** tab — appears if you have any TOPIS students (shouldn't right now)

### Summary Cards (4 counts)
- **Total** — all your students
- **On Track** (green) — active in the last 2 days
- **At Risk** (yellow) — no activity in 3-5 days
- **Disengaged** (red) — no activity in 6-9 days
- **Ghost** (gray, shown with status) — no activity in 10+ days

### Student List
Each student card shows:
- Name and email
- Current status (green/yellow/red/ghost)
- 7 module completion dots (filled = complete, empty = not yet)
- Ebook title (if they've started)
- Quick access button to their detail page

### Bulk Actions Panel
At the bottom, you can:
- **Select multiple students** (checkboxes)
- **Pick a module** (1-7)
- Click **Unlock** to unlock that module for everyone selected
- Click **Lock** to re-lock a module if someone got ahead

---

## 3. When a New AP Student Enrolls

Here's exactly what happens when someone new signs up for the Accelerator Program, and what YOU need to do:

### The flow

```
1. Customer pays for Accelerator on Systeme.io
        ↓
2. Systeme.io adds the "Accel-Enrolled" tag
        ↓
3. Webhook fires → KLARO logs "accelerator_enrolled_pending_signup"
   (no account exists yet, so it's queued)
        ↓
4. YOU get notified (via Systeme.io automation email)
        ↓
5. YOU email the new student with the signup link (template below)
        ↓
6. Student signs up at klaro.chillyonaryo.com/signup
        ↓
7. KLARO automatically:
   - Creates their account
   - Applies their Accelerator access
   - Assigns you as their coach
   - Unlocks Module 1
        ↓
8. They appear on your Coach Dashboard
        ↓
9. You do your first 1:1 onboarding Zoom call
```

**Important:** Nothing happens in KLARO until THEY sign up. Your email triggers that signup.

### Your #1 rule: Email the new student within 24 hours of enrollment

The faster they get the signup link, the faster they start. Don't wait.

---

### 📧 Email Template 1: Welcome + Signup Invitation

Use this when a new student has just been tagged in Systeme.io (Accel-Enrolled). This is your first email to them.

**Subject:** Welcome to the Accelerator Program — let's get you started

```
Hi [First Name],

Welcome to the Negosyo University Accelerator Program. I'm Edgar — 
I'll be your coach for the next 8 weeks.

Before our first call, I need you to do one quick thing:

👉 Create your KLARO account here:
https://klaro.chillyonaryo.com/signup

KLARO is the workspace where you'll do all your program work — 
from finding your clarity sentence to building your sales page and 
email sequence. Once you sign up, your Module 1 (The Clarity Builder) 
will be unlocked and ready.

Use the same email address you used to enroll: [their email]

Once you're set up, reply to this email and we'll schedule your 
first 1:1 onboarding call. I want to get to know you, your goals, 
and make sure we're set up for a strong 8 weeks.

Looking forward to working with you.

Tara na,
Coach Edgar
Negosyo University Accelerator Program
```

### 📧 Email Template 2: Scheduling the Onboarding Call

Use this AFTER they've created their KLARO account and replied to confirm.

**Subject:** Let's schedule your onboarding call

```
Hi [First Name],

Great, you're all set up in KLARO. Now let's get your first 
1:1 call booked.

This first call is 30 minutes. We'll cover:
- Your background and what brought you here
- Your current business (or the one you want to build)
- Your 8-week goal for the program
- How we'll work together each week

Pick a time that works for you:
[Your Calendly link]

Before the call, take 10 minutes to click around KLARO and open 
Module 1 — The Clarity Builder. Don't complete it yet. Just get 
familiar with the layout. We'll work through it together.

See you soon.

Tara na,
Coach Edgar
```

### 📧 Email Template 3: Student Didn't Sign Up After 3 Days

Send this if a student got enrolled but hasn't created their KLARO account after 3 days.

**Subject:** Quick check-in — did you get my last email?

```
Hi [First Name],

I sent you a signup link a few days ago but haven't seen your 
account come through yet. Just wanted to make sure it didn't 
get lost in your inbox.

Here's the link again:
https://klaro.chillyonaryo.com/signup

Use the same email address you enrolled with: [their email]

If you're running into any issue signing up, reply to this email 
and let me know what's happening. I'll help you get set up.

The sooner you're in, the sooner we can start. Don't let this 
slip — momentum matters.

Tara na,
Coach Edgar
```

### 📧 Email Template 4: Module Approved — Next Steps

Send this after you've approved a student's module in KLARO.

**Subject:** Module [X] approved — here's what's next

```
Hi [First Name],

Just approved your Module [X]. Solid work on [specific thing 
you liked — e.g., "narrowing your target market to working moms 
35-45" or "the clarity of your unique mechanism"].

Module [X+1] is now unlocked in your KLARO dashboard. Here's 
what to focus on this week:

[1-2 sentence description of the next module's focus]

If anything feels stuck, don't wait — email me before our next 
call so we can talk it through.

Tara na,
Coach Edgar
```

### 📧 Email Template 5: Revision Requested

Send this alongside the revision note you left in KLARO, so the student sees the feedback in both places.

**Subject:** Feedback on your Module [X] — a few things to tighten

```
Hi [First Name],

I reviewed your Module [X] and left detailed notes inside KLARO. 
The direction is solid, but there are a few things to tighten 
before we move to the next module.

Open KLARO and check the amber "Needs Revision" banner on 
Module [X] — my notes are there.

Here's the short version:
- [Point 1]
- [Point 2]
- [Point 3]

Work on this over the next 2-3 days and resubmit. If anything 
is unclear, reply to this email and I'll walk you through it.

Remember: the better we nail this module, the easier the next 
ones become. It's worth the extra iteration.

Tara na,
Coach Edgar
```

---

## 4. Weekly Workflow (your Monday routine)

### Every Monday morning:
1. **Open the dashboard** — `/coach`
2. **Check the status cards** — how many are On Track vs At Risk?
3. **Spot the At Risk / Disengaged students** — these need a message this week
4. **Unlock the next module** for students who finished last week's call

### During the week:
5. **Review submitted modules** — when a student finishes a module, it shows up as "Pending Review"
6. **Approve or request revision** — approving auto-unlocks the next module for them
7. **Read private notes** — your notes on each student to remind yourself of context

### Before your next Zoom call:
8. **Click into the student's detail page** (`/coach/[studentId]`)
9. **Read their current work** — clarity sentence, ebook draft, sales page, etc.
10. **Note what to coach on** — add private notes for your own reference

---

## 5. Reviewing Module Work

When a student completes a module, you can review it and either **approve** or **request revision**.

> **Important:** Reviews are now **optional feedback**, not a gate. When a student completes a module, the next module automatically unlocks for them — they don't have to wait for your approval to continue. Your review serves as quality feedback and ensures they're on the right track, but it doesn't block their progress.
>
> If you believe a student is moving too fast without addressing serious issues, you can:
> 1. Click "Needs Revision" and leave specific guidance
> 2. Use the "Lock Module" feature on the main dashboard to lock the next module until they fix the issue
> 3. Email them directly to slow down and iterate

### How to review:
1. From the dashboard, click the student's name
2. You'll see all 7 modules with status (Complete / Pending Review / Not Started)
3. Click **"Review this module"** on any completed module
4. You'll see two buttons:
   - **✅ Approve** — marks the module approved, auto-unlocks the next one
   - **🔁 Request Revision** — requires a note explaining what to improve

### Writing a revision note
Keep it specific and actionable:

**Bad:** "Please revise."
**Good:** "Your headline is clear but too generic. Add a specific number (like '30 days' or 'First 10 Clients') and mention the exact frustration they're trying to escape. Re-submit when done."

The student sees this note on their side and knows exactly what to fix.

### What the student sees
- **Pending Review** → blue "Waiting for coach feedback" banner
- **Approved** → green "Module approved!" banner
- **Needs Revision** → amber banner showing your note

---

## 6. Manually Unlocking Modules

The Accelerator Program is coach-led, which means **YOU decide when modules unlock**. This is intentional — you want students to move at your pace, not the app's.

### To unlock a module for one student:
1. Click into their detail page
2. Find the next locked module
3. Click **"Unlock Module X"** button

### To unlock a module for multiple students at once:
1. From the main dashboard
2. Check the boxes next to their names
3. Pick the module number from the dropdown
4. Click **Unlock**

### When to unlock what:
| Week | Module to unlock | After student finishes... |
|---|---|---|
| Week 1 | Module 1 (unlocked by default on enrollment) | Onboarding call |
| Week 2 | Module 2 (Ebook Factory) | Module 1 + 1:1 review |
| Week 3 | Module 3 (Offer Builder) | Module 2 + 1:1 review |
| Week 4 | Module 4 (Sales Page) | Module 3 + 1:1 review |
| Week 5 | Module 5 (Email Sequence) | Module 4 + 1:1 review |
| Week 6 | Module 6 (Lead Magnet) | Module 5 + 1:1 review |
| Week 7 | Module 7 (Facebook Content) | Module 6 + 1:1 review |

---

## 7. Private Notes Per Student

Every student detail page has a **"Private Notes"** field visible only to you.

### What to put there:
- Key context from your Zoom calls
- Blockers they mentioned
- What to follow up on next week
- Business specifics (their niche, audience, what's working)
- Red flags (struggling, ghost warning, considering dropping out)

### Example note:
```
Apr 14 Zoom: She's targeting working moms 35-45.
Ebook topic: stress eating. Struggling with clarity mechanism — 
too vague. Next call Apr 21, push her to narrow to "emotional eating 
triggers" vs "general stress eating." Watch for drop-off — she missed 
last week's call.
```

Keep it conversational. No one else reads this — it's your memory.

---

## 8. Status Indicators Explained

Every student has a color based on their last activity in KLARO:

| Color | Status | Meaning | What to do |
|---|---|---|---|
| 🟢 Green | On Track | Active within 2 days | Keep going, all is well |
| 🟡 Yellow | At Risk | No activity 3-5 days | Send a check-in email: "Hi [name], anything blocking you?" |
| 🔴 Red | Disengaged | No activity 6-9 days | Personal Zoom outreach — they're slipping |
| ⚪ Ghost | Ghost | No activity 10+ days | Direct recovery: "Are you still in? Reply YES or HELP." |

**Note:** "Activity" means they logged into KLARO, not necessarily that they emailed you. A student might be working offline but still needs to log in to submit work.

---

## 9. Communication Outside KLARO

KLARO does **not** handle your email or Zoom calls. Here's how it fits with your existing tools:

| Activity | Tool |
|---|---|
| Reviewing student work | KLARO (this app) |
| Approving/rejecting modules | KLARO (this app) |
| Sending coaching feedback | Email |
| 1:1 coaching sessions | Zoom |
| Sending Zoom links | Email (with calendar invite) |
| Group announcements | Email broadcast via Systeme.io |

**The flow:**
1. Student finishes work in KLARO → submits for review
2. You review in KLARO → approve or request revision
3. You email them to set up or confirm the Zoom call
4. You do the Zoom call
5. After the call, you unlock their next module in KLARO
6. Add a private note with what you discussed

---

## 10. What NOT to Do

- ❌ **Don't share your login** — if another coach needs access, request a new coach account through the admin (Jon)
- ❌ **Don't manually edit student work** — they should edit their own content. Coach through feedback, not by doing it for them
- ❌ **Don't unlock all 7 modules at once** — this defeats the purpose of the coach-paced program
- ❌ **Don't leave revision notes empty** — students need specific, actionable guidance
- ❌ **Don't approve rushed work** — if it's not ready, request revision. Your approval = quality standard

---

## 11. Common Questions

### Q: A student isn't showing up on my dashboard. What do I do?
The student might not have `program_type = 'accelerator'` in the database or might not be assigned to your `coach_id`. Contact Jon (admin) to verify.

### Q: A student completed a module but I don't see it for review.
Make sure they clicked "Save & Complete" at the end of the module, not just "Save Draft." Ask them to verify.

### Q: I accidentally approved the wrong module.
Click "Re-review this module" on the detail page. You can change your approval to "needs revision" with a note.

### Q: Can I see a student's ebook content?
Yes — on the student detail page, you'll see their full clarity sentence, ebook title, sales page draft, etc. All their outputs are visible to you.

### Q: What if a student falls behind by several weeks?
Use your Zoom call to realign. In KLARO, keep their unlocked modules as they are — don't lock modules they've already accessed. Focus coaching on unblocking them.

### Q: Do students get email notifications when I approve or request revision?
**Not yet.** Right now they need to log in to see review status. Email notifications are on the roadmap. For now, send them an email after reviewing to let them know.

### Q: How do I add a new AP student manually?
You don't — enrollment happens via Systeme.io tags. If someone is missing, ask Jon to verify their `Accel-Enrolled` tag was added and that their webhook fired correctly.

### Q: A student says they can't access a module I already unlocked.
Ask them to log out and log back in. If still stuck, screenshot their screen + the URL and send to Jon.

---

## 12. Getting Help

- **Technical issues:** Email Jon (nvorana@gmail.com) with the student's email + a screenshot
- **Coaching questions / program decisions:** Jon handles program-level calls
- **Urgent student escalations** (refund requests, complaints): Email Jon directly, don't leave the student waiting

---

## Quick Reference — Links

| What | URL |
|---|---|
| Login | https://klaro.chillyonaryo.com/login |
| Your Coach Dashboard | https://klaro.chillyonaryo.com/coach |
| Individual student | https://klaro.chillyonaryo.com/coach/[student-id] |

---

## Final Thought

Your role in KLARO is to be the **gatekeeper and accelerator** — you make sure students do the work, that the work is good, and that they don't move forward until they're ready.

Students who work with you should feel:
- "I can't fake it — my coach will spot it"
- "I got real feedback that made my work better"
- "I know exactly what to do next"

That's the whole game. KLARO is just the workspace that makes it easy for you to do it.

---

**Welcome aboard, Edgar. Tara na.**
