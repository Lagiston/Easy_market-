import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../api/client'

type StaffUser = {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'AGENT'
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
}

const inputClass =
  'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none'

export default function Users() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api<{ users: StaffUser[] }>('/api/users').then((r) => r.users),
  })

  const [form, setForm] = useState({ email: '', name: '', role: 'AGENT', password: '' })

  const createUser = useMutation({
    mutationFn: () => api('/api/users', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setForm({ email: '', name: '', role: 'AGENT', password: '' })
    },
  })

  const toggleActive = useMutation({
    mutationFn: (user: StaffUser) =>
      api(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !user.isActive }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Users</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          createUser.mutate()
        }}
        className="mt-6 grid grid-cols-2 gap-4 rounded-lg bg-white p-6 shadow-sm"
      >
        <h2 className="col-span-2 font-semibold text-gray-800">Add staff member</h2>
        <input
          className={inputClass}
          type="text"
          placeholder="Name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className={inputClass}
          type="email"
          placeholder="Email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <select
          className={inputClass}
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="AGENT">Agent</option>
          <option value="ADMIN">Admin</option>
        </select>
        <input
          className={inputClass}
          type="text"
          placeholder="Temporary password (min 8 chars)"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {createUser.isError && (
          <p className="col-span-2 text-sm text-red-600">{(createUser.error as Error).message}</p>
        )}
        <p className="col-span-2 text-xs text-gray-400">
          The new user must change this password on first login.
        </p>
        <button
          type="submit"
          disabled={createUser.isPending}
          className="col-span-2 rounded bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Create user
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg bg-white shadow-sm">
        {isLoading ? (
          <p className="p-6 text-gray-500">Loading…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-400">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.id} className="border-b border-gray-100">
                  <td className="px-6 py-3 font-medium text-gray-800">{u.name}</td>
                  <td className="px-6 py-3 text-gray-600">{u.email}</td>
                  <td className="px-6 py-3">{u.role}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        u.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      className="text-xs text-gray-500 underline hover:text-gray-800"
                      onClick={() => toggleActive.mutate(u)}
                    >
                      {u.isActive ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
