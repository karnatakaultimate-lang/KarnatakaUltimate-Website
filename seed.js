import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env.local manually
const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');

const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Starting seed...');

  // 1. Seed Profiles (Create a dummy creator)
  const { data: profile, error: pErr } = await supabase.from('profiles').insert([
    { id: 'mock-firebase-uid-1234', username: 'kupa_admin', full_name: 'KUPA Admin', phone_number: '+919876543210' }
  ]).select().single();
  
  if (pErr && pErr.code !== '23505') console.error(pErr);
  
  const creatorId = profile ? profile.id : 'mock-firebase-uid-1234';

  // 2. Seed Events
  const { error: eErr } = await supabase.from('events').insert([
    { creator_id: creatorId, title: 'Weekend Pick-up Game', type: 'Pick-up', start_time: '2026-10-15T07:00:00Z', end_time: '2026-10-15T09:00:00Z', location: 'Cubbon Park, Bangalore', is_paid: false },
    { creator_id: creatorId, title: 'Advanced Strategy Clinic', type: 'Training', start_time: '2026-10-16T16:00:00Z', end_time: '2026-10-16T18:00:00Z', location: 'Kanteerava Stadium', is_paid: true, fee_amount: 200 },
    { creator_id: creatorId, title: 'KUPA Winter League', type: 'Tournament', start_time: '2026-11-05T08:00:00Z', end_time: '2026-11-05T18:00:00Z', location: 'Padukone-Dravid Centre', is_paid: true, fee_amount: 1500 }
  ]);
  if (eErr) console.error('Event Error', eErr);

  // 3. Seed Tasks
  const { error: tErr } = await supabase.from('tasks').insert([
    { title: 'Field Setup (Lines & Cones)', description: 'Arrive 30 mins early to set up the ultimate field.', points: 50 },
    { title: 'Match Reporter', description: 'Take photos and write a short summary of the game.', points: 100 },
    { title: 'Scorekeeper', description: 'Manage the scoreboard for the final tournament match.', points: 75 }
  ]);
  if (tErr) console.error('Task Error', tErr);

  // 4. Seed Announcements
  const { error: aErr } = await supabase.from('announcements').insert([
    { title: 'Welcome to the new KUPA Platform!', description: 'Explore events, claim tasks, and earn points.', date: new Date().toISOString() },
    { title: 'Winter League Registration Open', description: 'Early bird pricing ends next week. Secure your spot!', date: new Date().toISOString() }
  ]);
  if (aErr) console.error('Announcements Error', aErr);

  // 5. Seed Merchandise
  const { error: mErr } = await supabase.from('merchandise').insert([
    { name: 'KUPA Official Jersey - Dark', price: 850.00, image_url: '' },
    { name: 'KUPA Official Jersey - Light', price: 850.00, image_url: '' },
    { name: 'Ultrastar Disc - Custom Stamp', price: 1200.00, image_url: '' }
  ]);
  if (mErr) console.error('Merch Error', mErr);

  console.log('Seed completed.');
}

seed();
