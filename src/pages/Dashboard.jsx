import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'
import { getEnrollmentsWithInstructors, getEvaluationStatus } from '../lib/api'

const SUBJECT_IMAGES = {
  'CPE 393': '/subject_cpe393.jpg',
  'GEN 412': '/subject_gen412.jpg',
}

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enrollments, setEnrollments] = useState([])
  const [evaluations, setEvaluations] = useState([])
  const [selectedSemester, setSelectedSemester] = useState(1)
  const [selectedYear, setSelectedYear] = useState(2568)

  useEffect(() => {
    // Get user from localStorage
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  // Fetch enrollments when user, semester, or year changes
  useEffect(() => {
    if (user && user.email) {
      fetchEnrollmentsData()
    }
  }, [user, selectedSemester, selectedYear])

  // Check if need to refresh data after submission
  useEffect(() => {
    if (user && user.email) {
      const shouldRefresh = localStorage.getItem('refreshDashboard')
      if (shouldRefresh === 'true') {
        localStorage.removeItem('refreshDashboard')
        fetchEnrollmentsData()
      }
    }
  }, [user])

  const fetchEnrollmentsData = async () => {
    try {
      setLoading(true)

      // Fetch enrollments with instructors
      const enrollResponse = await getEnrollmentsWithInstructors(
        user.email,
        selectedSemester,
        selectedYear
      )

      // Fetch evaluation status
      const evalResponse = await getEvaluationStatus(user.email, selectedSemester, selectedYear)

      console.log('API Response:', { enrollResponse, evalResponse })

      if (enrollResponse.success) {
        setEnrollments(enrollResponse.data)
      }

      if (evalResponse.success) {
        setEvaluations(evalResponse.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  const getEvaluationStatusForEnrollment = (enrollment) => {
    const evals = evaluations.filter(
      e => e.subject_id === enrollment.subject_id
    )
    
    console.log('DEBUG getEvaluationStatusForEnrollment:', {
      enrollmentSubjectId: enrollment.subject_id,
      evaluations: evaluations,
      filteredEvals: evals,
    })

    if (evals.length === 0) {
      return { status: 'ยังไม่มีข้อมูล', class: '', count: 0 }
    }

    const allCompleted = evals.every(e => e.status === 'completed')
    const allSubmitted = evals.every(e => e.status === 'submitted' || e.status === 'completed')

    if (allCompleted) {
      return { status: 'ประเมินเสร็จแล้ว', class: 'completed', count: evals.length }
    } else if (allSubmitted) {
      return { status: 'ส่งแล้ว', class: 'submitted', count: evals.length }
    } else {
      return { status: 'รอการประเมิน', class: 'pending', count: evals.length }
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
    window.location.reload()
  }

  if (loading && !user) {
    return <div>Loading...</div>
  }

  if (!user) {
    navigate('/login')
    return null
  }

  const displayName = (() => {
    const first = typeof user.first_name === 'string' ? user.first_name.trim() : ''
    const last = typeof user.last_name === 'string' ? user.last_name.trim() : ''
    const full = `${first} ${last}`.trim()
    if (full) return full
    return user.student_id || user.email
  })()

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>KMUTT - ระบบประเมินการสอน</h1>
        <div className="user-info">
          <span>{displayName}</span>
          <button onClick={handleLogout} className="logout-btn">
            ออกจากระบบ
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="assessment-section">
          <h2>การประเมินการเรียนการสอน</h2>
          <p className="section-desc">
            บัตร/ปีการศึกษา คุณสามารถเลือกปีการศึกษาและภาคการศึกษาเพื่อทำการประเมินการเรียนการสอน
          </p>

          <div className="filter-card">
            <div className="filter-group">
              <div className="form-group">
                <label>ปีการศึกษา</label>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
                >
                  <option value={2568}>2568</option>
                  <option value={2567}>2567</option>
                  <option value={2566}>2566</option>
                </select>
              </div>

              <div className="form-group">
                <label>ภาคการศึกษา</label>
                <select
                  value={selectedSemester}
                  onChange={e => setSelectedSemester(parseInt(e.target.value, 10))}
                >
                  <option value={1}>ภาคการศึกษา 1</option>
                  <option value={2}>ภาคการศึกษา 2</option>
                </select>
              </div>

              <button className="search-btn" onClick={fetchEnrollmentsData} disabled={loading}>
                {loading ? 'กำลังค้นหา...' : 'ค้นหารายวิชา'}
              </button>
            </div>
          </div>

          <h3 className="subjects-title">
            รายวิชาที่ลงทะเบียน ภาคการศึกษา {selectedSemester} / {selectedYear}
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>กำลังโหลดข้อมูล...</div>
          ) : enrollments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>ไม่พบรายวิชาที่ลงทะเบียน</div>
          ) : (
            <div className="subjects-grid">
              {enrollments.map(enrollment => {
                const evalStatus = getEvaluationStatusForEnrollment(enrollment)
                const instructors = enrollment.instructors || []
                const subjectCode = enrollment.subjects?.subject_code
                const thumbSrc = SUBJECT_IMAGES[subjectCode] || null

                return (
                  <div key={enrollment.id} className="subject-card">
                    {thumbSrc && (
                      <div
                        className="subject-thumb"
                        style={{ backgroundImage: `url(${thumbSrc})` }}
                      >
                        <div className="subject-thumb-overlay">
                          <span className="subject-thumb-code">
                            {enrollment.subjects?.subject_code}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="subject-header">
                      {!thumbSrc && (
                        <div className="subject-code-badge">
                          {enrollment.subjects?.subject_code || 'CODE'}
                        </div>
                      )}
                      <div className="subject-title-block">
                        <p className="subject-name-en">
                          {enrollment.subjects?.subject_name_en ||
                            enrollment.subjects?.subject_name_th ||
                            'N/A'}
                        </p>
                        <p className="subject-name-th">
                          {enrollment.subjects?.subject_name_th || ''}
                        </p>
                      </div>
                    </div>

                    <div className="instructor">
                      <span>อาจารย์ผู้รับผิดชอบการสอน</span>
                      <div className="instructor-list">
                        {instructors.length > 0
                          ? instructors.map(i => i.instructor_name_th).join(', ')
                          : 'ไม่มีข้อมูลอาจารย์'}
                      </div>
                    </div>

                    <div className="status-row">
                      <div className={`status-label ${evalStatus.class}`}>
                        สถานะ:{' '}
                        {evalStatus.status === 'ประเมินเสร็จแล้ว'
                          ? 'ประเมินแล้ว'
                          : evalStatus.status}
                      </div>
                    </div>

                    <div className="actions">
                      {instructors.length > 0 ? (
                        instructors.map((instructor, idx) => {
                          // ตรวจสอบว่าส่งประเมินแล้วหรือยัง
                          const evalForInstructor = evaluations.find(
                            e => e.subject_id === enrollment.subject_id && e.instructor_id === instructor.id && (e.status === 'submitted' || e.status === 'completed')
                          )
                          const evaluated = Boolean(evalForInstructor)
                          return (
                            <button
                              key={idx}
                              className={`action-btn${evaluated ? ' evaluated' : ''}`}
                              disabled={evaluated}
                              onClick={() => {
                                if (evaluated) return
                                navigate(
                                  `/evaluation/${user.email}/${instructor.id}/${enrollment.subject_id}?semester=${selectedSemester}&year=${selectedYear}`
                                )
                              }}
                            >
                              {instructor.instructor_name_th}
                            </button>
                          )
                        })
                      ) : (
                        <span style={{ color: '#718096', fontSize: '13px' }}>ไม่มีอาจารย์</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="note">
            <p>
              ⓘ ความสำคัญของประเมิน: ข้อมูลการประเมินเป็นทั้งสำหรับให้อาจารย์ได้ทราบความคิดเห็นของนักศึกษาและเพื่อพัฒนาคุณภาพการสอน
              หากระบบขาดข้อมูล ขอให้อาจารย์ผู้สอนตรวจสอบว่ามีสถานะและอื่นๆหรือไม่
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Dashboard
