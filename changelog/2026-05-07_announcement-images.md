# Changelog — Announcement Image Support
**Session date:** 2026-05-07  
**Agent:** Claude Code (claude-sonnet-4-6)

---

## Summary
Added optional image upload to announcements and built a full detail view page at `/announcements/:id` where images are displayed. Landing page and notice board list remain image-free; images surface only when an announcement is opened.

---

## Changes

### `src/pages/AdminPanel.jsx`
- Added optional image upload field to the announcement compose form.
- Clicking the dashed upload zone opens a native file picker (JPEG, PNG, WEBP; max 5 MB guidance).
- Selected image shows an inline preview with an `×` button to remove before publishing.
- On publish: image is uploaded to Supabase Storage bucket `announcement-images` first; the returned public URL is stored in `announcements.image_url`. If no image is selected, `image_url` is stored as `null`.
- Published announcements list now shows a `📷 Has image` chip on rows that have an image attached.
- Added `resetForm()` helper to cleanly clear all form state including file input ref.

### `src/pages/AnnouncementDetail.jsx` *(new file)*
- Detail page at `/announcements/:id`.
- Fetches single announcement from Supabase by `id`.
- If `image_url` is present, renders a full-width hero image at the top of the card (max height 420px on desktop, 240px on mobile, `object-fit: cover`).
- Shows title, formatted date chip, divider, and full body text with `pre-wrap` to honour line breaks.
- Back button navigates to `/announcements`.
- Handles loading and not-found states.

### `src/App.jsx`
- Imported `AnnouncementDetail`.
- Added route `/announcements/:id` → `AnnouncementDetail`.

### `src/pages/Announcements.jsx`
- Each announcement row is now a clickable item navigating to `/announcements/:id`.
- Body text is clamped to 3 lines in the list view (full text shown in detail view).
- Animated chevron (`›`) appears on hover to signal the row is interactive.
- Shows a `📷 Photo` chip next to the date for announcements that have an image.

### `src/components/HomeAnnouncements.jsx`
- Updated click handler from `/announcements` (generic) to `/announcements/${announcement.id}` (direct link to the specific announcement).

---

## Required Supabase setup (manual — one-time)

### 1. Add `image_url` column to `announcements` table
Run in the Supabase SQL editor:
```sql
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_url TEXT;
```

### 2. Create the Storage bucket
1. Go to **Supabase Dashboard → Storage → New bucket**.
2. Name it exactly: `announcement-images`.
3. Set it to **Public** (so images can be served without auth).
4. Optionally set a file size limit (recommended: 5 MB).

Without these two steps the image upload in the admin form will fail with a storage error.
