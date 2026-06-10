import { Routes, Route } from 'react-router-dom'
import Register from './pages/Register'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Feed from './pages/Feed'
import PostDetail from './pages/PostDetail'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import AdminPanel from './pages/AdminPanel'
import TeamAcquisition from './pages/TeamAcquisition'
import Calendar from './pages/Calendar'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import PublicOnlyRoute from './components/PublicOnlyRoute'

function App() {
  return (
    <Routes>
      <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* authed app shell: topbar + left rail, pages render in the Outlet */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Feed />} />
        <Route path="post/:id" element={<PostDetail />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="team" element={<TeamAcquisition />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="admin" element={<AdminPanel />} />
      </Route>
    </Routes>
  )
}

export default App
