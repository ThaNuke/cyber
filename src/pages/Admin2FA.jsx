import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import './OtpVerification.css'

function Admin2FA() {
  const navigate = useNavigate()
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null')
    } catch {
      return null
    }
  }, [])

  const [qr, setQr] = useState('')
  const [totp, setTotp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const setup2FA = async () => {
      if (!user?.email) return
      try {
        setLoading(true)
        setError('')
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
        const res = await axios.post(`${apiUrl}/otp/2fa-setup`, {
          studentId: user.email,
        })
        if (res.data.success) {
          setQr(res.data.qr)
        } else {
          setError(res.data.message || 'ไม่สามารถสร้าง QR 2FA ได้')
        }
      } catch (err) {
        console.error('Admin 2FA setup error:', err)
        setError('ไม่สามารถสร้าง QR 2FA ได้')
      } finally {
        setLoading(false)
      }
    }

    setup2FA()
  }, [user])

  const handleVerify = async e => {
    e.preventDefault()
    if (!totp || totp.length !== 6) {
      setError('กรุณากรอกรหัส 6 หลัก')
      return
    }
    try {
      setLoading(true)
      setError('')
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
      const res = await axios.post(`${apiUrl}/otp/2fa-verify`, {
        studentId: user.email,
        totp,
      })
      if (res.data.success) {
        setSuccess(true)
        localStorage.setItem('admin2fa_verified', 'true')
        setTimeout(() => {
          navigate('/admin')
        }, 1200)
      } else {
        setError(res.data.message || 'รหัสไม่ถูกต้อง')
      }
    } catch (err) {
      console.error('Admin 2FA verify error:', err)
      setError('ไม่สามารถตรวจสอบรหัสได้')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    navigate('/login')
    return null
  }

  if (success) {
    return (
      <div className="otp-container">
        <div className="otp-card success">
          <div className="success-icon">✓</div>
          <h2>ยืนยันสำเร็จ</h2>
          <p>กำลังนำคุณไปยังหน้ารายงาน...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="otp-container">
      <div className="otp-card">
        <div className="otp-header">
          <h1>ยืนยันตัวตนสำหรับผู้สอน</h1>
          <p>สแกน QR ด้วยแอป Authenticator และกรอกรหัส 6 หลักก่อนดูผลประเมิน</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="otp-content">
          {loading && <p>กำลังสร้าง QR 2FA...</p>}
          {!loading && qr && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <img src={qr} alt="Admin 2FA QR" style={{ width: 200, height: 200, margin: '0 auto' }} />
              <form onSubmit={handleVerify} className="otp-form">
                <div className="form-group">
                  <label>กรอกรหัสจากแอป (6 หลัก)</label>
                  <input
                    type="text"
                    value={totp}
                    maxLength={6}
                    onChange={e => setTotp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="otp-input"
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <button type="submit" className="btn-verify" disabled={loading || totp.length !== 6}>
                  {loading ? 'กำลังยืนยัน...' : 'ยืนยันรหัส'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Admin2FA

