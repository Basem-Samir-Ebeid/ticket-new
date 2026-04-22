// src/App.jsx

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import EmployeeDashboard from './pages/EmployeeDashboard'
import MemberDashboard from './pages/MemberDashboard'

function ProtectedRoute({ children, role }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-slate-400">Loading...</div>
  if (!user) return <Navigate to="/login" />
  if (role && profile?.role !== role) return <Navigate to="/" />
  return children
}

export default function App() {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-slate-400">Loading...</div>

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={
        <ProtectedRoute>
          {profile?.role === 'admin' ? <AdminDashboard /> : profile?.role === 'member' ? <MemberDashboard /> : <EmployeeDashboard />}
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}