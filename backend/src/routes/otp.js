import express from 'express'
import { supabaseAdmin } from '../config/supabase.js'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

const router = express.Router()

const forbid = (res, message) => res.status(403).json({ success: false, message })

const requireSelfOrTeacherByBodyStudentId = (req, res, next) => {
  const bodyEmail = String(req.body?.studentId || '').toLowerCase()
  const tokenEmail = String(req.user?.email || '').toLowerCase()
  if (!bodyEmail) return res.status(400).json({ success: false, message: 'studentId is required' })
  if (req.user?.role === 'teacher') return next()
  if (tokenEmail && tokenEmail === bodyEmail) return next()
  return forbid(res, 'Forbidden')
}

// ========== Routes ==========
// 2FA Setup: Generate secret & QR code
// studentId ใช้เก็บ "email" ของทั้งนักศึกษาและอาจารย์ (admin)
router.post('/otp/2fa-setup', requireSelfOrTeacherByBodyStudentId, async (req, res) => {
  try {
    const { studentId } = req.body
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'studentId is required' })
    }

    const email = studentId.toLowerCase()

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `CyberSecurityApp (${email})`,
      length: 20,
    })

    // Generate QR code (otpauth url)
    const otpauthUrl = secret.otpauth_url
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl)

    // Save secret to DB
    // 1) ลองบันทึกที่ตาราง users ก่อน (สำหรับนักศึกษา)
    const { data: userUpdateData, error: userUpdateError } = await supabaseAdmin
      .from('users')
      .update({ twofa_secret: secret.base32 })
      .eq('email', email)
      .select('id')

    if ((userUpdateError || !userUpdateData || userUpdateData.length === 0)) {
      // 2) ถ้าไม่พบใน users ให้ลองบันทึกที่ตาราง admin (สำหรับอาจารย์/admin)
      const { error: adminUpdateError } = await supabaseAdmin
        .from('admin')
        .update({ twofa_secret: secret.base32 })
        .eq('email', email)

      if (adminUpdateError) {
        console.error('Error saving 2FA secret (admin):', adminUpdateError)
      }
    }

    console.log('2FA Setup: Secret generated for email:', email)

    res.json({
      success: true,
      qr: qrDataUrl,
      secret: secret.base32,
      otpauthUrl,
    })
  } catch (error) {
    console.error('2FA setup error:', error)
    res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to generate 2FA QR' })
  }
})

// 2FA Verify: Verify TOTP code
router.post('/otp/2fa-verify', requireSelfOrTeacherByBodyStudentId, async (req, res) => {
  try {
    const { studentId, totp } = req.body // studentId is actually email
    if (!studentId || !totp) {
      return res
        .status(400)
        .json({ success: false, message: 'studentId and totp are required' })
    }

    const email = studentId.toLowerCase()

    // Get twofa_secret from DB - search users first
    let secretRecord = null

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('twofa_secret')
      .eq('email', email)
      .single()

    if (!userError && user && user.twofa_secret) {
      secretRecord = user
    } else {
      // Fallback ไปตาราง admin (สำหรับอาจารย์/admin)
      const { data: adminRow, error: adminError } = await supabaseAdmin
        .from('admin')
        .select('twofa_secret')
        .eq('email', email)
        .single()

      if (!adminError && adminRow && adminRow.twofa_secret) {
        secretRecord = adminRow
      }
    }

    console.log('2FA Verify Query:', { email, hasSecret: !!secretRecord })

    if (!secretRecord || !secretRecord.twofa_secret) {
      return res.status(401).json({ success: false, message: 'User 2FA not set up yet' })
    }

    // Verify TOTP
    const isValid = speakeasy.totp.verify({
      secret: secretRecord.twofa_secret,
      encoding: 'base32',
      token: totp,
      window: 2, // allow 2 time windows
    })

    console.log('TOTP Verify Result:', { email, isValid, token: totp })

    if (isValid) {
      res.json({ success: true, message: 'TOTP verified successfully' })
    } else {
      res.status(401).json({ success: false, message: 'Invalid TOTP code' })
    }
  } catch (error) {
    console.error('TOTP verify error:', error)
    res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to verify TOTP' })
  }
})

export default router
