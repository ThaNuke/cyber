import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminSubjects, getInstructors } from '../lib/api'
import './AdminHome.css'

function AdminHome() {
  const navigate = useNavigate()
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null')
    } catch {
      return null
    }
  }, [])

  const [semester, setSemester] = useState(1)
  const [year, setYear] = useState(2568)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [subjects, setSubjects] = useState([])
  const [teacherName, setTeacherName] = useState('')

  useEffect(() => {
    // ดึงรายชื่ออาจารย์มาเพื่อตรงกับ teacher_id และแสดงชื่อแทนอีเมล
    const fetchTeacherName = async () => {
      try {
        if (!user?.teacher_id) return
        const res = await getInstructors()
        if (res.success && Array.isArray(res.data)) {
          const match = res.data.find(
            inst => String(inst.id) === String(user.teacher_id)
          )
          if (match) {
            setTeacherName(match.instructor_name_th || match.instructor_name_en || '')
          }
        }
      } catch (err) {
        console.error('Error fetching instructor name:', err)
      }
    }

    fetchTeacherName()
  }, [user])

  useEffect(() => {
    const fetchSubjects = async () => {
      if (!user?.teacher_id) return
      try {
        setLoading(true)
        setError('')
        // ตอนนี้ดึงทุกวิชาที่อาจารย์รับผิดชอบ โดยไม่ฟิลเตอร์ปี/เทอมจาก backend
        // เพื่อให้เห็นรายวิชาก่อน แล้วใช้ปี/เทอมไปกรองตอนดูรายงานในหน้า AdminReport
        const res = await getAdminSubjects(user.teacher_id)
        if (res.success) setSubjects(res.data || [])
        else setError(res.error || 'โหลดรายวิชาไม่สำเร็จ')
      } catch (err) {
        console.error(err)
        setError('โหลดรายวิชาไม่สำเร็จ')
      } finally {
        setLoading(false)
      }
    }
    fetchSubjects()
  }, [user, semester, year])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('admin2fa_verified')
    navigate('/login')
    window.location.reload()
  }

  return (
    <div className="admin-home-container">
      <header className="admin-home-header">
        <div>
          <div className="admin-home-title">รายงานผลการประเมิน (Admin)</div>
          <div className="admin-home-subtitle">
            เลือกปีการศึกษา/ภาคการศึกษา แล้วเลือกวิชาที่ต้องการดูรายงาน
          </div>
        </div>
        <div className="admin-home-right">
          <span className="admin-home-user">
            {teacherName || user?.email || ''}
          </span>
          <button type="button" className="admin-home-logout" onClick={handleLogout}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <main className="admin-home-content">
        <div className="admin-home-filter">
          <div className="admin-home-field">
            <label>ปีการศึกษา</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value, 10))}>
              <option value={2568}>2568</option>
              <option value={2567}>2567</option>
              <option value={2566}>2566</option>
            </select>
          </div>
          <div className="admin-home-field">
            <label>ภาคการศึกษา</label>
            <select value={semester} onChange={e => setSemester(parseInt(e.target.value, 10))}>
              <option value={1}>ภาคการศึกษา 1</option>
              <option value={2}>ภาคการศึกษา 2</option>
            </select>
          </div>
        </div>

        <h2 className="admin-home-h2">รายวิชาที่รับผิดชอบ</h2>

        {loading ? (
          <div className="admin-home-state">กำลังโหลด...</div>
        ) : error ? (
          <div className="admin-home-state error">{error}</div>
        ) : subjects.length === 0 ? (
          <div className="admin-home-state">ไม่พบรายวิชาในเทอมที่เลือก</div>
        ) : (
          <div className="admin-home-grid">
            {subjects.map(s => (
              <button
                key={s.id}
                type="button"
                className="admin-home-subject"
                onClick={() =>
                  navigate(
                    `/admin/report/${user.teacher_id}/${s.id}?semester=${semester}&year=${year}`
                  )
                }
              >
                <div className="code">{s.subject_code}</div>
                <div className="name">{s.subject_name_en || s.subject_name_th}</div>
                <div className="name-th">{s.subject_name_th}</div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default AdminHome

