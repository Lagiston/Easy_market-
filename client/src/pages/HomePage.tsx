import axios from "axios";
import { useQuery } from "@tanstack/react-query";

export default function HomePage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => axios.get<{ status: string }>("/api/health").then((res) => res.data),
  });

  const health = isPending ? "loading" : isError || data?.status !== "ok" ? "error" : "ok";

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-gray-900">Home</h1>
      {health === 'loading' && <p>Checking server…</p>}
      {health === 'ok' && <p>✅ Server is up and running</p>}
      {health === 'error' && <p>❌ Server is unreachable</p>}
    </div>
  );
}
