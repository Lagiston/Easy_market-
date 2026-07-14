import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useLogout, useMe } from '../../api/auth'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-emerald-100 text-emerald-800' : 'text-gray-600 hover:bg-gray-100'
  }`

export default function DashboardLayout() {
  const { data: user, isLoading, isError } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()

  if (isLoading) return <div className="p-8 text-gray-500">Loading…</div>
  if (isError || !user) return <Navigate to="/dashboard/login" replace />
  if (user.mustChangePassword) return <Navigate to="/dashboard/change-password" replace />

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-56 flex-col border-r border-gray-200 bg-white p-4">
        <div className="mb-6 px-3">
          <span className="text-lg font-bold text-emerald-700">ES-Market</span>
          <span className="block text-xs text-gray-400">Dashboard</span>
        </div>
        <nav className="flex-1 space-y-1">
          <NavLink to="/dashboard" end className={navLinkClass}>
            Overview
          </NavLink>
          {user.role === 'ADMIN' && (
            <NavLink to="/dashboard/users" className={navLinkClass}>
              Users
            </NavLink>
          )}
        </nav>
        <div className="border-t border-gray-200 pt-3 text-sm">
          <p className="px-3 font-medium text-gray-800">{user.name}</p>
          <p className="px-3 text-xs text-gray-400">{user.role}</p>
          <button
            className="mt-2 w-full rounded px-3 py-2 text-left text-gray-600 hover:bg-gray-100"
            onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/dashboard/login') })}
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
