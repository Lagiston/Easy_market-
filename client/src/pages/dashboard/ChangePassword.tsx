import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useChangePassword, useMe } from '../../api/auth'

export default function ChangePassword() {
  const { data: user, isLoading, isError } = useMe()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const change = useChangePassword()
  const navigate = useNavigate()

  if (isLoading) return <div className="p-8 text-gray-500">Loading…</div>
  if (isError || !user) return <Navigate to="/dashboard/login" replace />

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirm) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    change.mutate(
      { currentPassword, newPassword },
      { onSuccess: () => navigate('/dashboard') },
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="mb-1 text-xl font-bold text-emerald-700">Set a new password</h1>
        <p className="mb-6 text-sm text-gray-500">
          {user.mustChangePassword
            ? 'You must change your password before continuing.'
            : 'Update your password.'}
        </p>
        <label className="mb-1 block text-sm font-medium text-gray-700">Current password</label>
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <label className="mb-1 block text-sm font-medium text-gray-700">New password</label>
        <input
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <label className="mb-1 block text-sm font-medium text-gray-700">Confirm new password</label>
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        {mismatch && <p className="mb-4 text-sm text-red-600">Passwords do not match</p>}
        {change.isError && (
          <p className="mb-4 text-sm text-red-600">{(change.error as Error).message}</p>
        )}
        <button
          type="submit"
          disabled={change.isPending}
          className="w-full rounded bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {change.isPending ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </div>
  )
}
