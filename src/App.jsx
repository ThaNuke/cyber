import { useMemo, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import EvaluationForm from './pages/EvaluationForm'
import AdminReport from './pages/AdminReport'
import AdminHome from './pages/AdminHome'
import './App.css'

function App() {
  const initialLoggedIn = useMemo(() => Boolean(localStorage.getItem('token')), [])
  const [isLoggedIn] = useState(initialLoggedIn)

  return (
    <Router>
      <Routes>
        <Route path="/" element={isLoggedIn ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/login" element={isLoggedIn ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={isLoggedIn ? <Dashboard /> : <Navigate to="/login" />} />
        <Route
          path="/evaluation/:email/:instructorId/:subjectId"
          element={isLoggedIn ? <EvaluationForm /> : <Navigate to="/login" />}
        />
        <Route
          path="/admin/report/:instructorId/:subjectId"
          element={isLoggedIn ? <AdminReport /> : <Navigate to="/login" />}
        />
        <Route path="/admin" element={isLoggedIn ? <AdminHome /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  )
}

export default App
