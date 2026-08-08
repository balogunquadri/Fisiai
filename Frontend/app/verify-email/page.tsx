'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [message, setMessage] = useState<string>('Verifying your email...');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing.');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/verify-email?token=${encodeURIComponent(token)}`);
        const data = await response.json();
        if (!response.ok) {
          setStatus('error');
          setMessage(data.error || 'Unable to verify email.');
          return;
        }

        setStatus('success');
        setMessage(data.message || 'Email verified successfully. You can now sign in.');
      } catch (error) {
        setStatus('error');
        setMessage('Failed to verify email. Try again later.');
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="relative w-full max-w-lg space-y-6 rounded-3xl border border-white/10 bg-slate-900/80 p-10 shadow-2xl shadow-slate-950/40">
        <div className="space-y-3 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Email verification</p>
          <h1 className="text-3xl font-bold text-white">{status === 'pending' ? 'Verifying...' : status === 'success' ? 'Verified!' : 'Verification Failed'}</h1>
          <p className={`text-sm ${status === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>{message}</p>
        </div>

        <div className="flex flex-col gap-3">
          {status === 'success' ? (
            <Link href="/signin" className="rounded-full bg-emerald-500 px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-emerald-400">
              Go to Sign In
            </Link>
          ) : (
            <Link href="/signup" className="rounded-full bg-slate-800 px-5 py-3 text-center text-sm font-semibold text-slate-100 transition hover:bg-slate-700">
              Return to Signup
            </Link>
          )}
          <Link href="/" className="text-center text-sm text-slate-400 hover:text-slate-200">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12 text-slate-300">Loading verification...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
