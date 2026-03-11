import express from 'express'
import crypto from 'crypto'
import { supabaseAdmin, supabaseClient } from '../config/supabase.js'

const router = express.Router()

const forbid = (res, message) => res.status(403).json({ success: false, error: message })

const EVAL_ENCRYPTION_KEY_B64 = process.env.EVAL_ENCRYPTION_KEY || ''
const getEvalKey = () => {
  if (!EVAL_ENCRYPTION_KEY_B64) return null
  try {
    const key = Buffer.from(EVAL_ENCRYPTION_KEY_B64, 'base64')
    if (key.length !== 32) return null // AES-256
    return key
  } catch {
    return null
  }
}

const encryptJson = (obj) => {
  const key = getEvalKey()
  if (!key) {
    throw new Error('EVAL_ENCRYPTION_KEY not configured (must be 32-byte base64)')
  }
  const iv = crypto.randomBytes(12) // GCM recommended 12 bytes
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(obj), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  // v1:<iv_b64>:<tag_b64>:<cipher_b64>
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`
}

const decryptJson = (payload) => {
  const key = getEvalKey()
  if (!key) {
    throw new Error('EVAL_ENCRYPTION_KEY not configured (must be 32-byte base64)')
  }
  if (!payload || typeof payload !== 'string') return null
  const [v, ivB64, tagB64, ctB64] = payload.split(':')
  if (v !== 'v1' || !ivB64 || !tagB64 || !ctB64) return null
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ct = Buffer.from(ctB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return JSON.parse(pt.toString('utf8'))
}

const SCORE_FIELDS = Array.from({ length: 18 }, (_, i) => `score_q${i + 1}`)

const extractScoresFromDecrypted = (decrypted) => {
  const scores = {}
  const src = decrypted?.scores && typeof decrypted.scores === 'object' ? decrypted.scores : null
  SCORE_FIELDS.forEach(f => {
    const v = src ? src[f] : null
    scores[f] = typeof v === 'number' ? v : null
  })
  return scores
}

const requireTeacher = (req, res, next) => {
  if (req.user?.role === 'teacher') return next()
  return forbid(res, 'Teacher access required')
}

const requireSelfOrTeacherByEmailParam = (req, res, next) => {
  const paramEmail = String(req.params.email || '').toLowerCase()
  const tokenEmail = String(req.user?.email || '').toLowerCase()
  if (!paramEmail) return res.status(400).json({ success: false, error: 'email is required' })
  if (req.user?.role === 'teacher') return next()
  if (tokenEmail && tokenEmail === paramEmail) return next()
  return forbid(res, 'Forbidden')
}

// ==================== SUBJECTS ====================

// Get all subjects for a specific semester and year
router.get('/subjects', async (req, res) => {
  try {
    const { semester, academic_year } = req.query

    let query = supabaseClient.from('subjects').select('*')

    if (semester) {
      query = query.eq('semester', parseInt(semester))
    }

    if (academic_year) {
      query = query.eq('academic_year', parseInt(academic_year))
    }

    const { data, error } = await query

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching subjects:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

// Get subject by ID with instructors
router.get('/subjects/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Get subject
    const { data: subject, error: subjectError } = await supabaseClient
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single()

    if (subjectError) throw subjectError

    // Get instructors for this subject
    const { data: instructors, error: instructorError } = await supabaseClient
      .from('subject_instructors')
      .select(
        `
        instructors (
          id,
          instructor_name_th,
          instructor_name_en,
          email,
          department
        )
      `
      )
      .eq('subject_id', id)

    if (instructorError) throw instructorError

    res.json({
      success: true,
      data: {
        ...subject,
        instructors: instructors.map(si => si.instructors),
      },
    })
  } catch (error) {
    console.error('Error fetching subject:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

// ==================== ENROLLMENTS ====================

// Get enrolled subjects for a student
router.get('/enrollments/:email', requireSelfOrTeacherByEmailParam, async (req, res) => {
  try {
    const { email } = req.params
    const { semester, academic_year } = req.query

    // First, get the user ID from email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (userError) throw userError

    let query = supabaseClient
      .from('enrollments')
      .select(
        `
        *,
        subjects (
          id,
          subject_code,
          subject_name_th,
          subject_name_en,
          credits
        )
      `
      )
      .eq('student_id', user.id)

    if (semester) {
      query = query.eq('semester', parseInt(semester))
    }

    if (academic_year) {
      query = query.eq('academic_year', parseInt(academic_year))
    }

    const { data, error } = await query

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching enrollments:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

// Get enrolled subjects with instructors
router.get(
  '/enrollments/:email/with-instructors',
  requireSelfOrTeacherByEmailParam,
  async (req, res) => {
  try {
    const { email } = req.params
    const { semester, academic_year } = req.query

    // Get user ID from email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (userError) throw userError

    // Get enrollments
    let query = supabaseClient
      .from('enrollments')
      .select(
        `
        *,
        subjects (
          id,
          subject_code,
          subject_name_th,
          subject_name_en,
          credits
        )
      `
      )
      .eq('student_id', user.id)

    if (semester) {
      query = query.eq('semester', parseInt(semester))
    }

    if (academic_year) {
      query = query.eq('academic_year', parseInt(academic_year))
    }

    const { data: enrollments, error: enrollError } = await query

    if (enrollError) throw enrollError

    // Get instructors for each subject
    const enrollmentsWithInstructors = await Promise.all(
      enrollments.map(async enrollment => {
        const { data: instructors, error } = await supabaseClient
          .from('subject_instructors')
          .select(`
            instructors (
              id,
              instructor_name_th,
              instructor_name_en,
              email
            )
          `)
          .eq('subject_id', enrollment.subject_id)

        if (error) throw error

        return {
          ...enrollment,
          instructors: instructors.map(si => si.instructors),
        }
      })
    )

    res.json({ success: true, data: enrollmentsWithInstructors })
  } catch (error) {
    console.error('Error fetching enrollments with instructors:', error)
    res.status(400).json({ success: false, error: error.message })
  }
  }
)

// ==================== EVALUATIONS ====================

// Get evaluation status for a student's subjects
router.get('/evaluations/:email/status', requireSelfOrTeacherByEmailParam, async (req, res) => {
  try {
    const { email } = req.params
    const { semester, academic_year } = req.query

    // Get user ID from email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (userError) throw userError

    let query = supabaseClient
      .from('evaluations')
      .select(
        `
        id,
        instructor_id,
        subject_id,
        status,
        submitted_at,
        subjects (
          subject_code,
          subject_name_th
        ),
        instructors (
          instructor_name_th
        )
      `
      )
      .eq('student_id', user.id)

    if (semester) {
      query = query.eq('semester', parseInt(semester))
    }

    if (academic_year) {
      query = query.eq('academic_year', parseInt(academic_year))
    }

    const { data, error } = await query

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching evaluation status:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

// Submit evaluation
router.post('/evaluations', async (req, res) => {
  try {
    const { student_id, instructor_id, subject_id, semester, academic_year, ...evaluationData } = req.body

    const tokenEmail = String(req.user?.email || '').toLowerCase()
    const bodyEmail = String(student_id || '').toLowerCase()
    if (!bodyEmail) {
      return res.status(400).json({ success: false, error: 'student_id is required' })
    }
    if (req.user?.role !== 'teacher' && tokenEmail !== bodyEmail) {
      return forbid(res, 'Forbidden')
    }

    // Get user ID from email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', student_id.toLowerCase())
      .single()

    if (userError) throw userError

    const scores = Object.fromEntries(SCORE_FIELDS.map(f => [f, evaluationData?.[f] ?? null]))
    const commentText = typeof evaluationData?.comments === 'string' ? evaluationData.comments : ''
    const encrypted_payload = encryptJson({
      scores,
      comments: commentText,
      meta: {
        enc: 'aes-256-gcm',
        at: new Date().toISOString(),
      },
    })

    // Only persist encrypted payload at rest (avoid leaking scores via plaintext columns)
    const sanitized = { ...evaluationData }
    SCORE_FIELDS.forEach(f => {
      if (f in sanitized) delete sanitized[f]
    })
    if ('comments' in sanitized) delete sanitized.comments

    const { data, error } = await supabaseClient
      .from('evaluations')
      .upsert(
        {
          student_id: user.id,
          instructor_id,
          subject_id,
          semester,
          academic_year,
          ...sanitized,
          // do not store plaintext comment/scores; keep only encrypted copy
          comments: null,
          ...Object.fromEntries(SCORE_FIELDS.map(f => [f, null])),
          encrypted_payload,
          status: 'completed',
          submitted_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,instructor_id,subject_id,semester,academic_year' }
      )
      .select()

    if (error) throw error

    res.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('Error submitting evaluation:', error)
    const msg = String(error?.message || '')
    if (msg.includes('encrypted_payload') && msg.includes('column')) {
      return res.status(500).json({
        success: false,
        error: 'Database missing column encrypted_payload. Run: ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS encrypted_payload TEXT;',
      })
    }
    if (msg.includes('EVAL_ENCRYPTION_KEY')) {
      return res.status(500).json({ success: false, error: msg })
    }
    res.status(400).json({ success: false, error: error.message })
  }
})

// Get evaluation form for a specific instructor and subject
router.get(
  '/evaluations/:email/:instructor_id/:subject_id',
  requireSelfOrTeacherByEmailParam,
  async (req, res) => {
  try {
    const { email, instructor_id, subject_id } = req.params
    const { semester, academic_year } = req.query

    // Get user ID from email
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (userError) throw userError

    const { data, error } = await supabaseClient
      .from('evaluations')
      .select(
        `
        *,
        encrypted_payload,
        subjects (
          subject_code,
          subject_name_th,
          subject_name_en
        ),
        instructors (
          instructor_name_th,
          instructor_name_en,
          email
        )
      `
      )
      .eq('student_id', user.id)
      .eq('instructor_id', instructor_id)
      .eq('subject_id', subject_id)
      .eq('semester', parseInt(semester))
      .eq('academic_year', parseInt(academic_year))
      .single()

    if (error && error.code !== 'PGRST116') throw error

    // If evaluation doesn't exist, create template
    if (!data) {
      // Fetch subject and instructor info for display
      const [{ data: subject }, { data: instructor }] = await Promise.all([
        supabaseClient
          .from('subjects')
          .select('subject_code, subject_name_th, subject_name_en, credits')
          .eq('id', subject_id)
          .single(),
        supabaseClient
          .from('instructors')
          .select('instructor_name_th, instructor_name_en, email')
          .eq('id', instructor_id)
          .single(),
      ])

      const emptyScores = Object.fromEntries(
        Array.from({ length: 18 }, (_, i) => [`score_q${i + 1}`, null])
      )
      return res.json({
        success: true,
        data: {
          student_id: user.id,
          instructor_id,
          subject_id,
          semester: parseInt(semester),
          academic_year: parseInt(academic_year),
          status: 'pending',
          ...emptyScores,
          subjects: subject || null,
          instructors: instructor || null,
          comments: '',
        },
      })
    }

    // Decrypt scores/comments for client display
    try {
      if (data?.encrypted_payload) {
        const decrypted = decryptJson(data.encrypted_payload)
        if (decrypted && typeof decrypted === 'object') {
          if (typeof decrypted.comments === 'string') data.comments = decrypted.comments
          const s = extractScoresFromDecrypted(decrypted)
          SCORE_FIELDS.forEach(f => { data[f] = s[f] })
        }
      }
    } catch (e) {
      console.warn('Failed to decrypt evaluation payload:', e?.message || e)
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching evaluation:', error)
    res.status(400).json({ success: false, error: error.message })
  }
  }
)

// ==================== ADMIN - INSTRUCTOR REPORT ====================

router.get('/admin/instructor-report', requireTeacher, async (req, res) => {
  try {
    const { instructor_id, subject_id, semester, academic_year } = req.query

    if (!instructor_id || !subject_id || !semester || !academic_year) {
      return res.status(400).json({
        success: false,
        error: 'instructor_id, subject_id, semester, academic_year are required',
      })
    }

    const { data: evaluations, error } = await supabaseClient
      .from('evaluations')
      .select(
        `
        encrypted_payload,
        submitted_at,
        subjects (
          subject_code,
          subject_name_th,
          subject_name_en
        ),
        instructors (
          instructor_name_th,
          instructor_name_en,
          email
        )
      `
      )
      .eq('instructor_id', instructor_id)
      .eq('subject_id', subject_id)
      .eq('semester', parseInt(semester, 10))
      .eq('academic_year', parseInt(academic_year, 10))
      .eq('status', 'completed')

    if (error) throw error

    const totalResponses = evaluations?.length || 0

    const averages = SCORE_FIELDS.map(field => {
      if (!totalResponses) return null
      let sum = 0
      let count = 0
      evaluations.forEach(ev => {
        let v = null
        try {
          const decrypted = ev.encrypted_payload ? decryptJson(ev.encrypted_payload) : null
          const s = extractScoresFromDecrypted(decrypted)
          v = s[field]
        } catch {
          v = null
        }
        if (typeof v === 'number') {
          sum += v
          count += 1
        }
      })
      return count ? sum / count : null
    })

    const allScores = []
    evaluations.forEach(ev => {
      let s = null
      try {
        const decrypted = ev.encrypted_payload ? decryptJson(ev.encrypted_payload) : null
        s = extractScoresFromDecrypted(decrypted)
      } catch {
        s = null
      }
      if (s) {
        SCORE_FIELDS.forEach(field => {
          const v = s[field]
          if (typeof v === 'number') allScores.push(v)
        })
      }
    })

    const overallAverage = allScores.length
      ? allScores.reduce((acc, v) => acc + v, 0) / allScores.length
      : null

    const comments =
      evaluations
        ?.map(ev => {
          let commentText = ''
          try {
            const decrypted = ev.encrypted_payload ? decryptJson(ev.encrypted_payload) : null
            if (decrypted && typeof decrypted.comments === 'string') {
              commentText = decrypted.comments.trim()
            }
          } catch {
            commentText = ''
          }

          if (!commentText) return null
          return {
            comment: commentText,
            // hash แบบ one-way เพื่อใช้แสดงฝั่ง UI ตอนยังไม่ผ่านการยืนยันตัวตน
            hash: crypto.createHash('sha256').update(commentText).digest('hex'),
            submitted_at: ev.submitted_at,
          }
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)) || []

    const baseInfo = evaluations && evaluations[0]

    res.json({
      success: true,
      data: {
        instructor: baseInfo?.instructors || null,
        subject: baseInfo?.subjects || null,
        semester: parseInt(semester, 10),
        academic_year: parseInt(academic_year, 10),
        total_responses: totalResponses,
        overall_average: overallAverage,
        question_averages: averages,
        comments,
      },
    })
  } catch (error) {
    console.error('Error fetching admin instructor report:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

router.get('/admin/subjects', requireTeacher, async (req, res) => {
  try {
    const { instructor_id, semester, academic_year } = req.query

    if (!instructor_id) {
      return res.status(400).json({ success: false, error: 'instructor_id is required' })
    }

    const { data, error } = await supabaseClient
      .from('subject_instructors')
      .select(
        `
        subject_id,
        subjects (
          id,
          subject_code,
          subject_name_th,
          subject_name_en,
          semester,
          academic_year
        )
      `
      )
      .eq('instructor_id', instructor_id)

    if (error) throw error

    let subjects = (data || []).map(d => d.subjects).filter(Boolean)

    if (semester) {
      subjects = subjects.filter(s => String(s.semester) === String(parseInt(semester, 10)))
    }
    if (academic_year) {
      subjects = subjects.filter(s => String(s.academic_year) === String(parseInt(academic_year, 10)))
    }

    res.json({ success: true, data: subjects })
  } catch (error) {
    console.error('Error fetching admin subjects:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

// ==================== INSTRUCTORS ====================

// Get all instructors
router.get('/instructors', async (req, res) => {
  try {
    const { data, error } = await supabaseClient.from('instructors').select('*')

    if (error) throw error

    res.json({ success: true, data })
  } catch (error) {
    console.error('Error fetching instructors:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

// Get instructors for a subject
router.get('/instructors/subject/:subject_id', async (req, res) => {
  try {
    const { subject_id } = req.params

    const { data, error } = await supabaseClient
      .from('subject_instructors')
      .select(`
        instructors (
          id,
          instructor_name_th,
          instructor_name_en,
          email,
          department
        )
      `)
      .eq('subject_id', subject_id)

    if (error) throw error

    res.json({
      success: true,
      data: data.map(d => d.instructors),
    })
  } catch (error) {
    console.error('Error fetching instructors:', error)
    res.status(400).json({ success: false, error: error.message })
  }
})

export default router
