import { useEffect, useState } from "react";

export default function HomePage() {
  const [health, setHealth] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: { status: string }) => setHealth(data.status === 'ok' ? 'ok' : 'error'))
      .catch(() => setHealth('error'));
  }, []);

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Home</h1>
      {health === 'loading' && <p>Checking server…</p>}
      {health === 'ok' && <p>✅ Server is up and running</p>}
      {health === 'error' && <p>❌ Server is unreachable</p>}
    </div>
  );
}
