import { useMe } from '../../api/auth'

export default function DashboardHome() {
  const { data: user } = useMe()
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
      <p className="mt-2 text-gray-500">
        Products, orders, and customer inquiries will appear here as they are built.
      </p>
    </div>
  )
}
