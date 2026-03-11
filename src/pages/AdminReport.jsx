import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { getInstructorReport } from '../lib/api'
import axios from 'axios'
import './AdminReport.css'
import useLockBrowserNavigation from '../hooks/useLockBrowserNavigation'

const QUESTION_GROUPS = [
  {
    title: 'การสอน',
    items: [
      '1. แจ้งวัตถุประสงค์และแผนการสอนแต่ละหัวข้อชัดเจน',
      '2. มีเอกสารประกอบการสอน และสื่อการสอน',
      '3. สามารถอธิบายแนวคิดที่สำคัญของเนื้อหาได้ชัดเจน',
      '4. การสอนทำให้เข้าใจเนื้อหาเกี่ยวข้องกับการประยุกต์',
      '5. จัดกิจกรรมการเรียนการสอนในชั่วโมงเรียนได้เหมาะสม',
      '6. ส่งเสริมให้นักศึกษามีส่วนร่วมในชั้นเรียน',
      '7. วิธีการสอนทำให้เกิดทักษะคิด วิเคราะห์ และสรุปด้วยตนเอง',
      '8. สอนตรงตามเนื้อหาที่กำหนดไว้ในแผนการสอน',
      '9. เปิดโอกาสให้นักศึกษาปรึกษานอกชั้นเรียน',
      '10. มีกิจกรรมการบ้าน/แบบฝึกหัดเหมาะสม',
      '11. มีการสอนทบทวนก่อนสอบหรือสรุปเนื้อหา',
    ],
  },
  {
    title: 'การวัดผลและประเมินผล',
    items: [
      '12. บอกเกณฑ์และวิธีการวัดผลการเรียนได้ชัดเจน',
      '13. ให้ข้อสอบ/งานตรงกับเนื้อหาที่สอน',
      '14. ให้ผลการประเมินอย่างยุติธรรมและโปร่งใส',
    ],
  },
  {
    title: 'อื่นๆ',
    items: [
      '15. ความเหมาะสมของเนื้อหากับระดับของนักศึกษา',
      '16. สอดแทรกคุณธรรม จริยธรรมขณะทำการสอน',
      '17. ตรงต่อเวลาในการสอนและกิจกรรมต่าง ๆ',
      '18. บุคลิกและมารยาทโดยรวมของอาจารย์',
    ],
  },
]

function AdminReport() {
  const { instructorId, subjectId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null')
    } catch {
      return null
    }
  }, [])

  const semester = searchParams.get('semester') || '1'
  const academicYear = searchParams.get('year') || '2568'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [qr, setQr] = useState('')
  const [totp, setTotp] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [twofaError, setTwofaError] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

  // ถ้าพยายามกด back/forward ให้บังคับ login/verify ใหม่
  useLockBrowserNavigation(true, { mode: 'logout' })

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true)
        setError('')
        const response = await getInstructorReport(instructorId, subjectId, semester, academicYear)
        if (response.success) {
          setReport(response.data)
        } else {
          setError(response.error || 'ไม่สามารถโหลดรายงานได้')
        }
      } catch (err) {
        console.error('Error fetching admin report:', err)
        setError('ไม่สามารถโหลดรายงานได้')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [instructorId, subjectId, semester, academicYear])

  // เตรียม QR สำหรับสแกนบนหน้านี้ (ใช้ email ของ admin)
  useEffect(() => {
    const setup2FA = async () => {
      if (!user?.email) return
      try {
        setTwofaError('')
        const token = localStorage.getItem('token')
        const res = await axios.post(
          `${apiUrl}/otp/2fa-setup`,
          { studentId: user.email },
          token
            ? {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            : undefined
        )
        if (res.data.success) {
          setQr(res.data.qr)
        } else {
          setTwofaError(res.data.message || 'ไม่สามารถสร้าง QR สำหรับยืนยันตัวตนได้')
        }
      } catch (err) {
        console.error('Admin report 2FA setup error:', err)
        setTwofaError('ไม่สามารถสร้าง QR สำหรับยืนยันตัวตนได้')
      }
    }

    setup2FA()
  }, [user])

  const handleVerify2FA = async e => {
    e.preventDefault()
    if (!totp || totp.length !== 6) {
      setTwofaError('กรุณากรอกรหัส 6 หลักจากแอป Authenticator')
      return
    }
    try {
      setVerifying(true)
      setTwofaError('')
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${apiUrl}/otp/2fa-verify`,
        { studentId: user.email, totp },
        token
          ? {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          : undefined
      )
      if (res.data.success) {
        setIsVerified(true)
      } else {
        setTwofaError(res.data.message || 'รหัสไม่ถูกต้อง')
      }
    } catch (err) {
      console.error('Admin report 2FA verify error:', err)
      setTwofaError('ไม่สามารถตรวจสอบรหัสได้')
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return <div className="admin-report-loading">กำลังโหลดรายงาน...</div>
  }

  if (error) {
    return (
      <div className="admin-report-loading">
        <div>{error}</div>
        <button type="button" className="admin-back-btn" onClick={() => navigate('/dashboard')}>
          กลับหน้าหลัก
        </button>
      </div>
    )
  }

  const { instructor, subject, total_responses, overall_average, question_averages, comments } =
    report || {}

  const flatQuestions = QUESTION_GROUPS.flatMap(group => group.items)

  return (
    <div className="admin-report-container">
      <header className="admin-report-header">
        <div className="admin-header-left">
          <h1>ภาพรวมผลการประเมิน</h1>
          <p>สรุปผลการประเมินรายวิชาและอาจารย์ผู้สอนจากแบบประเมินของนักศึกษา</p>
        </div>
        <div className="admin-header-right">
          <button type="button" onClick={() => navigate('/admin')} className="admin-back-btn">
            ← กลับหน้าหลัก
          </button>
        </div>
      </header>

      <main className="admin-report-content">
        {/* กล่องสำหรับสแกน QR และยืนยันตัวตนก่อนดูคะแนนจริง - ซ่อนเมื่อยืนยันสำเร็จ */}
        {!isVerified && (
          <section className="admin-section admin-2fa-section">
            <h3>ยืนยันตัวตนด้วย QR ก่อนดูรายละเอียดคะแนน</h3>
            <p className="admin-2fa-desc">
              สแกน QR ด้วยแอป Google Authenticator หรือแอปที่รองรับ TOTP แล้วกรอกรหัส 6 หลัก
              เพื่อปลดล็อกการแสดงผลคะแนนและข้อเสนอแนะ
            </p>
            {twofaError && <div className="admin-2fa-error">{twofaError}</div>}
            <div className="admin-2fa-layout">
              {qr && (
                <div className="admin-2fa-qr">
                  <img src={qr} alt="Admin 2FA QR" />
                </div>
              )}
              <form className="admin-2fa-form" onSubmit={handleVerify2FA}>
                <label>รหัสจากแอป (6 หลัก)</label>
                <input
                  type="text"
                  maxLength={6}
                  value={totp}
                  onChange={e => setTotp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="000000"
                />
                <button type="submit" disabled={verifying || totp.length !== 6}>
                  {verifying ? 'กำลังตรวจสอบ...' : 'ยืนยันรหัส'}
                </button>
              </form>
            </div>
          </section>
        )}

        <section className="admin-teacher-card">
          <div className="admin-avatar">
            <div className="admin-avatar-initial">
              {instructor?.instructor_name_th?.charAt(0) || instructor?.instructor_name_en?.charAt(0) || '?'}
            </div>
          </div>
          <div className="admin-teacher-info">
            <h2>{instructor?.instructor_name_th || 'ไม่พบชื่ออาจารย์'}</h2>
            {instructor?.instructor_name_en && (
              <p className="admin-teacher-en">{instructor.instructor_name_en}</p>
            )}
            <p className="admin-subject-title">
              {subject?.subject_code} {subject?.subject_name_th}
            </p>
            <div className="admin-badges">
              <span className="admin-badge">
                ปีการศึกษา {academicYear} / ภาคการศึกษา {semester}
              </span>
              {subject?.subject_name_en && (
                <span className="admin-badge muted">{subject.subject_name_en}</span>
              )}
            </div>
          </div>
          <div className="admin-teacher-metrics">
            <div className="metric">
              <div className="metric-label">จำนวนผู้ประเมิน</div>
              <div className="metric-value">{total_responses || 0} คน</div>
            </div>
            <div className="metric">
              <div className="metric-label">คะแนนเฉลี่ยรวม</div>
              <div className="metric-value highlight">
                {overall_average ? overall_average.toFixed(2) : '-'} / 5.00
              </div>
            </div>
          </div>
        </section>

        <section className="admin-section">
          <h3>ส่วนที่ 1: เกณฑ์การประเมินรายวิชา</h3>
          <div className="admin-question-list">
            {flatQuestions.map((label, index) => {
              const avg = question_averages?.[index] ?? null
              const showReal = isVerified && typeof avg === 'number'
              const percent = showReal ? (avg / 5) * 100 : 0
              return (
                <div key={index} className="admin-question-row">
                  <div className="admin-question-text">{label}</div>
                  <div className="admin-question-metric">
                    <div className="admin-progress-bar">
                      <div
                        className="admin-progress-fill"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="admin-score-label">
                      {showReal ? avg.toFixed(2) : 'xx'} / 5.00
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="admin-section">
          <h3>ส่วนที่ 2: ข้อเสนอแนะเพิ่มเติม</h3>
          {comments && comments.length > 0 ? (
            <div className="admin-comments-grid">
              {comments.slice(0, 8).map((c, idx) => (
                <div key={idx} className="admin-comment-card">
                  <p className="admin-comment-hash">
                    {isVerified
                      ? c.comment
                      : c.hash || 'ข้อมูลความคิดเห็นถูกทำให้ไม่สามารถอ่านได้ (hashed) เพื่อความเป็นส่วนตัว'}
                  </p>
                  <div className="admin-comment-meta">
                    {c.submitted_at ? new Date(c.submitted_at).toLocaleString('th-TH') : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-empty">ยังไม่มีข้อเสนอแนะจากนักศึกษา</p>
          )}
        </section>
      </main>
    </div>
  )
}

export default AdminReport

