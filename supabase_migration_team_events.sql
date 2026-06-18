-- Migration: Team Events (attendance mode, event hosting, team RSVPs)
-- Run manually in the Supabase SQL editor against the live database.
-- Safe to run once; re-running will error on the already-added columns/table.

-- 1. Events: attendance mode (who can RSVP) + hosting team (who's organizing)
ALTER TABLE events
  ADD COLUMN attendance_mode TEXT NOT NULL DEFAULT 'individual'
    CHECK (attendance_mode IN ('individual', 'team'));

ALTER TABLE events
  ADD COLUMN hosting_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Only Training/Tournament events may use 'team' attendance mode
ALTER TABLE events
  ADD CONSTRAINT events_team_mode_requires_type
  CHECK (attendance_mode = 'individual' OR type IN ('Training', 'Tournament'));

-- 2. Team RSVPs (one row per team participating in a 'team' attendance_mode event)
CREATE TABLE event_team_attendees (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  rsvp_by VARCHAR REFERENCES profiles(id),
  payment_reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (event_id, team_id)
);

ALTER TABLE event_team_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team attendees are viewable by everyone." ON event_team_attendees FOR SELECT USING (true);
CREATE POLICY "Team captains can RSVP their team." ON event_team_attendees FOR INSERT WITH CHECK (true);
CREATE POLICY "Moderators can update team RSVP status." ON event_team_attendees FOR UPDATE USING (true);
CREATE POLICY "Team captains can withdraw their team's RSVP." ON event_team_attendees FOR DELETE USING (true);
