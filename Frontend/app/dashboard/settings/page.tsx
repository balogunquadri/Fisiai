'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { fetchMerchantOverview, type MerchantOverviewResponse } from '../../../lib/api';

export default function SettingsPage() {
  const [merchant, setMerchant] = useState<MerchantOverviewResponse['merchant'] | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasMerchant = Boolean(merchantId && merchantId !== 'YOUR_MERCHANT_ID_HERE');

  useEffect(() => {
    let isMounted = true;

    if (!merchantId) {
      const storedId = window.localStorage.getItem('merchantId');
      if (storedId && storedId !== 'YOUR_MERCHANT_ID_HERE') {
        setMerchantId(storedId);
        return;
      }

      setLoading(false);
      return;
    }

    const loadMerchantOverview = async () => {
      if (!hasMerchant) {
        setLoading(false);
        return;
      }

      try {
        const overview = await fetchMerchantOverview(merchantId!);
        if (!isMounted) return;
        setMerchant(overview.merchant || null);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load merchant settings');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadMerchantOverview();

    return () => {
      isMounted = false;
    };
  }, [merchantId, hasMerchant]);

  return (
    <DashboardLayout currentPage="settings">
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Settings</h1>
              <p className="text-slate-300 mt-2">Update your merchant profile, WhatsApp/Telegram connections, and notification preferences.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Dashboard home
              </Link>
              <Link
                href="/dashboard/chat"
                className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Messages
              </Link>
              <Link
                href="/dashboard/payments"
                className="rounded-full border border-white/10 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >
                Payments
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Merchant profile</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{merchant?.name || 'Business name unavailable'}</h2>
            <p className="mt-1 text-sm text-slate-400">{merchant?.phone || merchant?.whatsappBusinessPhone || 'Phone number unavailable'}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-lg">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Merchant ID</p>
            <p className="mt-2 text-lg font-semibold text-white">{merchantId || 'Not configured'}</p>
            <p className="mt-3 text-sm text-slate-400">Your merchant ID links the dashboard to your sign-up account data.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-lg space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Account Settings</h2>

            {loading ? (
              <p className="text-slate-400">Loading merchant settings...</p>
            ) : !hasMerchant ? (
              <div className="rounded-2xl border border-yellow-400/20 bg-yellow-900/5 p-4 text-yellow-100">
                No merchant configured. Sign in or complete signup to load your real merchant settings.
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">{error}</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-white/5 rounded-lg">
                  <span className="text-slate-300">Business Name</span>
                  <span className="text-slate-200 font-semibold">{merchant?.name || 'Not configured'}</span>
                </div>

                <div className="flex items-center justify-between p-4 border border-white/5 rounded-lg">
                  <span className="text-slate-300">Merchant category</span>
                  <span className="text-slate-200 font-semibold">{merchant?.category || 'Retail'}</span>
                </div>

                <div className="flex items-center justify-between p-4 border border-white/5 rounded-lg">
                  <span className="text-slate-300">Location</span>
                  <span className="text-slate-200 font-semibold">{merchant?.location || 'Not configured'}</span>
                </div>

                <div className="flex items-center justify-between p-4 border border-white/5 rounded-lg">
                  <span className="text-slate-300">Phone</span>
                  <span className="text-emerald-400 font-semibold">{merchant?.phone || merchant?.whatsappBusinessPhone || 'Not configured'}</span>
                </div>

                <div className="flex items-center justify-between p-4 border border-white/5 rounded-lg">
                  <span className="text-slate-300">Email</span>
                  <span className="text-slate-200 font-semibold">{merchant?.email || 'Not configured'}</span>
                </div>

                <div className="flex items-center justify-between p-4 border border-white/5 rounded-lg">
                  <span className="text-slate-300">WhatsApp Number</span>
                  <span className="text-slate-200 font-semibold">{merchant?.whatsappBusinessPhone || 'Not configured'}</span>
                </div>

                <div className="flex items-center justify-between p-4 border border-white/5 rounded-lg">
                  <span className="text-slate-300">Telegram Bot</span>
                  <span className="text-slate-200 font-semibold">{merchant?.telegramBotUsername ? `@${merchant.telegramBotUsername}` : 'Not configured'}</span>
                </div>

                <div className="flex items-center justify-between p-4 border border-white/5 rounded-lg">
                  <span className="text-slate-300">Telegram Linked</span>
                  <span className="text-slate-200 font-semibold">{merchant?.telegramChatId ? 'Yes' : 'No'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-6">
            <h2 className="text-lg font-semibold text-white mb-4">Notification Preferences</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                <span className="text-slate-300">Stock alerts</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                <span className="text-slate-300">Order notifications</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/50 transition cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded" />
                <span className="text-slate-300">Weekly reports</span>
              </label>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <button className="rounded-lg bg-red-400/20 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-400/30 transition">
              Disconnect WhatsApp
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
