'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) {
        setIsError(true);
        setMessage(data.error || 'Unable to process your request right now.');
        return;
      }

      setIsError(false);
      setMessage(data.message || 'If an account exists for that email, a password reset link has been sent.');
      setEmail('');
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
          <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">Password reset</p>
          <h1 className="mt-3 text-3xl font-bold text-white">Forgot your password?</h1>
          <p className="mt-2 text-sm text-slate-400">Enter the email linked to your account and we will send a reset link.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {message ? (
            <div className={`rounded-xl border px-3 py-2 text-sm ${isError ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
              {message}
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/signin" className="text-emerald-400 hover:underline">
            Back to sign in
          </Link>
          <Link href="/signup" className="text-slate-400 hover:text-slate-200">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
