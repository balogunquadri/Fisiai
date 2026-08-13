"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function PublicHeader() {
  const [open, setOpen] = useState(false);

  const navItems = [
    { label: 'Features', href: '#features' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Merchants', href: '#stories' },
  ];

  return (
    <nav className="relative mx-auto max-w-7xl px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-3 text-white">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 font-bold">SA</span>
          <div>
            <p className="text-sm font-semibold leading-none">Fisi Ai</p>
            <p className="text-xs text-slate-400">Smart stock, simple sales</p>
          </div>
        </div>

        {/* Desktop nav */}
        <div className="hidden sm:flex flex-wrap items-center gap-4 text-sm text-slate-300 sm:gap-6">
          {navItems.map((n) => (
            <a key={n.href} href={n.href} className="transition hover:text-white">
              {n.label}
            </a>
          ))}

          <Link href="/signin" className="transition hover:text-white">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-full bg-emerald-400 px-4 py-2 text-slate-950 font-semibold transition hover:bg-emerald-300">
            Sign up
          </Link>
        </div>

        {/* Mobile toggle */}
        <div className="sm:hidden">
          <button
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            className="rounded-md border border-white/10 p-2 hover:bg-slate-800"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden absolute left-0 right-0 top-full z-50 bg-slate-900 border-b border-white/10 shadow-lg">
          <div className="px-4 py-3 space-y-2">
            {navItems.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/50"
              >
                {n.label}
              </a>
            ))}

            <Link href="/signin" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/50">
              Sign in
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-slate-950 bg-emerald-400 rounded-full text-center font-semibold">
              Sign up
            </Link>
          </div>
        </div>
      )}

      {/* Overlay to close when clicking outside */}
      {open && <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setOpen(false)} />}
    </nav>
  );
}
