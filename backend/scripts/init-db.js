import { supabaseAdmin } from '../src/config/supabase.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function initializeDatabase() {
  try {
    console.log('📚 Starting database initialization...')

    // Read SQL file
    const sqlPath = path.join(__dirname, '../sql_setup.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8')

    // Split into individual statements (simple approach)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'))

    console.log(`Found ${statements.length} SQL statements`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      try {
        console.log(`\n[${i + 1}/${statements.length}] Executing...`)
        console.log(statement.substring(0, 80) + '...')

        const { error } = await supabaseAdmin.rpc('exec_sql', { sql: statement })

        if (error) {
          console.warn('⚠️  Warning:', error.message)
        } else {
          console.log('✅ Success')
        }
      } catch (err) {
        console.error('❌ Error:', err.message)
      }
    }

    console.log('\n🎉 Database initialization complete!')
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

initializeDatabase()
