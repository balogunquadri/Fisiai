import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="max-w-md rounded-lg bg-slate-900 p-8 text-center">
        <h1 className="mb-4 text-4xl font-bold text-emerald-400">404</h1>
        <p className="mb-2 text-xl font-semibold text-slate-100">Page not found</p>
        <p className="mb-6 text-slate-300">The page you're looking for doesn't exist</p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-emerald-400 px-6 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
