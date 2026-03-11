// Base URL ของ backend API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export const fetchAPI = async (endpoint, options = {}) => {
  try {
    const token = localStorage.getItem('token')

    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      let message = `API error: ${response.status} ${response.statusText}`
      try {
        const data = await response.json()
        message = data?.error || data?.message || message
      } catch {
        // ignore parse errors
      }
      if (response.status === 401) {
        // token หมดอายุ/ไม่ถูกต้อง -> logout อัตโนมัติ
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        localStorage.removeItem('admin2fa_verified')
        window.location.href = '/login'
      }
      throw new Error(message)
    }

    return await response.json()
  } catch (error) {
    console.error('API fetch error:', error)
    throw error
  }
}

// ==================== SUBJECTS ====================

export const getSubjects = (semester, academicYear) => {
  const params = new URLSearchParams()
  if (semester) params.append('semester', semester)
  if (academicYear) params.append('academic_year', academicYear)

  return fetchAPI(`/subjects${params.toString() ? '?' + params.toString() : ''}`)
}

export const getSubjectById = (id) => fetchAPI(`/subjects/${id}`)

// ==================== ENROLLMENTS ====================

export const getEnrollments = (email, semester, academicYear) => {
  const params = new URLSearchParams()
  if (semester) params.append('semester', semester)
  if (academicYear) params.append('academic_year', academicYear)

  return fetchAPI(`/enrollments/${email}${params.toString() ? '?' + params.toString() : ''}`)
}

export const getEnrollmentsWithInstructors = (email, semester, academicYear) => {
  const params = new URLSearchParams()
  if (semester) params.append('semester', semester)
  if (academicYear) params.append('academic_year', academicYear)

  return fetchAPI(`/enrollments/${email}/with-instructors${params.toString() ? '?' + params.toString() : ''}`)
}

// ==================== EVALUATIONS ====================

export const getEvaluationStatus = (email, semester, academicYear) => {
  const params = new URLSearchParams()
  if (semester) params.append('semester', semester)
  if (academicYear) params.append('academic_year', academicYear)

  return fetchAPI(`/evaluations/${email}/status${params.toString() ? '?' + params.toString() : ''}`)
}

export const getEvaluation = (email, instructorId, subjectId, semester, academicYear) => {
  const params = new URLSearchParams()
  params.append('semester', semester)
  params.append('academic_year', academicYear)

  return fetchAPI(`/evaluations/${email}/${instructorId}/${subjectId}?${params.toString()}`)
}

export const submitEvaluation = (evaluationData) =>
  fetchAPI('/evaluations', {
    method: 'POST',
    body: JSON.stringify(evaluationData),
  })

// ==================== INSTRUCTORS ====================

export const getInstructors = () => fetchAPI('/instructors')

export const getInstructorsBySubject = (subjectId) => fetchAPI(`/instructors/subject/${subjectId}`)

// ==================== OTP ====================
// Email OTP removed (use Microsoft SSO + TOTP 2FA instead)

// ==================== ADMIN ====================

export const getInstructorReport = (instructorId, subjectId, semester, academicYear) => {
  const params = new URLSearchParams()
  params.append('instructor_id', instructorId)
  params.append('subject_id', subjectId)
  params.append('semester', semester)
  params.append('academic_year', academicYear)

  return fetchAPI(`/admin/instructor-report?${params.toString()}`)
}

export const getAdminSubjects = (instructorId, semester, academicYear) => {
  const params = new URLSearchParams()
  params.append('instructor_id', instructorId)
  if (semester) params.append('semester', semester)
  if (academicYear) params.append('academic_year', academicYear)
  return fetchAPI(`/admin/subjects?${params.toString()}`)
}

// ==================== LEGACY ENDPOINTS ====================

export const getData = () => fetchAPI('/data')

export const createData = (payload) =>
  fetchAPI('/data', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateData = (id, payload) =>
  fetchAPI(`/data/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const deleteData = (id) =>
  fetchAPI(`/data/${id}`, {
    method: 'DELETE',
  })
