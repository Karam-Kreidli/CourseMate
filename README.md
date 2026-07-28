<div align="center">
  <img src="public/coursemate.svg" alt="CourseMate" width="100%" />
  <p><em>The intelligent web application for seamless course registration and scheduling at the University of Sharjah.</em></p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  </p>

  <p>
    <img src="https://img.shields.io/github/contributors/Karam-Kreidli/CourseMate?logo=github&color=blue" alt="Contributors" />
    <img src="https://img.shields.io/github/last-commit/Karam-Kreidli/CourseMate?logo=github&color=green" alt="Last Commit" />
    <img src="https://img.shields.io/github/repo-size/Karam-Kreidli/CourseMate?logo=github&color=orange" alt="Repo Size" />
    <img src="https://img.shields.io/github/license/Karam-Kreidli/CourseMate?logo=github&color=yellow" alt="License" />
  </p>
</div>

---

## 🛑 The Problem

During registration periods, getting into the right course sections with preferred timings or instructors can be incredibly difficult. Students often resort to constantly refreshing the registration portal hoping a seat opens up, or they turn to social media groups trying to arrange manual "swaps" with other students. This process is highly uncoordinated, relies heavily on luck, and requires tedious manual communication that often falls through at the last minute.

## 💡 The Idea

**CourseMate** acts as an intelligent intermediary. Instead of hunting through WhatsApp groups or hoping for a random drop, students can use CourseMate to declare exactly what course section they *have*, and what section they *want*. The platform handles the rest securely and intelligently.

---

## 🚀 How It Solves These Problems

CourseMate streamlines the entire process through several key mechanisms:

*   **Smart Swapping:** If Student A has Section 1 but wants Section 2, and Student B has Section 2 but wants Section 1, CourseMate's smart matching algorithm instantly connects them.
*   **Giveaways & Requests:** If a student is simply dropping a course and doesn't need a swap, they can list it as a **Giveaway** for anyone who needs it. Conversely, students can post **Requests** for sections they desperately need.
*   **Coordination Without Contact Details:** Matched students agree on when to do the swap inside the app, using a fixed catalogue of templated messages with WhatsApp-style delivery ticks — no phone numbers, no group chats, and nothing free-typed to moderate.
*   **Instant Notifications:** Students no longer need to constantly monitor the app. By **watching** a course section, they receive an in-app notification and email the moment a relevant swap or giveaway becomes available — all collected in a dedicated notification center with a live unread badge.
*   **Tailored Academic Experience:** The platform natively understands the University of Sharjah's structure. By capturing a student's gender and major, it automatically filters out irrelevant sections.
*   **Visual Schedule Builder:** To prevent overlapping swaps, students can visually master and preview their potential schedule right within the app before finalizing changes.

---

## 🧭 Platform Architecture & Routing

Every single aspect of the app is engineered to funnel students toward successful, stress-free schedules.

### 1. `/` (Home Dashboard)
The landing hub after sign-in. It surfaces a personalized snapshot rather than the raw feed: your active-post and pending-match counts, the total credits in your latest saved schedule, and the **electives offered this semester** (department *and* university baskets) filtered to your major. Targeted announcements surface here on arrival.

### 2. `/browse` (The Feed)
The central marketplace. The feed natively applies intelligent filtering to **only** show posts (swaps, giveaways, and requests) that match your declared major and gender (preventing campus overlap).
*   **Capabilities:** Users can instantly search this curated feed by Course CRN, Course Name, or Course ID.
*   **Interest Flow:** For giveaways and requests (which aren't swaps), an **"I'm interested"** action opens a **chat thread** with the poster (see `/chat`). No phone numbers change hands — the poster is notified in-app and by email, and replies inside CourseMate.
*   **Section Alerts:** This is where students set up **watch-a-section** alerts (see `/notifications`).

### 3. `/post` (Creation Hub)
The hub where students officially register a "Have" or "Want" section.
*   **Logic:** It dynamically parses the user's major to only allow submitting posts for relevant courses. It enforces constraints—preventing users from exceeding the 5 active post maximum, keeping them from submitting identical swap requests, and ensuring no bad data permeates the system.

### 4. `/matches` (Swap Transactions)
When the matching engine finds a reciprocal 1-to-1 **swap** between two students, a record is created here in a **Pending Match** state. (Giveaways and requests don't use matches — they're coordinated through the "I'm interested" flow on the feed.)
*   **The 24-Hour Timer:** Matches are securely held for exactly 24 hours.
*   **Dual Acceptance Logic:** Only when *both* independent parties click "Accept" inside the 24-hour window will the match finalize. If a match is declined or expires, the original post is **auto-requeued** and placed back on the market instantly.
*   **Coordination:** A chat thread opens the moment the match is created, so the two sides can agree on a time *inside* the 24-hour window rather than after it. A phone number is still available on an accepted match, but only behind an explicit "Show phone number" tap.

### 5. `/chat` (Coordination Threads)
The in-app channel that replaces swapping phone numbers. A thread opens automatically for every match (the moment it's created, not after acceptance) and for every "I'm interested" on a giveaway/request.
*   **Templated messages, not free text:** there is no text box anywhere. Students pick a sentence from a fixed catalogue — grouped into *Timing*, *Doing it now*, *Status*, and *Courtesy* — and fill any blanks from dropdown chips (a day, a half-hour time slot, one of the sections actually in the swap, a retry interval). This keeps the conversation on-task, leaves nothing to moderate, and makes it impossible to leak an off-platform contact or send anything abusive.
*   **Server-enforced:** `messages` has no insert policy at all. Every message goes through the `send_message` RPC, which re-checks the template key, rejects any value the picker wouldn't have offered, and renders the text itself — so a crafted client can't put arbitrary words in front of another student. Sending is rate-limited per conversation.
*   **Delivery ticks:** one tick when the message is stored, two when it has reached every other participant's app, two in the accent colour once they've all actually opened the thread. In a 3-way cyclic swap the state only advances when the slowest person catches up.
*   **Structured by design:** each message is stored as a template key plus its values, so the platform can see *why* swaps fail ("seat was taken", "rescheduled three times") instead of losing it to WhatsApp.
*   **Lifecycle:** threads close automatically when a match is declined, expires, or completes, and the composer is disabled with a closing note.

### 6. `/schedule` (Visual Builder)
An advanced graphical permutations tool natively built into the platform.
*   **Complexity Management:** It dynamically renders lectures, linked labs, and tutorial combinations so they never overlap.
*   **Preferences:** Students can customize gap minimization rules, instruct the system to pack classes into compact days, strictly avoid Arabic or English designated classes (e.g., stopping section "01A" if English is preferred), and cleanly ingest "Major Elective" baskets flawlessly.

### 7. `/instructors` (Instructor Schedule)
A lookup tool that lets a student search any instructor by name and see the full weekly schedule of class times they teach this term — useful for vetting a section before swapping into a different professor.

### 8. `/profile` (User Settings)
The core setup and onboarding view that forcefully captures necessary metadata required to feed the logic loops for the rest of the application.
*   **Settings & Preferences:** Beyond identity fields, students control their app **theme** and a set of **email notification preferences** — independently toggling swap-match, interest, and watched-section emails off. In-app notifications always remain on; these toggles govern email delivery only.

### 9. `/notifications` (Notification Center)
A unified in-app inbox for everything time-sensitive, surfaced via a live **unread badge** on the bottom navigation bell.
*   **What lands here:** new swap matches, interest in your giveaways/requests, unread chat messages, and alerts for course sections you're watching. Opening the page marks items as read and clears the badge.
*   **Chat is deduplicated:** a burst of messages in one thread produces a single unread entry here, not one per message, so a busy conversation can't bury everything else.
*   **Section Alerts (Watch a Section):** Straight from the feed, a student can subscribe to a course — optionally pinned to a specific section — for the active term. The instant a matching **swap or giveaway** is posted, the watcher receives both an in-app notification and (unless opted out) an email, turning the platform from pull to push.

### 10. `/admin` (Admin Console)
A gated, admin-only operator console for running the platform.
*   **Overview:** At-a-glance analytics — user, post, and match counts, recent activity, type/status breakdowns, and top courses by post volume.
*   **Management Tabs:** Users, Posts, Semesters, Majors, and **Courses** (search and edit a course's attributes — credit hours, major memberships, and elective type, including shared university **Basket** electives with per-major exceptions).
*   **Announcements:** A rich-text broadcaster precisely targeted by major, gender, and/or specific users, with per-announcement **dismissal tracking** (see exactly who dismissed each one).

### 11. `/auth` (Authentication)
Dedicated, fully secure authentication proxy built seamlessly onto Supabase's OAuth/OTP ecosystem. It guards all internal APIs to protect student data.

---

## 🔐 Data Collection, Storage, and Privacy Philosophy

CourseMate handles sensitive data carefully. Here is exactly **why** we collect what we do, and **how** it is managed:

| Data Point | Rationale For Collection | Storage & Privacy Guarantees |
| :--- | :--- | :--- |
| **Gender** | UoS strictly segregates campuses (e.g., `Main/Men` vs `Main/Women`). Without knowing a user's gender, a male student could inadvertently accept a swap for a female-designated course section, which is physically impossible to attend. | Held in your `profiles` row and governed by the same Row-Level Security that guards all profile data — never surfaced in the UI, used only in the background as a campus route-filter. (Supabase encrypts data at rest, which guards against physical media theft; RLS is what controls application-level access.) |
| **Major** | Prevents the system from showing Engineering swaps to a Med student. It's the central pillar that enables the `/schedule` route to dynamically look up a user's applicable Department Electives. | Retained in profiles and queried passively via the UI. |
| **Phone Number** | A fallback for the final step of a swap, where both sides must click "Drop" in the university portal at the same moment. Since the introduction of `/chat`, this coordination happens **in-app by default** and a number is rarely needed at all. | **Hidden by default, and now optional.** For **swaps**, a number stays locked behind `/matches` Row Level Security and is only unveiled once **both** parties hit "Accept" — and even then, only after an explicit "Show phone number" tap. For **giveaways/requests**, the poster may publish their number or keep it private; the "I'm interested" flow no longer sends anyone's number by email, it opens a chat thread instead. |
| **Student ID** | Defends the platform against spam. Guarantees that active accounts are verifiable, enrolled University of Sharjah students. | Visible internally for trust & accountability metrics. |
| **Full Name** | Personalizes the interactions, injecting a human element into automated notifications (e.g., *"Karam accepted your swap request!"*). | Publicly associated strictly with your respective swaps/giveaways. |

---

## 🛠️ Technical Stack Overview

*   **Frontend Ecosystem:** Next.js (App Router), React 19, Vanilla CSS Modules (to maintain highly isolated, premium and modular styling across dynamic pages).
*   **Backend & DB Layer:** Supabase (PostgreSQL implementation layered with extremely tight Row-Level-Security rules locking down the APIs).
*   **Automations & Background Services:** Scheduled cleanup tasks (`/api/expire-posts`, `/api/expire-matches`) gracefully strip away old, stale requests so the active feed remains permanently healthy. Event-driven dispatchers (`/api/notify-match`, `/api/notify-interest`, `/api/notify-watchers`) write in-app notifications and send transactional email via **Resend**, respecting each user's per-category email preferences. Chat nudges (`/api/notify-message`) only fire for a message left unread past a quiet period, so an active back-and-forth never generates an email per tap — the daily `expire-matches` run dispatches them, since Vercel's Hobby plan caps the project at two cron entries.

---

## 👩‍💻 Authors & Credits

*   **Karam Kreidli** - [karam@course-mate.me](mailto:karam@course-mate.me)
*   **Mohammad Hajjiri** - [hajjiri@course-mate.me](mailto:hajjiri@course-mate.me)

> **Data Source:** Our platform relies on robust real-time course metadata retrieved from the [UoS Curriculum Scraper](https://github.com/hamoodihajjiri/uos-curriculum-scraper/).

---

## 📜 Copyright and License

This project is open-source and licensed under the **MIT License**.