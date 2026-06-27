# ZLC Digital — Plan

A private practice-management app for **Zakariya Law Chambers**. You (the advocate) manage everything; your associates can sign in but only **view** what's assigned to them. One-click WhatsApp messages to associates are drafted by AI and opened in WhatsApp — no paid SMS gateway needed.

## What we'll build (v1)

1. **Auth & roles** — email/password + Google sign-in. Two roles: `admin` (you) and `associate` (read-only). First user becomes admin; you invite associates by email.
2. **Associates directory** — name, phone (E.164, for WhatsApp), email, role, notes. Admin creates/edits; associates see the list (read-only).
3. **Cases** — case number, title, court/forum, client name & phone, opposing party, assigned associate(s), status (active / closed / on-hold), next hearing date+time, stage/notes, attached documents (file upload). Search + filter by status/associate/court/date.
4. **Daily cause list / calendar** — today's hearings on the dashboard; week and month calendar views; click a hearing to open the case.
5. **To-do & reminders** — tasks with title, due date/time, priority, status. Tasks can be **standalone** or **attached to a case**. Browser notifications when due. Tasks attached to a case also show up inside that case.
6. **AI WhatsApp button** — on each case row/detail there's a WhatsApp icon per assigned associate. Click → AI drafts a short Urdu/English message ("Reminder: case [X] vs [Y], hearing on [date] at [court]. Please prepare [stage]. — ZLC") → opens `wa.me/<phone>?text=<message>` in a new tab so you tap Send. Editable before sending. No third-party SMS cost.
7. **Dashboard** — today's hearings, overdue tasks, upcoming week, recent case updates.

## Permissions

- **Admin (you)**: full CRUD on everything, invites associates, sees all cases/tasks.
- **Associate**: read-only. Sees only cases they are assigned to and tasks assigned to them. Cannot edit anything. Cannot see other associates' cases.

## Tech (non-technical summary)

- Lovable Cloud for database, login, and file storage (no external accounts).
- Lovable AI for drafting WhatsApp messages.
- WhatsApp messages use the free `wa.me` deep link — opens WhatsApp with the message pre-filled, you press send.

## Build order

1. Enable Lovable Cloud + auth (email/password + Google).
2. Database schema: `profiles`, `user_roles`, `associates`, `cases`, `case_assignments`, `hearings`, `tasks`, `documents` + RLS.
3. App shell: sidebar nav (Dashboard, Cases, Calendar, Associates, Tasks), branded "ZLC Digital", warm legal palette (deep emerald + brass on cream).
4. Dashboard with today's hearings + overdue tasks.
5. Cases: list, create/edit, detail page with hearings + tasks + documents.
6. Associates directory + assignment flow.
7. Calendar view (month/week/day).
8. Tasks: standalone + case-attached, reminders.
9. AI WhatsApp draft button + `wa.me` launcher.
10. Polish: search, filters, empty states, mobile layout.

## Design direction

Professional Pakistani legal aesthetic — deep emerald `#0F4F3F`, brass `#B8893E`, cream `#F8F4EC` background, charcoal text. Playfair Display for headings (gravitas), Inter for UI. Restrained, document-like, no SaaS gradients.

## Out of scope for v1 (can add later)

- Client login / portal
- Billing & invoicing
- Paid SMS / WhatsApp Business API automation
- Court fee / financial tracking
- Mobile push notifications (browser notifications only for now)

Shall I start with step 1 (enable Cloud + auth + schema)?
