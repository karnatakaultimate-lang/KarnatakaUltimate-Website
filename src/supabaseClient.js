import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dyhsunbnozezgykdufst.supabase.co'
// The user needs to provide the actual anon key in .env.local
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
