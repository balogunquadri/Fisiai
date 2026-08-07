'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchMerchantOverview, signOut } from '../../lib/api';

interface SidebarProps {
  currentPage?: string;
}

export default function DashboardLayout({
  children,
  currentPage = 'overview',
}: {
  children: React.ReactNode;
  currentPage?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [merchantName, setMerchantName] = useState('Fisi Ai');
  const [merchantLabel, setMerchantLabel] = useState('Merchant account');
  const [merchantInitials, setMerchantInitials] = useState('SA');

  const navItems = [
    { label: 'Overview', icon: '📊', id: 'overview', href: '/dashboard' },
    { label: 'Inventory Hub', icon: '📦', id: 'inventory', href: '/dashboard/inventory' },
    { label: 'Customers', icon: '👥', id: 'customers', href: '/dashboard/customers' },
    { label: 'Contact CRM', icon: '☎️', id: 'contacts', href: '/dashboard/contacts' },
    { label: 'Sales Analytics', icon: '📈', id: 'sales', href: '/dashboard/sales' },
    { label: 'Finance', icon: '💰', id: 'finance', href: '/dashboard/finance' },
    { label: 'Payments', icon: '💳', id: 'payments', href: '/dashboard/payments' },
    { label: 'Tasks', icon: '🧩', id: 'tasks', href: '/dashboard/tasks' },
    { label: 'Inbox', icon: '💬', id: 'chat', href: '/dashboard/chat' },
    { label: 'Settings', icon: '⚙️', id: 'settings', href: '/dashboard/settings' },
  ];

  const router = useRouter();

  useEffect(() => {
    const loadMerchant = async () => {
      if (typeof window === 'undefined') return;

      const storedMerchantId = window.localStorage.getItem('merchantId');
      const merchantId = storedMerchantId || process.env.NEXT_PUBLIC_MERCHANT_ID || null;

      if (!merchantId || merchantId === 'YOUR_MERCHANT_ID_HERE') {
        setMerchantName('Fisi Ai');
        setMerchantLabel('Merchant account');
        setMerchantInitials('SA');
        return;
      }

      try {
        const overview = await fetchMerchantOverview(merchantId);
        const name = overview.merchant?.name || merchantId;
        const label = overview.merchant?.phone || overview.merchant?.whatsappBusinessPhone || 'Merchant account';
        const initials = name
          .split(' ')
          .map((part) => part[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        setMerchantName(name);
        setMerchantLabel(label);
        setMerchantInitials(initials || 'SA');
      } catch (err) {
        console.error('Failed to load merchant profile', err);
      }
    };

    loadMerchant();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed', err);
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('merchantId');
      }
      router.push('/signin');
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-slate-900/95 border-r border-white/10 transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="border-b border-white/10 px-6 py-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-400 px-2 py-1 text-sm font-bold text-slate-950">SA</div>
              <div className="text-sm">
                <p className="font-semibold">Fisi Ai</p>
                <p className="text-xs text-slate-400">Merchant Control</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                  currentPage === item.id
                    ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                    : 'text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-white/10 px-4 py-4">
            <div className="rounded-lg bg-slate-800/50 p-4 text-xs text-slate-400">
              <p className="font-semibold text-slate-300 mb-2">Need Help?</p>
              <p>Contact support on WhatsApp</p>
              <button className="mt-3 w-full rounded bg-emerald-400/20 px-3 py-2 text-emerald-300 hover:bg-emerald-400/30 transition text-xs font-medium">
                Get Support
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden rounded-lg border border-white/10 p-2 hover:bg-slate-800"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <h1 className="text-xl font-semibold">Merchant Control Center</h1>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex items-center gap-2 flex-1 max-w-xs mx-4">
            <input
              type="text"
              placeholder="Search..."
              className="w-full rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2 text-sm placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
            />
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="relative rounded-lg border border-white/10 p-2 hover:bg-slate-800 transition">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-orange-400" />
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 hover:bg-slate-800/50 transition cursor-pointer">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-sm font-bold text-slate-950">
                {merchantInitials}
              </div>
              <div className="hidden sm:block text-xs">
                <p className="font-semibold">{merchantName}</p>
                <p className="text-slate-400">{merchantLabel}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-slate-950">
          <div className="p-6">{children}</div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
