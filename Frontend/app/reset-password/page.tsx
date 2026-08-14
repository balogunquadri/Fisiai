'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setToken(searchParams.get('token') || '');
    setEmail(searchParams.get('email') || '');
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token || !email) {
      setIsError(true);
      setMessage('Missing reset token or email. Please request a new password reset link.');
      return;
    }

    if (password !== confirmPassword) {
      setIsError(true);
      setMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setIsError(true);
        setMessage(data.error || 'Unable to reset your password.');
        return;
      }

      setIsError(false);
      setMessage(data.message || 'Password reset successfully.');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setIsError(true);
      setMessage('Network error. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_35%)]" />

      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40">
        <div className="mb-6 text-center">
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">Create new password</p>
          <h1 className="mt-3 text-3xl font-bold text-white">Reset Password</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {message ? (
            <div className={`rounded-xl border px-3 py-2 text-sm ${isError ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
              {message}
            </div>
          ) : null}

          {!token || !email ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
              This password reset link is invalid or missing required information. Please request a fresh reset email.
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">New password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter a strong password"
              className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none transition"
              required
              disabled={!token || !email}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your password"
              className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none transition"
              required
              disabled={!token || !email}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !token || !email}
            className="w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Resetting...' : 'Reset password'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link href="/signin" className="text-emerald-400 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12 text-slate-300">Loading reset form...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
