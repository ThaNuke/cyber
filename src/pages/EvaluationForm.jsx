import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import './EvaluationForm.css'
import { getEvaluation, submitEvaluation } from '../lib/api'
import axios from 'axios'
import useLockBrowserNavigation from '../hooks/useLockBrowserNavigation'

const QUESTION_GROUPS = [
  {
    title: 'การสอน',
    items: [
      { field: 'score_q1', label: '1. ผู้สอนจัดเตรียมและดำเนินการสอนตามแผนที่ได้แจ้ง' },
      { field: 'score_q2', label: '2. มีเอกสารประกอบการสอน และสื่อการสอน' },
      { field: 'score_q3', label: '3. สามารถอธิบายแนวคิดสำคัญ (Concept) ได้อย่างชัดเจน' },
      { field: 'score_q4', label: '4. มีวิธีการสอนที่ทำให้นักศึกษาสามารถเรียนรู้ได้ดี' },
      { field: 'score_q5', label: '5. มีวิธีการสอนที่เหมาะกับจำนวนผู้เรียนในห้องนั้น' },
      { field: 'score_q6', label: '6. อธิบายเนื้อหาได้ทันตามส่วนของรายวิชาที่เรียน' },
      { field: 'score_q7', label: '7. มีวิธีการสอนให้เกิดทักษะคิด วิเคราะห์ และสรุปหลักด้วยตนเอง' },
      { field: 'score_q8', label: '8. สอนตรงตามเนื้อหาที่กำหนดไว้ในแผนการสอน' },
      { field: 'score_q9', label: '9. เปิดโอกาสให้นักศึกษามีส่วนร่วมแสดงความคิดเห็น' },
      { field: 'score_q10', label: '10. เปิดโอกาสให้นักศึกษาปรึกษาหารือนอกชั้นเรียน' },
      { field: 'score_q11', label: '11. บริหารการสอนและความรู้ที่ดีในการประกอบการสอน' },
    ],
  },
  {
    title: 'การวัดผลและประเมินผล',
    items: [
      { field: 'score_q12', label: '12. บอกเกณฑ์และวิธีการวัดผลการเรียนได้อย่างชัดเจน' },
      { field: 'score_q13', label: '13. ให้คำแนะนำ/วิธีการ หรือสอนอธิบายจนเข้าใจแก่นักศึกษา' },
      { field: 'score_q14', label: '14. นักศึกษามีโอกาสถามเกี่ยวกับวิชาที่สอนได้อย่างเต็มที่' },
    ],
  },
  {
    title: 'อื่นๆ',
    items: [
      { field: 'score_q15', label: '15. ความเหมาะสมของเนื้อหากับระดับของนักศึกษา' },
      { field: 'score_q16', label: '16. สอดแทรกคุณธรรม จริยธรรม และจรรยาบรรณวิชาชีพระหว่างการสอน' },
      { field: 'score_q17', label: '17. เข้าสอนตรงตามเวลาที่กำหนด และตรงต่อเวลา (เข้า-ออก)' },
      { field: 'score_q18', label: '18. กิริยา คำพูด และมารยาทที่ใช้ในการสอนเหมาะสม' },
    ],
  },
]

const SCORE_FIELDS = QUESTION_GROUPS.flatMap(g => g.items.map(i => i.field))
const INITIAL_SCORES = Object.fromEntries(SCORE_FIELDS.map(f => [f, null]))

function EvaluationForm() {
  const { email, instructorId, subjectId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const semester = searchParams.get('semester')
  const year = searchParams.get('year')

  // ถ้าพยายามกด back/forward ให้บังคับ login/verify ใหม่
  useLockBrowserNavigation(true, { mode: 'logout' })

  const [loading, setLoading] = useState(true)
  const [instructor, setInstructor] = useState(null)
  const [subject, setSubject] = useState(null)
  const [scores, setScores] = useState(INITIAL_SCORES)
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [qr2fa, setQr2fa] = useState(null)
  const [show2fa, setShow2fa] = useState(false)
  const [loading2fa, setLoading2fa] = useState(false)
  const [error2fa, setError2fa] = useState('')
  const [scanned2fa, setScanned2fa] = useState(false)
  const [totp2fa, setTotp2fa] = useState('')
  const [verifying2fa, setVerifying2fa] = useState(false)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

  useEffect(() => {
    fetchEvaluation()
    handle2faSetup() // สร้าง QR 2FA อัตโนมัติตอนเข้าหน้า
  }, [])

  // ออกจากหน้านี้แล้วต้องยืนยันใหม่เสมอ
  useEffect(() => {
    return () => {
      try {
        // legacy: email OTP removed
      } catch {
        // ignore
      }
    }
  }, [])

  const fetchEvaluation = async () => {
    try {
      setLoading(true)
      const response = await getEvaluation(email, instructorId, subjectId, semester, year)

      if (response.success) {
        const data = response.data
        const instructorData = Array.isArray(data.instructors)
          ? data.instructors[0]
          : data.instructors
        setInstructor(instructorData)
        setSubject(data.subjects)

        // Set initial scores if they exist
        setScores(prev => {
          const next = { ...prev }
          for (const field of SCORE_FIELDS) {
            next[field] = data?.[field] ?? null
          }
          return next
        })
        setComments(data.comments || '')
      }
    } catch (error) {
      console.error('Error fetching evaluation:', error)
      alert('ไม่สามารถโหลดข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }

  const handleScoreChange = (field, value) => {
    setScores(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  // สร้าง QR 2FA
  const handle2faSetup = async () => {
    setLoading2fa(true)
    setError2fa('')
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${apiUrl}/otp/2fa-setup`,
        { studentId: email },
        token
          ? {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          : undefined
      )
      if (res.data.success) {
        setQr2fa(res.data.qr)
        setShow2fa(true)
      } else {
        setError2fa(res.data.message || 'ไม่สามารถสร้าง QR 2FA ได้')
      }
    } catch {
      setError2fa('เกิดข้อผิดพลาดในการสร้าง QR 2FA')
    } finally {
      setLoading2fa(false)
    }
  }

  // ยืนยัน TOTP code
  const handle2faVerify = async () => {
    if (!totp2fa || totp2fa.length !== 6) {
      setError2fa('โปรดกรอก TOTP code 6 หลัก')
      return
    }
    setVerifying2fa(true)
    setError2fa('')
    try {
      const token = localStorage.getItem('token')
      const res = await axios.post(
        `${apiUrl}/otp/2fa-verify`,
        { studentId: email, totp: totp2fa },
        token
          ? {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          : undefined
      )
      if (res.data.success) {
        setScanned2fa(true)
      } else {
        setError2fa(res.data.message || 'TOTP code ไม่ถูกต้อง')
      }
    } catch {
      setError2fa('เกิดข้อผิดพลาดในการตรวจสอบ TOTP')
    } finally {
      setVerifying2fa(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const payload = {
        student_id: email,
        instructor_id: parseInt(instructorId),
        subject_id: parseInt(subjectId),
        semester: parseInt(semester),
        academic_year: parseInt(year),
        ...scores,
        comments,
      }

      const response = await submitEvaluation(payload)

      if (response.success) {
        setSuccess(true)
        // บอก Dashboard ให้ refresh data
        localStorage.setItem('refreshDashboard', 'true')
          // เรียก backend เพื่อสร้าง QR 2FA
          setLoading2fa(true)
          setError2fa('')
          try {
            const token = localStorage.getItem('token')
            const res = await axios.post(
              `${apiUrl}/otp/2fa-setup`,
              { studentId: email },
              token
                ? {
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  }
                : undefined
            )
            if (res.data.success) {
              setQr2fa(res.data.qr)
              setShow2fa(true)
            } else {
              setError2fa(res.data.message || 'ไม่สามารถสร้าง QR 2FA ได้')
            }
          } catch {
            setError2fa('เกิดข้อผิดพลาดในการสร้าง QR 2FA')
          } finally {
            setLoading2fa(false)
          }
        setTimeout(() => {
          navigate('/dashboard')
        }, 2000)
      }
    } catch (error) {
      console.error('Error submitting evaluation:', error)
      alert('ไม่สามารถส่งการประเมินได้')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="eval-loading">กำลังโหลด...</div>
  }

  if (success) {
    return (
      <div className="eval-success">
        <div className="success-content">
          <div className="success-icon">✓</div>
          <h2>ส่งการประเมินเสร็จแล้ว</h2>
          <p className="success-text">
            ขอบคุณสำหรับความคิดเห็นของคุณ ข้อมูลนี้จะถูกนำไปใช้ในการพัฒนาคุณภาพการเรียนการสอนต่อไป
          </p>
          <div className="success-actions">
            <button
              type="button"
              className="success-primary-btn"
              onClick={() => navigate('/dashboard')}
            >
              กลับไปหน้า Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="evaluation-form-container">
      <header className="eval-header">
        <div className="eval-header-left">
          <div className="eval-brand">KMUTT - ระบบประเมินการสอน</div>
        </div>
        <div className="eval-header-right">
          <button onClick={() => navigate('/dashboard')} className="back-btn">
            ← กลับ
          </button>
        </div>
      </header>

      <main className="eval-content">
        <section className="eval-page-head">
          <div className="eval-breadcrumb">การประเมินการเรียนการสอน &gt; <strong>แบบประเมินรายวิชา</strong></div>
          <div className="eval-page-sub">
            นิสิต/นักศึกษาทุกคนกรุณาประเมินตามความคิดเห็นของตนเองเพื่อใช้ปรับปรุงและพัฒนาคุณภาพการเรียนการสอน
          </div>
        </section>

        {/* Instructor Section */}
        <section className="instructor-section">
          <div className="instructor-card">
            <div className="instructor-avatar">
              <div className="avatar-placeholder">
                {instructor?.instructor_name_th?.charAt(0) || '?'}
              </div>
            </div>

            <div className="instructor-info">
              <h2>
                {subject?.subject_code}: {subject?.subject_name_th}
              </h2>
              <p className="instructor-name">
                {instructor?.instructor_name_th
                  ? instructor.instructor_name_th
                  : 'ไม่พบชื่ออาจารย์'}
              </p>
              {instructor?.instructor_name_en && (
                <p className="instructor-en">{instructor.instructor_name_en}</p>
              )}
              <div className="info-badges">
                <span className="badge">ภาคการศึกษา {semester} /{year}</span>
                {subject?.credits && <span className="badge">{subject.credits} หน่วยกิจ</span>}
              </div>
            </div>
          </div>
        </section>

        {/* Evaluation Form */}
        <form onSubmit={handleSubmit} className="eval-form">
          {/* Part 1 - Questions */}
          <section className="eval-section">
            <h3 className="section-title">ส่วนที่ 1: เกณฑ์การประเมินรายวิชา</h3>
            <p className="section-desc">
              โปรดประเมินความเห็นของคุณต่อการสอนของอาจารย์ โดยให้คะแนน 0–5
            </p>
            <div className="eval-scale-legend">
              หมายเหตุ: การให้คะแนน 5 = มากที่สุด, 4 = มาก, 3 = ปานกลาง, 2 = น้อย, 1 = น้อยที่สุด,
              0 = ไม่มีข้อมูล
            </div>

            <div className="eval-table-wrapper" role="group" aria-label="ตารางแบบประเมิน">
              <table className="eval-table">
                <thead>
                  <tr>
                    <th className="eval-th-title" scope="col">
                      หัวข้อการประเมิน
                    </th>
                    {[0, 1, 2, 3, 4, 5].map(score => (
                      <th key={score} className="eval-th-score" scope="col">
                        {score}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {QUESTION_GROUPS.flatMap(group => [
                    <tr key={`group-${group.title}`} className="eval-subheader-row">
                      <th className="eval-subheader" colSpan={7} scope="row">
                        {group.title}
                      </th>
                    </tr>,
                    ...group.items.map(question => (
                      <tr key={question.field}>
                        <th className="eval-row-label" scope="row">
                          {question.label}
                        </th>
                        {[0, 1, 2, 3, 4, 5].map(score => {
                          const id = `${question.field}-${score}`
                          return (
                            <td key={score} className="eval-cell">
                              <label className="eval-radio" htmlFor={id}>
                                <input
                                  id={id}
                                  type="radio"
                                  name={question.field}
                                  value={score}
                                  checked={scores[question.field] === score}
                                  onChange={e =>
                                    handleScoreChange(question.field, parseInt(e.target.value, 10))
                                  }
                                />
                                <span className="eval-radio-dot" aria-hidden="true" />
                                <span className="sr-only">
                                  {question.label} คะแนน {score}
                                </span>
                              </label>
                            </td>
                          )
                        })}
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          </section>

          {/* Part 2 - Comments */}
          <section className="eval-section">
            <h3 className="section-title">ส่วนที่ 2: ข้อเสนอแนะเพิ่มเติม</h3>
            <p className="section-desc">
              กรุณาแสดงความเห็นหรือข้อเสนอแนะเพื่อให้ผู้สอนได้รับข้อมูลเพิ่มเติม
            </p>

            <textarea
              className="comments-textarea"
              placeholder="กรุณาเขียนความเห็นหรือข้อเสนอแนะของคุณ..."
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows="6"
            />
          </section>

          {/* Note */}
          <div className="eval-note">
            <p>
              ℹ️ ข้อมูลทั้งหมดที่คุณให้ไว้จะถูกเก็บเป็นความลับและใช้เพื่อการพัฒนาคุณภาพการสอนเท่านั้น
            </p>
          </div>

          {/* QR 2FA Section - Bottom */}
          <section className="qr-2fa-section">
            <h3 className="qr-2fa-title">ยืนยันการสแกน QR 2FA</h3>
            <p className="qr-2fa-subtitle">
              สแกน QR ด้วยแอป Google Authenticator หรือแอปที่รองรับ TOTP แล้วกรอกรหัส 6 หลักเพื่อยืนยัน
            </p>
            {loading2fa && <div className="qr-2fa-status">กำลังสร้าง QR 2FA...</div>}
            {error2fa && <div className="qr-2fa-error">{error2fa}</div>}
            {show2fa && qr2fa && (
              <div className="qr-2fa-layout">
                <div className="qr-2fa-left">
                  <img src={qr2fa} alt="2FA QR" />
                </div>
                <div className="qr-2fa-right">
                  <p className="qr-2fa-hint">
                    เพิ่มบัญชีใหม่ในแอป Authenticator ของคุณโดยสแกน QR ด้านซ้าย จากนั้นกรอก TOTP Code
                    ที่แสดงในแอปเพื่อยืนยันว่าเชื่อมต่อสำเร็จ
                  </p>
                {!scanned2fa ? (
                  <>
                    <div className="totp-input-wrapper">
                      <label className="totp-label">กรอก TOTP Code (6 หลัก):</label>
                      <input
                        type="text"
                        maxLength="6"
                        value={totp2fa}
                        onChange={(e) => setTotp2fa(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                        placeholder="000000"
                      />
                    </div>
                    <button type="button" className="btn-scan-confirm" onClick={handle2faVerify} disabled={verifying2fa || totp2fa.length !== 6}>
                      {verifying2fa ? '⏳ กำลังตรวจสอบ...' : '✓ ยืนยันสแกน'}
                    </button>
                  </>
                ) : (
                  <div className="qr-2fa-success">✅ สแกน QR สำเร็จ</div>
                )}
                </div>
              </div>
            )}
          </section>

          {/* Buttons */}
          <div className="eval-actions">
            <button
              type="button"
              className="btn btn-cancel"
              onClick={() => navigate('/dashboard')}
              disabled={submitting}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn btn-submit"
              disabled={submitting || Object.values(scores).some(s => s === null) || !scanned2fa}
              title={!scanned2fa ? 'กรุณาสแกน QR 2FA ก่อนส่งการประเมิน' : ''}
            >
              {submitting ? 'กำลังส่ง...' : '✓ ส่งการประเมิน'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

export default EvaluationForm
