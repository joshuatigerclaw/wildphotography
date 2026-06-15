"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function SuccessContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id");
  const sessionId = searchParams.get("session_id");
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) { setLoading(false); return; }
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/you-in-costa-rica/job/${jobId}`);
        if (res.ok) {
          const data = await res.json();
          setJob(data);
          if (data.status === "premium_ready") clearInterval(interval);
        }
      } catch {}
      setLoading(false);
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId]);

  return (
    <div className="max-w-lg w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
      <div className="text-5xl mb-4">🎉</div>
      <h1 className="text-2xl font-bold text-white mb-2">Payment Successful!</h1>
      <p className="text-gray-400 mb-6">Your high-resolution, watermark-free photo is ready.</p>

      {!loading && job ? (
        job.status === "premium_ready" && job.premiumOutputCdnUrl ? (
          <div className="space-y-4">
            <img src={job.premiumOutputCdnUrl} alt="Your Costa Rica photo" className="rounded-xl w-full object-cover max-h-80" />
            <a href={job.premiumOutputCdnUrl} download className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl">Download HD Photo</a>
          </div>
        ) : (
          <div className="py-8 text-gray-400">
            <div className="animate-pulse mb-4 text-lg">Preparing your photo…</div>
            <div className="text-sm text-gray-600">This takes just a moment</div>
          </div>
        )
      ) : (
        <div className="py-8 text-gray-500">Loading…</div>
      )}

      <div className="mt-6 flex gap-3 justify-center">
        <Link href="/you-in-costa-rica" className="text-sm text-gray-500 hover:text-gray-300 px-4 py-2">Create another</Link>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 px-4 py-2">Back to WildPhotography</Link>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-gray-500">Loading…</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}