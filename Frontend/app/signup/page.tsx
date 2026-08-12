'use client';

import { useState } from 'react';
import Link from 'next/link';
import Toast from '../components/Toast';

export default function SignupPage() {
  const [formData, setFormData] = useState({
    businessName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [agreed, setAgreed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [verificationLink, setVerificationLink] = useState<string | null>(null);
  const [existingUnverified, setExistingUnverified] = useState(false);
  const [resendInProgress, setResendInProgress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.businessName.trim()) {
      errors.businessName = 'Please enter your business name.';
    }

    if (!formData.email.trim()) {
      errors.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Please enter a phone number.';
    }

    if (!formData.password) {
      errors.password = 'Please choose a password.';
    } else {
      if (formData.password.length < 7) {
        errors.password = 'Password must be at least 7 characters.';
      } else if (!/[A-Z]/.test(formData.password)) {
        errors.password = 'Password must include at least one uppercase letter.';
      } else if (!/[a-z]/.test(formData.password)) {
        errors.password = 'Password must include at least one lowercase letter.';
      } else if (!/[0-9]/.test(formData.password)) {
        errors.password = 'Password must include at least one number.';
      } else if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]/.test(formData.password)) {
        errors.password = 'Password must include at least one special character.';
      }
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (!agreed) {
      errors.terms = 'You must agree to the terms to create an account.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage(message);
    setToastType(type);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setFormErrors({});

    try {
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: formData.businessName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
        }),
      });

      const data = await resp.json();
      // Handle HTTP errors or soft-fail responses where backend returns success:false
      if (!resp.ok || (data && data.success === false)) {
        const errors: Record<string, string> = {};
        if (data.details && Array.isArray(data.details)) {
          data.details.forEach((detail: any) => {
            const field = detail.field || 'general';
            const message = String(detail.message || data.error || 'Validation failed');
            errors[field] = message;
          });
        } else if (data.error) {
          const message = String(data.error).toLowerCase();
          if (message.includes('email')) {
            errors.email = String(data.error);
          } else if (message.includes('password')) {
            errors.password = String(data.error);
          } else if (message.includes('businessname') || message.includes('business name')) {
            errors.businessName = String(data.error);
          } else if (message.includes('phone')) {
            errors.phone = String(data.error);
          } else {
            errors.general = String(data.error);
          }
        } else {
          errors.general = 'Unable to create your account right now. Please review the form and try again.';
        }
        setFormErrors(errors);
        showToast(errors.general || Object.values(errors)[0], 'error');
        // If backend indicated existing-but-unverified account, surface resend UI
        if (data && data.error && String(data.error).toLowerCase().includes('not verified')) {
          setExistingUnverified(true);
          if (data.verificationLink) setVerificationLink(data.verificationLink);
        }
        return;
      }

      const id = data.merchantId || null;
      setVerificationLink(data.verificationLink || null);
      setExistingUnverified(false);
      if (id) window.localStorage.setItem('merchantId', id);
      showToast('Account created successfully. Check your email to verify your address.', 'success');

      if (!data.emailVerificationSent && data.verificationLink) {
        setToastMessage('Account created. We could not send email automatically, so please use the verification link shown below.');
        return;
      }

      setTimeout(() => {
        window.location.href = '/signin';
      }, 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create your account right now. Please check your network connection and try again.';
      setFormErrors({ general: message });
      showToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

    const handleResendVerification = async () => {
      setResendInProgress(true);
      try {
        const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/resend-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email }),
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
          showToast('Verification email resent. Check your inbox.', 'success');
          setVerificationLink(data.verificationLink || null);
          setExistingUnverified(false);
        } else if (data && data.verificationLink) {
          // API returns verificationLink when SMTP not configured
          setVerificationLink(data.verificationLink);
          showToast('Verification link available below. Use it to verify your account.', 'info');
        } else {
          showToast(data.error || 'Could not resend verification. Try again later.', 'error');
        }
      } catch (err) {
        showToast('Network error while resending verification. Try again later.', 'error');
      } finally {
        setResendInProgress(false);
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
          <h1 className="text-2xl font-bold text-white mb-2">Create Your Account</h1>
          <p className="text-sm text-slate-400 mb-6">Start managing your inventory with WhatsApp today</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formErrors.general ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                {formErrors.general}
              </div>
            ) : null}
            {/* Business Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Business Name</label>
              <input
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                placeholder="e.g., Koromo Market Store"
                className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none transition"
                required
              />
              {formErrors.businessName ? (
                <p className="mt-2 text-sm text-rose-300">{formErrors.businessName}</p>
              ) : null}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
                className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none transition"
                required
              />
              {formErrors.email ? (
                <p className="mt-2 text-sm text-rose-300">{formErrors.email}</p>
              ) : null}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">WhatsApp Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+234 701 234 5678"
                className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none transition"
                required
              />
              {formErrors.phone ? (
                <p className="mt-2 text-sm text-rose-300">{formErrors.phone}</p>
              ) : null}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>              <p className="mb-3 text-xs text-slate-500">
                Must be at least 7 characters and include uppercase, lowercase, a number, and a special character.
              </p>              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Min. 8 characters"
                className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none transition"
                required
              />
              {formErrors.password ? (
                <p className="mt-2 text-sm text-rose-300">{formErrors.password}</p>
              ) : null}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm password"
                className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none transition"
                required
              />
              {formErrors.confirmPassword ? (
                <p className="mt-2 text-sm text-rose-300">{formErrors.confirmPassword}</p>
              ) : null}
            </div>

            {/* Terms Agreement */}
            <label className="flex items-start gap-3 py-2">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-white/10 accent-emerald-400"
              />
              <span className="text-xs text-slate-400">
                I agree to the{' '}
                <a href="#" className="text-emerald-400 hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-emerald-400 hover:underline">
                  Privacy Policy
                </a>
              </span>
            </label>
            {formErrors.terms ? (
              <p className="text-sm text-rose-300">{formErrors.terms}</p>
            ) : null}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          {verificationLink ? (
            <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-200">Verification link</p>
              <p className="break-all">{verificationLink}</p>
              <p className="mt-2 text-slate-500">Use this link to verify your email if the email service is not configured.</p>
            </div>
          ) : null}
          {existingUnverified ? (
            <div className="mt-3 rounded-2xl border border-yellow-600/20 bg-yellow-900/5 p-3 text-sm text-yellow-200">
              <p className="font-semibold text-yellow-200">Account requires email verification</p>
              <p className="mt-1 text-yellow-300">An account with this email already exists but is not verified.</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleResendVerification}
                  disabled={resendInProgress}
                  className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
                >
                  {resendInProgress ? 'Resending...' : 'Resend verification email'}
                </button>
                {verificationLink ? (
                  <a href={verificationLink} target="_blank" rel="noreferrer" className="text-emerald-300 underline self-center text-sm">
                    Open verification link
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
          {/* Sign In Link */}
          <p className="text-center text-sm text-slate-400 mt-4">
            Already have an account?{' '}
            <Link href="/signin" className="text-emerald-400 hover:underline font-semibold">
              Sign in here
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
