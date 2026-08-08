'use client';

import { useState } from 'react';
import Link from 'next/link';
import Toast from '../components/Toast';

export default function SigninPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/signin`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        showToast(data.error || 'Signin failed', 'error');
        return;
      }

      const id = data.merchantId || null;
      if (id) window.localStorage.setItem('merchantId', id);
      showToast('Signed in successfully', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (err) {
      showToast('Failed to sign in. Check console for details.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.15),_transparent_35%)]" />
      
      {toastMessage ? (
        <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage(null)} />
      ) : null}

      <div className="relative w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-2 text-white hover:opacity-80 transition">
            <div className="rounded-lg bg-emerald-400 px-2 py-1 text-sm font-bold text-slate-950">SA</div>
            <div>
              <p className="text-sm font-semibold">Fisi Ai</p>
            </div>
          </Link>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40">
          <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-sm text-slate-400 mb-6">Sign in to your merchant dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email or Phone</label>
              <input
                type="text"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com or +234 701 234 5678"
                className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none transition"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none transition"
                required
              />
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-white/10 accent-emerald-400"
                />
                <span className="text-xs text-slate-400">Remember me</span>
              </label>
              <a href="#" className="text-xs text-emerald-400 hover:underline">
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 mt-6"
            >
              Sign In
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900/80 px-2 text-slate-500">Or</span>
            </div>
          </div>

          {/* WhatsApp Button */}
          <a
            href="https://wa.me/1234567890?text=I%20want%20to%20sign%20in%20to%20Fisi%20Ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-800 transition"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-5.031 1.378c-3.055 2.286-3.428 6.994-1.168 10.654 2.132 3.529 6.038 3.711 8.814 3.711h.46c3.422 0 6.979-.846 9.306-3.24-2.6-.47-5.438-1.9-7.618-4.534-.165-.184-.33-.368-.486-.545-3.291-3.745-3.666-9.035-.872-12.893 2.431-3.415 6.542-4.355 10.322-4.355 3.664 0 7.306.942 10.61 2.821-1.527-1.745-3.649-3.051-6.02-3.554-4.143-.868-8.548.676-11.327 4.128z" />
            </svg>
            Sign in with WhatsApp
          </a>


          {/* Sign Up Link */}
          <p className="text-center text-sm text-slate-400 mt-6">
            Don't have an account?{' '}
            <Link href="/signup" className="text-emerald-400 hover:underline font-semibold">
              Create one here
            </Link>
          </p>
        </div>

        {/* Back Home Link */}
        <div className="text-center">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
