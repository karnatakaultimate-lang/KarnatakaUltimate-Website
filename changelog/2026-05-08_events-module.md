# Events Module Update — 2026-05-08

## Changes

### `src/pages/Events.jsx`

**Search bar removed**
- Removed non-functional `<InputBase>` search bar, associated `Paper` wrapper, `SearchIcon` and `InputBase` imports. The search had no logic wired to it.

**List view now shows today's and future events only**
- Added `startOfToday` computation (today at midnight)
- Created `upcomingEvents` — a client-side filter of the full events array: `events.filter(ev => new Date(ev.start_time) >= startOfToday)`
- Calendar view is unchanged — still fetches all events so you can navigate to any month
- List view now uses `upcomingEvents` instead of the full `events` array

**Description field added to Create Event form**
- Added `description: ''` to `INITIAL_FORM`
- Added optional multiline `TextField` (3 rows) for description in the dialog
- Inserted `description: formData.description.trim() || null` into the Supabase payload
- List view cards now show a `noWrap` preview of the description if one exists

**UPI ID selection for paid events**
- Added `profile` to the `useAuth()` destructure
- Added `customUpi` state to track the freeform input independently
- When a paid event is being created:
  - Saved UPI IDs from `profile.saved_upi_ids` are shown as selectable `Chip` components
  - Selected chip gets a filled style + CheckIcon
  - Selecting a chip clears the custom text field
  - A separate freeform text field allows entering a new UPI ID
  - Typing in the freeform field deselects any chip
  - If no saved UPI IDs exist, a prompt directs users to their profile settings

### `src/pages/EventDetails.jsx`

**Description display**
- Replaced auto-generated filler text ("Training event at...") with the actual `event.description` value
- Uses `whiteSpace: pre-wrap` to preserve line breaks
- Shows "No description provided." in italic if description is null/empty

---

## Required Database Change

If the `events` table does not already have a `description` column, run this in Supabase SQL editor:

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS description TEXT;
```
