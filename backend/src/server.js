import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { supabaseClient, supabaseAdmin } from './config/supabase.js'
import dashboardRoutes from './routes/dashboard.js'
import otpRoutes from './routes/otp.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'auth_token'
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || (process.env.NODE_ENV === 'production'))
  .toLowerCase() === 'true'
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax')

const MS_TENANT_ID = process.env.MS_TENANT_ID
const MS_CLIENT_ID = process.env.MS_CLIENT_ID
const MS_ALLOWED_DOMAINS = (process.env.MS_ALLOWED_DOMAINS || 'kmutt.ac.th,mail.kmutt.ac.th')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean)

const getMicrosoftIssuer = (tenantId) => `https://login.microsoftonline.com/${tenantId}/v2.0`
const getMicrosoftJwks = (tenantId) =>
  createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`))

const getEmailFromMicrosoftPayload = (payload) => {
  const v =
    payload?.preferred_username ||
    payload?.upn ||
    payload?.email ||
    payload?.unique_name
  return typeof v === 'string' ? v : null
}

const parseNameFromMicrosoftPayload = (payload) => {
  const given = typeof payload?.given_name === 'string' ? payload.given_name.trim() : ''
  const family = typeof payload?.family_name === 'string' ? payload.family_name.trim() : ''
  if (given || family) {
    return { first_name: given || null, last_name: family || null }
  }

  const full = typeof payload?.name === 'string' ? payload.name.trim() : ''
  if (!full) return { first_name: null, last_name: null }

  // Best-effort split: first token as first_name, rest as last_name
  const parts = full.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { first_name: parts[0], last_name: null }
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') || null }
}

// Helper: ตรวจว่ารหัสใน DB เป็น bcrypt hash หรือไม่
const isBcryptHash = value =>
  typeof value === 'string' &&
  (value.startsWith('$2a$') || value.startsWith('$2b$') || value.startsWith('$2y$'))

// Middleware
app.use(helmet())

const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, cb) {
      // Dev/preview: allow all origins for easier testing
      if (process.env.NODE_ENV !== 'production') {
        return cb(null, true)
      }

      // Production: strict allowlist
      if (!origin) return cb(null, true)
      if (FRONTEND_ORIGINS.includes(origin)) return cb(null, true)
      return cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
  })
)
app.use(express.json())
app.use(cookieParser())

// Rate limiting
const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({ success: false, error: 'Too many requests' })
  },
  skip(req) {
    // don't rate-limit session check/health in any env
    return req.path === '/auth/me' || req.path === '/health'
  },
})

const authLimiter =
  process.env.NODE_ENV === 'production'
    ? rateLimit({
        windowMs: 60 * 1000,
        limit: 20,
        standardHeaders: true,
        legacyHeaders: false,
        handler(req, res) {
          res.status(429).json({ success: false, error: 'Too many auth requests' })
        },
      })
    : (req, res, next) => next()

// Apply general limiter for all API routes
app.use('/api', generalApiLimiter)

// Force HTTPS in production (behind proxy)
if (process.env.NODE_ENV === 'production') {
  app.enable('trust proxy')
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      return next()
    }
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`)
  })
}

// Auth middleware for protected routes
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || ''
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME] || null
  const token = headerToken || cookieToken

  if (!token) {
    return res.status(401).json({ success: false, error: 'Missing authorization token' })
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    return next()
  } catch (err) {
    console.error('JWT verify error:', err)
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  })
}

const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: '/',
  })
}

// Test route
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' })
})

// Auth: Me (cookie-based session check)
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user })
})

// Auth: Logout (clear cookie)
app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res)
  res.json({ success: true })
})

const ALLOW_PASSWORD_LOGIN = String(process.env.ALLOW_PASSWORD_LOGIN || 'false').toLowerCase() === 'true'

// Auth: Login (disabled by default; use Microsoft SSO instead)
app.post('/api/auth/login', async (req, res) => {
  if (!ALLOW_PASSWORD_LOGIN) {
    return res.status(404).json({ success: false, error: 'Password login disabled' })
  }
  try {
    const { email, password } = req.body

    console.log('Login attempt:', { email })

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required',
      })
    }

    // 1) Try admin login first
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('admin')
      .select('*')
      .eq('email', email.toLowerCase())
      .single()

    if (admin && !adminError) {
      // รองรับทั้งกรณี password ถูก hash ด้วย bcrypt แล้ว และกรณีเก่าที่เป็น plain text
      const stored = admin.password ?? ''
      let passwordMatch = false

      if (isBcryptHash(stored)) {
        passwordMatch = await bcrypt.compare(String(password), stored)
      } else {
        passwordMatch = String(stored) === String(password)
      }

      if (!passwordMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
        })
      }

      console.log('Teacher login successful for:', admin.email)

      const token = jwt.sign(
        {
          sub: `teacher-${admin.id}`,
          role: 'teacher',
          email: admin.email,
          teacher_id: admin.teacher_id,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      return res.json({
        success: true,
        token,
        user: {
          role: 'teacher',
          email: admin.email,
          teacher_id: admin.teacher_id,
        },
      })
    }

    // 2) Fallback to normal users table by email
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())

    console.log('Query result:', { data, error })

    if (error) {
      console.error('Database error:', error)
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      })
    }

    if (!data || data.length === 0) {
      console.log('No user found with email:', email)
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      })
    }

    const user = data[0]
    console.log('User found:', { id: user.id, email: user.email })

    const stored = user.password ?? ''
    let passwordMatch = false

    if (isBcryptHash(stored)) {
      passwordMatch = await bcrypt.compare(String(password), stored)
    } else {
      passwordMatch = String(stored) === String(password)
    }

    if (!passwordMatch) {
      console.log('Password mismatch')
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      })
    }

    console.log('Login successful for:', user.student_id)

    const token = jwt.sign(
      {
        sub: user.id,
        role: 'student',
        email: user.email,
        student_id: user.student_id,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        student_id: user.student_id,
        first_name: user.first_name,
        last_name: user.last_name,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(401).json({
      success: false,
      error: error.message || 'Login failed',
    })
  }
})

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
  if (!ALLOW_PASSWORD_LOGIN) {
    return res.status(404).json({ success: false, error: 'Password registration disabled' })
  }
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required',
      })
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseClient
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered',
      })
    }

    // Hash password ก่อนเก็บ
    const passwordHash = await bcrypt.hash(String(password), 10)

    // Insert new user
    const { data, error } = await supabaseClient
      .from('users')
      .insert([{ email, password: passwordHash }])
      .select()
      .single()

    if (error) throw error

    res.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: data.id,
        email: data.email,
      },
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message || 'Registration failed',
    })
  }
})

// Auth: Microsoft (OIDC) -> Issue our own JWT
app.post('/api/auth/microsoft', authLimiter, async (req, res) => {
  try {
    const { id_token } = req.body || {}

    if (!MS_TENANT_ID || !MS_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        error: 'Microsoft auth not configured (MS_TENANT_ID/MS_CLIENT_ID missing)',
      })
    }

    if (!id_token || typeof id_token !== 'string') {
      return res.status(400).json({ success: false, error: 'id_token is required' })
    }

    const issuer = getMicrosoftIssuer(MS_TENANT_ID)
    const jwks = getMicrosoftJwks(MS_TENANT_ID)

    const { payload } = await jwtVerify(id_token, jwks, {
      issuer,
      audience: MS_CLIENT_ID,
    })

    const email = getEmailFromMicrosoftPayload(payload)?.toLowerCase()
    if (!email) {
      return res.status(401).json({ success: false, error: 'Microsoft token missing email' })
    }

    const domain = email.split('@')[1] || ''
    if (!MS_ALLOWED_DOMAINS.includes(domain.toLowerCase())) {
      return res.status(403).json({ success: false, error: 'Email domain not allowed' })
    }

    // Map to our app roles by existing records
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('admin')
      // admin table schema may vary; keep this minimal to avoid "column does not exist"
      .select('id,email,teacher_id')
      .eq('email', email)
      .single()

    if (admin && !adminError) {
      const token = jwt.sign(
        {
          sub: `teacher-${admin.id}`,
          role: 'teacher',
          email: admin.email,
          teacher_id: admin.teacher_id ?? null,
          idp: 'microsoft',
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      setAuthCookie(res, token)
      return res.json({
        success: true,
        // token is also stored in httpOnly cookie; returning it is optional
        token,
        user: {
          role: 'teacher',
          email: admin.email,
          teacher_id: admin.teacher_id ?? null,
        },
      })
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id,email,student_id,first_name,last_name')
      .eq('email', email)
      .single()

    let resolvedUser = user
    let resolvedUserError = userError
    // If first_name/last_name columns don't exist yet, retry with minimal select.
    if (resolvedUserError) {
      const msg = String(resolvedUserError.message || '')
      if (msg.includes('first_name') || msg.includes('last_name') || msg.includes('column')) {
        const { data: minimalUser, error: minimalError } = await supabaseAdmin
          .from('users')
          .select('id,email,student_id')
          .eq('email', email)
          .single()
        resolvedUser = minimalUser
        resolvedUserError = minimalError
      }
    }

    if (resolvedUserError || !resolvedUser) {
      return res.status(403).json({
        success: false,
        error: 'User not registered in system',
        email,
      })
    }

    // If DB name fields are missing, populate them from Microsoft token (best-effort)
    try {
      const currentFirst = typeof resolvedUser.first_name === 'string' ? resolvedUser.first_name.trim() : ''
      const currentLast = typeof resolvedUser.last_name === 'string' ? resolvedUser.last_name.trim() : ''
      const needsUpdate = !currentFirst || !currentLast

      if (needsUpdate) {
        const parsed = parseNameFromMicrosoftPayload(payload)
        const nextFirst = currentFirst || parsed.first_name
        const nextLast = currentLast || parsed.last_name

        const updatePayload = {}
        if (!currentFirst && nextFirst) updatePayload.first_name = nextFirst
        if (!currentLast && nextLast) updatePayload.last_name = nextLast

        if (Object.keys(updatePayload).length) {
          const { data: updatedRow, error: updateError } = await supabaseAdmin
            .from('users')
            .update(updatePayload)
            .eq('id', resolvedUser.id)
            .select('first_name,last_name')
            .single()

          if (!updateError && updatedRow) {
            resolvedUser = {
              ...resolvedUser,
              first_name: updatedRow.first_name ?? resolvedUser.first_name ?? null,
              last_name: updatedRow.last_name ?? resolvedUser.last_name ?? null,
            }
          }
        }
      }
    } catch (e) {
      // best-effort; do not block login if schema/permissions differ
      console.warn('Microsoft login: failed to sync name fields:', e?.message || e)
    }

    const token = jwt.sign(
      {
        sub: resolvedUser.id,
        role: 'student',
        email: resolvedUser.email,
        student_id: resolvedUser.student_id,
        idp: 'microsoft',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    setAuthCookie(res, token)
    return res.json({
      success: true,
      token,
      user: {
        id: resolvedUser.id,
        role: 'student',
        email: resolvedUser.email,
        student_id: resolvedUser.student_id,
        first_name: resolvedUser.first_name ?? null,
        last_name: resolvedUser.last_name ?? null,
      },
    })
  } catch (error) {
    console.error('Microsoft login error:', error)
    return res.status(401).json({
      success: false,
      error: 'Microsoft login failed',
    })
  }
})

// Example: Get all data from table (protected)
app.get('/api/data', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseClient
      .from('your_table_name')
      .select('*')

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// Example: Create data (protected)
app.post('/api/data', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseClient
      .from('your_table_name')
      .insert([req.body])
      .select()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// Example: Update data (protected)
app.put('/api/data/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { data, error } = await supabaseClient
      .from('your_table_name')
      .update(req.body)
      .eq('id', id)
      .select()

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// Example: Delete data (protected)
app.delete('/api/data/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { error } = await supabaseClient
      .from('your_table_name')
      .delete()
      .eq('id', id)

    if (error) throw error

    res.json({ success: true, message: 'Deleted successfully' })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// Dashboard Routes (protected with JWT)
app.use('/api', authMiddleware, dashboardRoutes)

// OTP Routes (protectedด้วย JWT เช่นกัน)
app.use('/api', authMiddleware, otpRoutes)

app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`)
})
