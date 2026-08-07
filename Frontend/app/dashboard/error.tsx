'use client';

import Link from 'next/link';

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
      <div className="max-w-md rounded-lg bg-slate-900 p-8 text-center">
        <h1 className="mb-4 text-2xl font-bold text-red-400">Dashboard Error</h1>
        <p className="mb-6 text-slate-300">{error.message || 'An error occurred in the dashboard'}</p>
        <div className="flex gap-3">
          <button
            onClick={() => reset()}
            className="flex-1 rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="flex-1 rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
