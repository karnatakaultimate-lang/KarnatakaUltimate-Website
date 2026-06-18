-- KUPA Database Schema Definition
-- Based on the KUPA Web Platform PRD (Modified for Firebase Auth)

-- Drop existing tables to allow for clean re-runs
DROP TABLE IF EXISTS event_team_attendees CASCADE;
DROP TABLE IF EXISTS event_attendees CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS site_config CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS merchandise CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Profiles Table (Linked to Firebase Auth)
CREATE TABLE profiles (
  id VARCHAR PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  membership_status TEXT DEFAULT 'Active' CHECK (membership_status IN ('Active', 'Expiring Soon', 'Expired', 'Pending Approval')),
  membership_expiry TIMESTAMP WITH TIME ZONE,
  reward_points_total INTEGER DEFAULT 0,
  saved_upi_ids TEXT[] DEFAULT '{}',
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Events Table
-- NOTE: hosting_team_id references teams(id). The `teams` / `team_members` /
-- `team_join_requests` tables already exist in the live database but are not
-- yet documented in this file (pre-existing gap). A clean re-run of this
-- script will fail on the hosting_team_id FK until that's addressed.
CREATE TABLE events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  creator_id VARCHAR REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Pick-up', 'Training', 'Tournament', 'Other')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_public BOOLEAN DEFAULT true,
  is_open BOOLEAN DEFAULT true,
  location TEXT,
  is_paid BOOLEAN DEFAULT false,
  fee_amount DECIMAL(10, 2) DEFAULT 0.00,
  event_upi_ids TEXT[] DEFAULT '{}',
  -- 'individual': anyone RSVPs for themselves. 'team': whole teams RSVP via event_team_attendees.
  -- Only Training/Tournament events may use 'team' mode.
  attendance_mode TEXT NOT NULL DEFAULT 'individual' CHECK (attendance_mode IN ('individual', 'team')),
  CONSTRAINT events_team_mode_requires_type CHECK (attendance_mode = 'individual' OR type IN ('Training', 'Tournament')),
  -- Optional: the team organizing/hosting this event (independent of attendance_mode).
  hosting_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 3. Event Attendees Table
CREATE TABLE event_attendees (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  payment_reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (event_id, user_id)
);

-- Enable RLS for event_attendees
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

-- 3b. Event Team Attendees Table (team-level RSVPs for attendance_mode = 'team' events)
CREATE TABLE event_team_attendees (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  rsvp_by VARCHAR REFERENCES profiles(id),
  payment_reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  PRIMARY KEY (event_id, team_id)
);

-- Enable RLS for event_team_attendees
ALTER TABLE event_team_attendees ENABLE ROW LEVEL SECURITY;

-- 4. Tasks Table
CREATE TABLE tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'claimed', 'completed', 'approved')),
  assigned_to VARCHAR REFERENCES profiles(id),
  proof_text TEXT,
  approved_by VARCHAR REFERENCES profiles(id),
  deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 5. Notifications Table
CREATE TABLE notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id VARCHAR REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 6. Site Config Table
CREATE TABLE site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT
);

-- Enable RLS for site_config
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

-- 7. Announcements Table
CREATE TABLE announcements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 8. Merchandise Table
CREATE TABLE merchandise (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  in_stock BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for merchandise
ALTER TABLE merchandise ENABLE ROW LEVEL SECURITY;


-- Basic Policies (To be tightened for production)
-- Profiles: Prototype allows full public access.
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (true);

-- Events: Prototype allows full public access.
CREATE POLICY "Public events are viewable by everyone." ON events FOR SELECT USING (true);
CREATE POLICY "Users can create events." ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own events." ON events FOR UPDATE USING (true);
CREATE POLICY "Users can delete own events." ON events FOR DELETE USING (true);

-- Event Attendees: Prototype allows full public access.
CREATE POLICY "Attendees are viewable by everyone." ON event_attendees FOR SELECT USING (true);
CREATE POLICY "Users can RSVP to events." ON event_attendees FOR INSERT WITH CHECK (true);
CREATE POLICY "Creators can update attendee status." ON event_attendees FOR UPDATE USING (true);
CREATE POLICY "Users can remove their own RSVP." ON event_attendees FOR DELETE USING (true);

-- Event Team Attendees: Prototype allows full public access (auth enforced client-side).
CREATE POLICY "Team attendees are viewable by everyone." ON event_team_attendees FOR SELECT USING (true);
CREATE POLICY "Team captains can RSVP their team." ON event_team_attendees FOR INSERT WITH CHECK (true);
CREATE POLICY "Moderators can update team RSVP status." ON event_team_attendees FOR UPDATE USING (true);
CREATE POLICY "Team captains can withdraw their team's RSVP." ON event_team_attendees FOR DELETE USING (true);

-- Tasks: Prototype allows full public access.
CREATE POLICY "Public tasks are viewable by everyone." ON tasks FOR SELECT USING (true);
CREATE POLICY "Users can manage tasks." ON tasks FOR ALL USING (true);

-- Announcements: Prototype allows full public access.
CREATE POLICY "Public announcements are viewable by everyone." ON announcements FOR SELECT USING (true);
CREATE POLICY "Admins can manage announcements." ON announcements FOR ALL USING (true);

-- Merchandise: Prototype allows full public access.
CREATE POLICY "Public merchandise is viewable by everyone." ON merchandise FOR SELECT USING (true);
CREATE POLICY "Admins can manage merchandise." ON merchandise FOR ALL USING (true);

-- Notifications: Users can manage their own notifications.
CREATE POLICY "Users can view their own notifications." ON notifications FOR SELECT USING (true);
CREATE POLICY "System can insert notifications." ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can mark notifications as read." ON notifications FOR UPDATE USING (true);

-- Site Config: Anyone can read config.
CREATE POLICY "Site config is viewable by everyone." ON site_config FOR SELECT USING (true);

-- Insert Initial Mock Configuration
INSERT INTO site_config (key, value, description) VALUES
('is_store_enabled', 'true', 'Toggle for Merchandise Module'),
('is_taskboard_enabled', 'true', 'Toggle for Task Board Module');

