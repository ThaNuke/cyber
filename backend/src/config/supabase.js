import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

// Client สำหรับ user queries
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

// Client สำหรับ server-side operations (มี full access)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
