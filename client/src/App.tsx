import { useEffect, useState } from 'react';

function App() {
  const [health, setHealth] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: { status: string }) => setHealth(data.status === 'ok' ? 'ok' : 'error'))
      .catch(() => setHealth('error'));
  }, []);

  return (
    <div className="App">
      <h1>ES-Market</h1>
      {health === 'loading' && <p>Checking server…</p>}
      {health === 'ok' && <p>✅ Server is up and running</p>}
      {health === 'error' && <p>❌ Server is unreachable</p>}
    </div>
  );
}

export default App;
