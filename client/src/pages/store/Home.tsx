import { Link } from 'react-router-dom'

export default function StoreHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white text-center">
      <h1 className="text-3xl font-bold text-emerald-700">ES-Market</h1>
      <p className="mt-2 text-gray-500">Easy Shopping Market — online store coming soon.</p>
      <Link to="/dashboard" className="mt-6 text-sm text-emerald-600 underline">
        Staff dashboard
      </Link>
    </div>
  )
}
