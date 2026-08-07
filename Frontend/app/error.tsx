'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="max-w-md rounded-lg bg-slate-900 p-8 text-center">
        <h1 className="mb-4 text-2xl font-bold text-red-400">Something went wrong!</h1>
        <p className="mb-6 text-slate-300">{error.message || 'An unexpected error occurred'}</p>
        <button
          onClick={() => reset()}
          className="rounded-lg bg-emerald-400 px-6 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
