// src/App.jsx

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import EmployeeDashboard from './pages/EmployeeDashboard'
import MemberDashboard from './pages/MemberDashboard'
import ForceChangePassword from './components/ForceChangePassword'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-slate-400">Loading...</div>
  if (!user) return <Navigate to="/login" />
  return children
}

function RootRedirect() {
  const { user, profile, loading, refreshProfile } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-slate-400">Loading...</div>
  if (!user) return <Navigate to="/login" />
  if (profile?.must_change_password) return <ForceChangePassword onDone={refreshProfile} />
  if (profile?.role === 'super_admin') return <SuperAdminDashboard />
  if (profile?.role === 'admin') return <AdminDashboard />
  if (profile?.role === 'member') return <MemberDashboard />
  return <EmployeeDashboard />
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-slate-400">Loading...</div>

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      <Route path="/" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}