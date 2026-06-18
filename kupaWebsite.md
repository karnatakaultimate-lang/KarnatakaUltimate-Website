# Product Requirements Document (PRD): KUPA Web Platform

**Project Name:** KUPA Digital Ecosystem  
**Client:** Karnataka Ultimate Players Association (KUPA)  
**Target Platform:** Web (Mobile-Responsive)  
**Design Language:** Material Design 3 (M3)

---

## 1. Product Vision & Goals
To create a modular, scalable, and cost-effective digital hub for the Karnataka Ultimate community. The platform centralizes membership management, event coordination, and community incentivization through a gamified volunteer reward system, while decentralizing event fee collection.

---

## 2. Technology Stack & Infrastructure
*   **Hosting:** Firebase Hosting (Optimized for fast global content delivery and cost-efficiency).
*   **Database:** Supabase (PostgreSQL). Chosen for its robust relational data modeling, essential for linking users, memberships, events, and ledgers.
*   **Authentication:** Supabase Auth (Email/Password + Google OAuth).
*   **Frontend Framework:** React.js or Vue.js.
*   **UI Library:** Material UI (MUI) or Vuetify (for strict Material Design compliance).
*   **Backend / Admin API:** Node.js serverless functions via Supabase Edge Functions.

---

## 3. System Architecture & Modularity
### 3.1 Component-Based Design
Every major feature (Store, Calendar, Task Board) is built as an isolated module to ensure stability and independent scaling.

### 3.2 Configuration Registry (Feature Toggles)
*   **Mechanism:** A `site_config` table in the database acts as a master switchboard (`is_store_enabled`, `is_taskboard_enabled`).
*   **Behavior:** The frontend fetches this configuration on initialization. If a module is toggled off by an Admin, its navigation links are hidden, and direct URL access redirects to a "Maintenance" or "Coming Soon" page. No code redeployment is necessary to toggle features.

---

## 4. User Roles & Permissions (RBAC)
| Role | Permissions |
| :--- | :--- |
| **Guest** | View Landing Page, view Public events. No interactive privileges. |
| **Account Holder** | Access 'My KUPA', create events, RSVP, claim tasks, earn points. |
| **Active Member** | Account Holder permissions + specific "Active" badge, priority access, or member-only event privileges. |
| **Global Admin** | Access Admin API, override/delete any event, validate tasks, approve memberships, and toggle site modules. |

---

## 5. Detailed Module Specifications

### Module A: Authentication & Onboarding
*   **Forced Account Creation:** All interactive features require a verified account to maintain database integrity.
*   **Deferred RSVP Flow:** If an unauthenticated user clicks a shareable event link:
    1. They see an event "Preview".
    2. Clicking "RSVP" redirects them to Login/Signup.
    3. Post-authentication, the system remembers their intent and redirects them back to the event page to finalize the RSVP.

### Module B: 'My KUPA' (Account & Membership Dashboard)
*   **Profile Management:** Update personal details, contact info, and manage saved UPI IDs.
*   **Membership Lifecycle:**
    *   **Type:** Manual Annual Renewals.
    *   **Status Indicators:** `Active` (Green), `Expiring Soon` (Yellow - within 30 days of expiry), `Expired` (Red), `Pending Approval`.
    *   **Workflow:** User clicks "Renew" in their dashboard. Admin manually verifies payment offline and updates the status via the Admin dashboard.
*   **Reward Points Ledger:** A transaction history showing points earned from the Task Board, date of approval, and total balance.
*   **Notification Center:** An in-app "Bell" icon fed by a database ledger (alerts for Invites, Task Status, Membership).
*   **Event History:** Archive of all past events attended or hosted.

### Module C: Public Calendar & Event Management
*   **Event Creation:** Any account holder can create `Pick-up`, `Training`, `Tournament`, or `Other` events.
*   **Visibility & Access Matrix:**
    *   **Visibility:** `Public` (shows on main calendar) OR `Private` (hidden, accessible only via UUID link).
    *   **Access:** `Open` (instant RSVP confirmation) OR `Invite-Only` (requires creator approval).
*   **Financials & UPI Integration:**
    *   **Type:** `Free` or `Paid`.
    *   **UPI IDs:** Event creators can save up to 5 personal UPI IDs to their profile. When creating a `Paid` event, they select which UPI IDs to display.
*   **RSVP Workflow:**
    *   **Free/Open:** User clicks RSVP; added to attendee list instantly.
    *   **Paid:** User clicks RSVP; UI displays the event fee and creator's UPI IDs with a "Copy" button. User enters the UPI Transaction Reference Number (or uploads a screenshot) and submits. Status becomes `Pending`. The Event Creator verifies the payment and manually changes status to `Confirmed`.
*   **Invitations:**
    *   **Internal:** Autocomplete search of the KUPA database to invite members directly.
    *   **External:** Unique `navigator.share()` API compatible UUID links.
*   **Archiving:** Automated real-time archiving. Once `end_time` passes, events lose RSVP functionality and move to historical views.

### Module D: Task Board & Reward System
*   **Admin Backend:** Admins draft volunteer tasks (e.g., "Field Setup", "Match Report") with defined point values and deadlines.
*   **User Flow:** Members browse the board and click "Claim" on an available task.
*   **Validation Flow:** User submits proof of completion (text note/photo). Admin reviews the queue and clicks "Approve." The database automatically increments the user's `reward_points_total`.

### Module E: Merchandise Showcase (Pre-Store)
*   **Objective:** Visual catalog for KUPA gear.
*   **Features:** Product grid, detail pages showing sizes, colors, and descriptions.
*   **Current State:** Non-transactional. Acts as a showcase or "Register Interest" board until full payment gateways are implemented in later phases.

---

## 6. Database Schema (Supabase Core Tables)
*   `profiles`: `id`, `username`, `membership_status`, `membership_expiry`, `reward_points_total`, `saved_upi_ids` (Array).
*   `events`: `id`, `creator_id`, `title`, `type`, `start_time`, `end_time`, `is_public`, `is_open`, `location`, `is_paid` (Boolean), `fee_amount`, `event_upi_ids` (Array).
*   `event_attendees`: `event_id`, `user_id`, `status` (`pending`, `confirmed`, `declined`), `payment_reference_id` (String).
*   `tasks`: `id`, `title`, `description`, `points`, `status` (`available`, `claimed`, `completed`).
*   `notifications`: `user_id`, `message`, `link_url`, `is_read`, `created_at`.
*   `site_config`: `key`, `value` (Boolean/String).

---

## 7. Admin API Specifications
Protected endpoints built via Supabase Edge Functions:
*   `POST /admin/validate-task`: Approves task completion and triggers point increment.
*   `PATCH /admin/update-membership`: Updates user membership status based on manual renewal verification.
*   `PATCH /admin/toggle-module`: Updates `site_config` to show/hide frontend modules.
*   `DELETE /admin/event-override`: Allows Global Admins to moderate, edit, or delete any community-created event.

---

## 8. UI/UX Guidelines
*   **Theme:** Strict Material Design compliance. Primary/Secondary colors mapped to KUPA branding.
*   **Components:** Utilize MUI/Vuetify pre-built Data Grids, Steppers (for event creation), Dialogs (for RSVPs), and Avatars (for attendee lists).
*   **Responsiveness:** Mobile-first design priority, ensuring the Calendar, Task Board, and RSVP flows are fully functional on smartphone screens.

---

## 9. Future Scope (Phase 2+)
*   Integration of an automated Payment Gateway (Razorpay/Stripe) for direct KUPA membership renewals and Merchandise purchases.
*   Live Tournament Scoring module linked directly to Calendar events.
*   Automated email/WhatsApp notifications via third-party APIs.