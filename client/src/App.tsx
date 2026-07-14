import { Navigate, Route, Routes } from 'react-router-dom'
import ChangePassword from './pages/dashboard/ChangePassword'
import DashboardHome from './pages/dashboard/DashboardHome'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import Login from './pages/dashboard/Login'
import Users from './pages/dashboard/Users'
import StoreHome from './pages/store/Home'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StoreHome />} />
      <Route path="/dashboard/login" element={<Login />} />
      <Route path="/dashboard/change-password" element={<ChangePassword />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="users" element={<Users />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
