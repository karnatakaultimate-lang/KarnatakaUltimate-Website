# Changelog — Admin User Management
**Session date:** 2026-05-08
**Agent:** Claude Code (claude-sonnet-4-6)

---

## Summary
Added a User Management section to the Admin Panel. Admins can now search all registered users and grant or revoke admin access directly from within the app — no more manual SQL queries.

---

## Changes

### `src/pages/AdminPanel.jsx`
- Added **User Management** card between Module Toggles and Announcements.
- Fetches all rows from `profiles` (columns: `id`, `full_name`, `username`, `membership_status`, `is_admin`) on panel load.
- **Search field** — filters the list client-side by `full_name` or `username` as you type. Includes a clear (`×`) button.
- **Per-user admin toggle** — a Switch on each row toggles `is_admin` true/false via a Supabase `UPDATE`. The change is reflected in local state immediately on success without a full refetch.
- Avatar turns **amber/warning** for users who are admins, making them visually distinct at a glance.
- **Admin chip** (shield icon) appears inline next to the name of any admin.
- **"You" chip** appears next to your own row. Your own toggle is disabled — an admin cannot accidentally revoke their own access.
- Membership status chip (Active / Expiring Soon / Expired / Pending) shown per user for quick context.
- A footer count shows total registered users.
- Errors surface in an inline Alert without disrupting the rest of the panel.

---

## Required Supabase setup
The `is_admin` column must exist on the `profiles` table (added in a prior session):
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
```
No additional schema changes are required for this feature.
