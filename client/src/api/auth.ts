import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

export type CurrentUser = {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'AGENT'
  mustChangePassword: boolean
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ user: CurrentUser }>('/api/auth/me').then((r) => r.user),
    retry: false,
    staleTime: 60_000,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api<{ user: CurrentUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: ({ user }) => qc.setQueryData(['me'], user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => qc.setQueryData(['me'], null),
  })
}

export function useChangePassword() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}
