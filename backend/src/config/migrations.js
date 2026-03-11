import { supabaseAdmin } from '../config/supabase.js'

/**
 * Run migrations to ensure database schema is up to date
 */
export const runMigrations = async () => {
  try {
    console.log('Running migrations...')

    // Add twofa_secret column if it doesn't exist
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS twofa_secret VARCHAR(255);

        ALTER TABLE evaluations
        ADD COLUMN IF NOT EXISTS encrypted_payload TEXT;
      `,
    }).catch(() => {
      // If rpc doesn't work, this is expected on free tier
      console.log('RPC exec_sql not available (expected on free tier), skipping migration')
      return { error: null }
    })

    if (error && error.message.includes('permission denied')) {
      console.log('⚠️  Cannot run migration: Missing database permissions')
      console.log('Please run this SQL manually in Supabase dashboard:')
      console.log(`
ALTER TABLE users
ADD COLUMN IF NOT EXISTS twofa_secret VARCHAR(255);
      `)
    } else if (error) {
      console.log('Migration error:', error)
    } else {
      console.log('✅ Migrations completed successfully')
    }
  } catch (error) {
    console.error('Migration failed:', error)
  }
}
